# Start Learning: ebooks, permissions and skill assessments

## Delivered experience

`/certifications` retains the default **IT Certification Practice** tab with `IT_CERTS`, all five cards, `CertificationPracticeCount`, original practice links, Header and Footer. `?tab=practice` selects it explicitly. `?tab=start-learning` opens the new searchable learning hub.

The starter library contains original ExamPro material, not copies of TutorialsPoint content:

| Slug                    | Chapters | Concept checks | Final questions | Exam ID                      |
| ----------------------- | -------- | -------------- | --------------- | ---------------------------- |
| python-mastery          | 5        | 10             | 15              | ebook-exam-python            |
| ai-with-copilot         | 5        | 10             | 15              | ebook-exam-ai-copilot        |
| java-enterprise         | 5        | 10             | 15              | ebook-exam-java              |
| ml-scikit-learn         | 5        | 10             | 15              | ebook-exam-ml-sklearn        |
| python-cheatcodes       | 5        | 10             | 15              | ebook-exam-python-cheatcodes |
| llm-models-to-products  | 5        | 10             | 15              | ebook-exam-llm-products      |
| md-102-endpoint-admin   | 5        | 10             | 15              | ebook-exam-md-102            |
| learn-huggingface       | 5        | 10             | 15              | ebook-exam-huggingface       |
| finetune-llms-beginners | 5        | 10             | 15              | ebook-exam-finetune-llms     |
| github-copilot-gh300    | 5        | 10             | 15              | ebook-exam-gh-300            |

Each track has lessons, an engineering exercise, a code example, expected output and an interview takeaway list. References link to the official language/framework documentation. These are guided starter tracks, not a claim to replace complete vendor training.

Reader: `/certifications/learn/:slug?chapter=:chapterId`. It includes a collapsible chapter tree, responsive reading canvas and utility rail, bookmarks, completion tracking, two-question checks, dark mode, code highlighting/copying, and expected-output previews. Code is displayed as escaped React text and is **not executed** on the server or via eval. Supported Markdown is deliberately limited to headings, paragraphs, lists, bold, callouts, tables, inline code and fenced code. Raw HTML is not rendered.

The final assessment is available after 80% reading completion or via **Challenge Final Exam Now**. Signed-in verified OAuth users get a server-timed assessment with saved answers, a question palette, optional −0.25 negative marking, grading and full explanations. Results are visible in the new **Learning & skill assessments** dashboard section, including resume/review links. Existing mock-test and practice engines remain intact; ebook self-check mode uses the existing `ExamEngine`, and linked mocks use the existing route with its normal publication and plan restrictions. IT certification starter IDs open practice mode.

A passing score at the configured threshold (70% by default) produces an **ExamPro Skill Completion Certificate** card. It is explicitly an internal, unproctored skill assessment, not an accredited or vendor-issued qualification. A certificate is never issued from localStorage or client-submitted score fields. Public achievement links are opt-in: the learner is told that display name, book title and score become public before clicking Create public achievement link. Only passed assessments for currently public books can be shared. Private/invite books do not expose public certificates. No email is returned by the verification endpoint.

## Authorization and editing

- Identity uses the existing verified Google/GitHub session bridge and canonical PostgreSQL user ID.
- Owner administrators are the server's existing `ADMIN_EMAILS` accounts. `NEXT_PUBLIC_ADMIN_EMAILS`, browser role flags and automation API keys do not grant ebook privileges.
- New books default to `admin_only`. The owner can create, change visibility, approve readers/editors, revoke and archive.
- `invite_only` books require a per-book approved access row. `admin_only` ignores collaborator grants and remains owner-only. Anonymous and unapproved users cannot read lesson or exam content.
- Approved editors can edit content only for their approved books. They cannot create books, change visibility, approve access, or archive.
- Request Access binds the request to the verified account email. A submitted email or role cannot impersonate someone else or elevate privileges. Revoked users may request approval again, but receive no automatic access.
- Every server operation rechecks book access. Account changes remount reader state; a previous user's private content is not restored for a new user.
- Updates require the current numeric revision. Stale edits return 409 instead of overwriting another editor. Chapter IDs are stable while order changes.
- Archive is a reversible database flag; book content and past attempts are retained, but the archived book is removed from access/catalogue.
- Public API responses omit author email, ACL records and final exam keys. Authorized readers may request a separate self-check question bank; timed attempts use stored question snapshots and do not return keys before submission. This learning assessment does not promise exam secrecy or proctoring.

**Built-in starter boundary:** the ten public starters ship in the browser bundle, so they cannot become confidential by changing a database flag. The server refuses to archive or restrict these ten starter slugs. Create a separate private ebook for restricted material; custom private books have no offline content fallback.

## Persistence and outage behavior

One existing database and API are retained. New tables are `ebooks`, `ebook_access`, `ebook_progress`, `ebook_attempts`, and `ebook_pdf_assets`. Book content and exam snapshots are JSONB; ACLs, user IDs, revisions and timer/result fields are server-owned.

