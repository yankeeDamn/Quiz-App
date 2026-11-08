# Ebook PDF preview rollout

Status: code prepared for staging; no database or deployment changes made by this work.

## Architecture and settings

The existing PostgreSQL `ebooks.document` JSONB stores `accessLevel` (`free` or `pro`, default `free`), `freePreviewPages` (integer 1–50, default 2), and `allowPdfDownload` (boolean, default true). We retain the application's SQL migration system instead of introducing another ORM. Owner admins change these settings in Ebook Studio → PDF Manager and Save. Approved editors can upload but cannot change these access settings.

Existing bundled editions stay free. A legacy Monetization ebook gate remains effective even when Studio says Free: switch off that saved legacy gate as well to deliberately make an existing paid book free. Neither the backend nor frontend monetization checkout switch releases protected content or revokes already-purchased access. A missing policy table or failed grant lookup fails closed.

Full uploads remain in the private `ebook_pdf_assets.bytes` BYTEA column, never in `public/` or public cloud URLs. Uploaded PDFs are limited to 3 MiB. The upload transaction also stores `preview_bytes` and `preview_pages`. Changing the preview-page setting regenerates the preview in the same transaction. Existing uploads without a preview are rasterized on demand; re-upload them to persist the preview and avoid repeated rendering. Replacement uploads atomically replace both versions.

PDF.js renders only the permitted pages with annotations disabled. pdf-lib creates a fresh PDF containing only those rendered images. This avoids copying later-page objects, hidden text, shared resources, source metadata or attachments. Preview text is therefore not selectable; the authorized full PDF retains the original content. Rendering is bounded to 1600 pixels on the longest edge and two concurrent jobs per process. PDF processing requires Node 22+ and the installed native canvas package (supported Linux builds, including the Docker image); no public rendering service is used.

## Delivery

- Next.js: `/api/ebooks/[slug]/read` and `/api/ebooks/[slug]/download` resolve the Auth.js session, mint the existing backend identity token, and stream the authorized backend response.
- Express: `/api/v1/ebooks/:slug/read`, `/download`, and legacy `/pdf` (including `?download=1`) all call the same service.
- Guests and unpaid users get a preview for Pro books. Active IT ebook pass/Pro users get the full PDF. Approved editors/owner admins retain editing access. Visibility/approval restrictions apply before payment access: paying does not grant access to an admin-only or invite-only book.
- The download endpoint rejects downloads when `allowPdfDownload=false`; authorized inline reading still works. This is not DRM: a reader who receives full bytes can save them using browser tools.
- Responses are private/no-store. A client cannot choose preview length or claim a plan through query parameters.
- Uploaded printable/cheatsheet routes use the same protected PDF viewer. Existing HTML chapter previews remain limited server-side, and paid assessment routes remain locked.
- The viewer includes the upgrade panel immediately after the preview, existing ebook checkout and Pro pricing links. It rechecks while a preview is open every 15 seconds and on tab focus/session change. After a redirecting checkout, return to the ebook; the next request checks the verified backend grant. A payment-success URL is never treated as proof.

## Staging setup

1. Review the draft PR and CI results. Apply on staging first, using Node 22.
2. Install backend dependencies with `npm ci`.
3. With the **staging** database connection selected, apply `src/db/ebook-pdf-preview.sql` inside a transaction in Neon SQL Editor. This is additive and creates policy/grant tables if absent; it does not enable payments. Alternatively the existing `npm run db:migrate` includes it, but that command also runs existing content seed steps.
4. Deploy backend first, then the Next.js frontend with its existing staging `NEXT_PUBLIC_API_URL`, Auth.js settings and checkout configuration. Do not point staging at production.
5. In Manage Ebooks create an original private draft. Save Free/Pro, preview-page and download settings, then upload a valid PDF with at least five distinct pages. Review it and publish publicly for testing. Built-in public editions cannot be converted to Pro.
6. For a book that was previously public, use a new original paid edition and remove any old public links/assets independently. This code cannot recall copies already downloaded or erase a third-party public PDF.

## Acceptance checklist

Use separate browser profiles for admin, anonymous, free, active ebook-pass, active Pro and expired accounts. Do not test paid access using the admin account.

| Case | Expected |
| --- | --- |
| Five-page Free book | Full five-page PDF |
| Five-page Pro book, anonymous/free | Exactly two pages; upgrade panel; no full source bytes |
| Valid ebook pass or Pro | All five pages |
| Expired pass or SSC-only pass | Preview only |
| Disable checkout flags | Pro remains protected; valid purchased grants still work |
| Direct Next.js read/download and all Express aliases | Same access result; forged token rejected |
| `?pro=true&previewPages=999` | No additional access |
| Download disabled | Download endpoint 403; permitted inline reading works |
| Replace PDF / change preview count | New preview reflects saved source/count; stale revision rejected |
| Payment pending, failed, or fake success URL | Still preview |
| Verified sandbox payment then return/focus/recheck | Full PDF after backend grant exists |
| Private/invite-only book | Existing ACL restrictions remain effective |
| Original bundled books | Existing Free experience preserved |
| Legacy HTML printable URL | Uploaded book uses protected viewer; no full paid chapter fallback |

Automated: `npm test`; frontend `npm run build` in `exam-practice-pro`. The existing disposable PostgreSQL CI job also covers real upload persistence and ACLs; its PDF fixture is now a real PDF. Do not run it against staging or production. Browser/payment and real PostgreSQL checks still require staging/CI verification before release.