Public starter reading and self-check practice remain available if the API sleeps, is unreachable or has not received the migration. Signed-in progress and local draft storage are account-scoped. Guest progress is scoped to the browser. Unsaved author drafts require an already-authorized studio session and an explicit Save local draft action; they do not publish or establish permissions. Restoring a local draft still requires server authorization before saving. A failed network call never grants access to a custom private book. Browser storage can be unavailable, and no local result is labeled server-verified.

Server requests have a 12-second UI timeout. A failed answer sync is shown to the learner. The server clock remains authoritative. At expiry, submission uses only previously saved answers and ignores late changes. Submission is locked, idempotent and uses the original attempt snapshot. Refresh/restart can recover saved answers and timer via the dashboard. Reading progress is not a security credential because the challenge option is deliberately available.

## API map

| Endpoint                                       | Authorization / behavior                                  |
| ---------------------------------------------- | --------------------------------------------------------- |
| GET /api/v1/ebooks                             | Public plus caller-approved books; summary only           |
| GET /api/v1/ebooks/capabilities                | Server-derived owner UI capability                        |
| GET /api/v1/ebooks/:slug                       | Read permission; full lessons, no reader final keys       |
| GET /api/v1/ebooks/:slug/practice              | Read permission; self-check questions                     |
| POST /api/v1/ebooks/:slug/request-access       | Verified account; no identity from request body           |
| GET/PUT /api/v1/ebooks/:slug/progress          | Verified caller plus book access                          |
| POST /api/v1/ebooks/:slug/attempts             | Verified caller plus book access; challenge permitted     |
| GET/PUT /api/v1/ebooks/attempts/:id            | Owning account plus current book access                   |
| POST /api/v1/ebooks/attempts/:id/submit        | Server grading; late changes ignored; idempotent          |
| GET /api/v1/ebooks/attempts                    | Caller's accessible attempt history                       |
| POST /api/v1/ebooks/attempts/:id/share         | Caller owns passed public-book result; explicit opt-in    |
| GET /api/v1/ebooks/certificates/:id            | Shared passed result; book must still be public           |
| POST /api/v1/admin/ebooks                      | Human owner only                                          |
| PUT /api/v1/admin/ebooks/:slug                 | Human owner or approved per-book editor, current revision |
| DELETE /api/v1/admin/ebooks/:slug              | Human owner; archive custom ebook                         |
| GET /api/v1/admin/ebooks/requests              | Human owner only                                          |
| POST /api/v1/admin/ebooks/:slug/approve-access | Human owner only                                          |

All ebook responses use `no-store, private` and vary on Authorization. These routes reuse existing general/admin rate limits and body limits. There is no second identity provider, database or service.

## Migration and rollout

1. Review the feature PR and all checks. Do not merge or deploy unreviewed changes.
2. Test the existing `npm run db:migrate` on an isolated staging database with a direct PostgreSQL connection. It now includes the additive ebook SQL and idempotent starter seeding. Re-running it does not overwrite edited books or ACLs. The CI PostgreSQL job applies the complete migration twice to a disposable PostgreSQL 16 database.
3. Verify the existing API's `ADMIN_EMAILS`, shared `AUTH_SECRET`, frontend `NEXT_PUBLIC_API_URL` and CORS configuration. No new secret is required. Keep production and staging database credentials isolated.
4. After approval, deploy the existing Render API and Vercel frontend from the merged commit. Apply the migration using the existing deployment process. Docker now includes the shared content directory needed by startup and seed loading.
5. Smoke-test `/api/v1/ebooks`, both certification tabs, all five old practice links, a starter chapter deep link, code copy/output, bookmarks and concept checks on desktop/mobile/dark mode.
6. With separate owner/reader/editor accounts, create an admin-only book, switch it to invite-only, request access, approve/revoke, and verify forbidden direct API calls. Confirm an editor cannot publish, approve or archive and stale revisions fail.
7. Complete a timed assessment, reload/resume, submit at/after expiry, review the dashboard on another device, and opt into one public achievement link. Verify private/unshared result URLs are unavailable.
8. Simulate an API outage: public starters continue; local drafts/progress are clearly labeled; private content and verified grading fail closed. Never reuse a client role flag as a fallback authorization source.

## Checks

Backend unit/security tests, targeted frontend ESLint, Next.js production build/TypeScript, and real PostgreSQL integration tests are required. The real database tests exercise the existing OAuth middleware with signed test identities, ACLs, revisions, deadlines, persistence and share boundaries. The standalone integration test refuses to run unless `EBOOK_TEST_DATABASE_URL` is explicitly provided.

Browser visual QA remains a staging acceptance step: the managed preview launcher passes unsupported Vite flags to Next.js, and Vercel preview deployments require account authentication in the available browser. No authentication or access setting was weakened to obtain a preview.

## Phase 2: command center and PDF editions

Sign in using a verified owner account listed in the **backend** `ADMIN_EMAILS`. Open `/certifications?tab=start-learning` and click **Manage & Publish Ebooks**. There is no separate ebook admin URL. Approved co-editors see their assigned tracks and content/PDF/exam tools; only owners see creation, cloning, publication and access-management controls. The server checks permissions independently of the UI.

| Tab              | Main actions                                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Inventory & KPIs | Five stat cards, search/category/visibility filters, quick visibility, select a track, clone a private draft, share         |
| Chapter Studio   | Edit metadata, chapter tree, add/remove/reorder, Markdown toolbar, code/output, two checks and live reader preview          |
| PDF Manager      | Version, print/cheat-sheet flags, hosted public PDF URL, authenticated PDF upload, detach and printable preview             |
| Exam Builder     | Pass percentage, duration, correct/negative marks, badge, linked mock, visual questions, bulk import, JSON/Markdown backups |
| Access           | Direct reader/editor grants, pending requests, approvals and revocation                                                     |

Select an inventory row before editing its PDF or assessment settings. Save ebook persists form edits with the current revision; Save local draft stores unsynced work on this device. New/clone/import drafts are private. JSON can create a private draft or update the currently selected matching slug; an update preserves its revision, visibility and PDF attachment. Access grants and attachment bytes are managed separately from JSON backups. Markdown import replaces the selected chapter's body. Bulk import uses existing `parseBulk`; use visual questions for multiline code or literal pipes.

### PDF behavior

- `/certifications/learn/:slug?view=pdf` renders all chapters in an A4 print layout with contents, code, expected output and takeaway tables. After authorized content loads it opens the browser print dialog; Print / Save as PDF can reopen it. Navigation, controls and floating WhatsApp are hidden during printing. Page-number margin boxes depend on browser support; users can also enable browser print headers/footers.
- `?view=cheatsheet` uses two compact groups (three chapters, then two) for the Python quick reference. Exact pagination varies with browser, paper, scaling and fonts. The full ebook remains available separately.
- Public hosted URLs must use HTTPS and end in `.pdf`. The remote host must permit embedding/download; otherwise use its open link. External PDF links are intentionally not accepted for restricted books.
- Uploaded PDFs are limited to **3 MiB**, validated for a PDF header and stored in the existing PostgreSQL database (BYTEA). There is no ephemeral upload directory, new storage provider or new credential. Upload replaces the saved asset immediately, increments revision, and preserves unsaved chapter/form edits in the studio.
- GET `/api/v1/ebooks/:slug/pdf` rechecks current book access and returns private/no-store headers; the client retrieves private bytes with the existing OAuth bridge and creates a temporary blob URL for the viewer. POST `/api/v1/admin/ebooks/:slug/pdf?revision=:revision&filename=:filename` requires the owner or an approved track editor. Revocation, archival or detachment blocks subsequent retrieval. Readers may retain bytes already downloaded.
- `allowPdfDownload` controls learner print/download buttons. It is a UI preference, not DRM; readable content can be copied or saved using browser tools.

### Compatible schema and content

PDF flags, URLs, filename, badge, version and scoring fields are optional in frontend types. Legacy books and attempt snapshots use defaults: printing enabled, version 1.0, pass 70%, correct +1, penalty 0. PowerShell snippets and Certification Cram levels are additive. Attempts store a snapshot of the configured marks/pass threshold and domain tags; later ebook edits do not change an existing result. The learner may toggle −0.25 negative marking when starting an assessment. Domain counts appear beside the final explanations.

The original three seed objects are preserved. The seven new original tracks add 35 chapters, 70 checks and 105 final questions, with public/offline starter behavior. MD-102 and GH-300 domain callouts refer to the current official study guides checked on 31 October 2026; they explicitly identify supplementary coverage and vendor trademarks. Copilot exclusions are described through current organization/repository controls rather than a universal `.copilot.ignore` file. QLoRA memory is treated as workload-dependent, not a guaranteed 16 GB recipe. Model outputs in the reader are authored previews; no training, model execution or shell command runs in the browser.

### Phase 2 rollout

From the **repository root** (`Quiz-App`, alongside backend `package.json`), with the intended staging `DATABASE_URL` supplied securely, run `npm ci` then `npm run db:migrate`. This creates `ebook_pdf_assets` and inserts the seven missing seeds. It is idempotent and does not replace existing customized books or ACLs. Build the frontend separately: `cd exam-practice-pro`, `npm ci`, `npm run build`. Deploy the reviewed API and frontend commit through the existing Render/Vercel process, then verify owner, reader, editor, private PDF and printing flows. Do not run the migration in the frontend directory. No production migration or deployment is performed by this PR.

The PostgreSQL CI job now checks all ten seeds, uploads/revisions, anonymous and revoked PDF access, editor boundaries, disabled download links, size limits, detachment, persisted scoring configuration and domain results. Existing five certification practice cards and routes are unchanged. Local validation checks Python syntax in all 25 new Python snippets and executes the five standard-library cheatcode examples; dependency-heavy model/training examples still require their documented Python environment for hands-on execution.
