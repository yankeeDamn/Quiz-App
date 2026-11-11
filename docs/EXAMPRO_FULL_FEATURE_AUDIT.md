# ExamPro full feature audit

Audit date: 10 November 2026 (Asia/Kolkata). Baseline: `4afbeacabdf8d5695747bf3571cced57e14ac7a0` (merged PR #88). **Release status: NOT READY.**

This is an evidence inventory, not certification of every control. A passing unit test, an accessible page, or a green build does not prove a live authenticated journey. No production/staging writes, login provisioning, publications, payments, migrations or deployments were performed. Protected question text, student identities and credentials are excluded.

## Revision and environment evidence

| Surface | Observation | Evidence / limitation |
| --- | --- | --- |
| GitHub main | `4afbeac` | Git remote and GitHub branches API agree; no open PRs at audit start |
| Main CI | Success | [run 42471954751](https://github.com/yankeeDamn/Quiz-App/actions/runs/42471954751), head `4afbeac`; not proof of live acceptance |
| Production Vercel | `4afbeac` | `/status` in real browser; production API ready |
| Staging Vercel | `2dd598993632453ef99f59e13555a32624ef79f0` | `/status` in real browser; **not at main** |
| Production Render | `4afbeac`, live, manual | `dep-dbo682dg1s2s73eaidk0`, service `quiz-app-regd` |
| Staging Render | `4afbeac`, live, manual | `dep-dbo52mk9v7es73eacme0`, service `exampro-staging-api` |
| Staging routing | Staging frontend reports staging Render URL | First `/status` request exceeded its 8-second timeout; not evidence of a permanent outage |
| Neon mapping | Not verified | No live connection strings read; environment-specific branch fingerprint and backup/restore acceptance still required |
| Render build | Both run `npm ci --omit=dev && npm run db:migrate` | Provider read confirms source configuration; new B2B SQL must remain manual |
| Local baseline tests | **286/286 pass, zero skipped** | `npm test` on untouched baseline, Node 24.22.1; unit/stub tests, not live QA |

## Status vocabulary

Working = stated behavior confirmed by suitable evidence; partially working = functional subset with recorded gap; demo/preview only = intentionally nonpersistent; broken = reproduced failure or confirmed code defect; not deployed = revision mismatch; not implemented = absent implementation; not verified = required evidence missing. Severity is launch impact, not a claim of a demonstrated exploit.

## Public features

Paths below are relative to `https://quiz-app-virid-zeta-41.vercel.app`. Source paths are repository relative. Ownership denotes the product role responsible, not a user identity.

| Feature / owner | Link and source | Code inspection | Automated evidence | Live browser evidence | Status / severity / next action |
| --- | --- | --- | --- | --- | --- |
| Home navigation / platform | `/`; `app/page.tsx`, `components/layout/header.tsx` under `exam-practice-pro` | Navigation and two separate catalogue surfaces | Navigation/content tests pass | Hero, links, filters visible; searching SSC produced one matching test | Partially working / Medium: finish mobile, keyboard, dark-mode and all-link acceptance |
| Home totals / platform | `components/home/*`, `src/routes/exampro-features.js` | DB totals separate from bundled public practice | Feature tests pass | 921 bank questions, 761 unavailable, 10 published topic tests, 0 mocks; 33 distinct bundled practice questions | Working for observed display only; counts are time-specific, not publication approval |
| Free/Pro catalogue / platform | `/india-mocks`; `src/services/mocks.service.js` | Summary catalogue and protected delivery are separate | `dual-tier-catalogue`, `content-exposure`, `access` pass | 18 displayed entries, all Free; includes public starters in addition to DB topic tests | Partially working / High: no live Pro fixture verified; do not publish records merely to test |
| Timed mock runner / learner | `/india-mocks/[id]`; `src/services/exam-attempts.service.js` | Server deadline, snapshot, owner-scoped progress and server grading | `exam-sessions`, `exam-grade`, section-timing and draft-security pass | No live attempt created | Not verified end-to-end / High: disposable real DB + authenticated browser test |
| Draft protection / platform | `/admin/draft-test/[id]`; `draft-testing-gate.js` | Staging-only guard and admin snapshot segregation | Draft-security and editorial-publication tests pass | No live private draft accessed | Partially working / High: staged acceptance required |
| ExamPro studio / platform | `/exampro`; `app/exampro/page.tsx` | Real catalogue plus clearly separated local branding preview | `exampro-features`, portal-link and translation tests pass | Exam hall and role instructions visible | Partially working / Medium: custom practice, sharing and recovery acceptance |
| Portal builder / institute prospect | `/exampro#portal`, `/exampro/portal` | Browser storage / query-string public design; not tenancy | Portal link tests pass | Preview disclosure confirmed through institutes entry | Demo/preview only / no private data should be entered |
| IT career practice / learner | `/certifications`; `components/certifications/*` | Public starter data remains intentionally public and under review | Certification separation and content tests pass | Career page opens | Partially working / Medium: assessment persistence not live verified |
| Start Learning / learner | `/certifications` Start Learning tab | API ebooks with bundled public fallback | Ebook tests pass | Tab switch works; ten starter tracks visible with search/filter controls | Partially working / High: custom ebook CRUD and cross-device assessment still need acceptance |
| PDF access / learner | `/api/ebooks/[slug]/*`; `src/routes/ebooks.js`, `ebook-pdf-preview.js` | Protected binary delivery, preview generation, download policy | PDF access and preview unit tests pass; baseline CI has PostgreSQL job | No paid/full PDF requested | Not verified live / High: upload, free preview, entitled full view, revoked access |
| Government jobs / platform | `/government-jobs`; `government-jobs.service.js` | Best-effort official feeds with diagnostics, not complete coverage | Government-jobs tests pass | Two notices, zero upcoming; one of two sources healthy | Partially working / Medium: diagnose unhealthy source, retain disclosure |
| My Applications / learner | `/government-jobs`; `government-job-applications.service.js` | Per-user CRUD, AES-GCM reference masking/reveal; manual status | Tracker tests pass (mock database) | Tab deployed; anonymous access presents sign-in | Not verified authenticated / High: manual SQL and encryption key existence unknown |
| Institutes landing / prospect | `/institutes`; `app/institutes/page.tsx` | No registration backend | Rendering is not evidence | Page explicitly labels planned management and previews | Demo/preview only / High for B2B launch |
| Institute admin / institute | `/institute-admin`; `app/institute-admin/page.tsx` | Local CSV checker only; no accounts/import/exams/billing | No real tenant workflow tests on baseline | Six cards label backend pending; preview notice visible | Demo/preview only / High for B2B launch |
| Branded coaching pages / platform | `/c/[slug]`; `monetization.service.js` | Platform-owned JSON profiles + `monetization_members`; shared test IDs; no institute RBAC | Monetization tests pass | No specific published profile supplied | Not verified / High: retain legacy profiles independently of new tenant identities |
| Bookmarks / learner | `/bookmarks`; `bookmark.service.js`, `lib/storage.ts` | Backend owner-scoped records plus browser state | Existing content/access tests do not prove full bookmark lifecycle | Page visited; persistence not exercised | Not verified / Medium: save/remove/reload/account-switch |
| Student dashboard / learner | `/dashboard`, `/dashboard/attempts/[id]` | V2 attempt history separate from legacy practice stats | Analytics and sessions tests pass | Anonymous shell visited; no signed-in history inspected | Not verified live / High: cross-device account isolation |
| Legacy quiz stats / learner | `/quiz/*`; `src/services/quiz.service.js` | Accepts client-computed score, percentage and passed; unsuitable for trusted institute ranking | No tamper-denial evidence | Not exercised | Broken as authoritative assessment / High: segregate legacy practice and migrate new scoring without rewriting history |
| Sign-in / all | `/auth/signin`; `lib/auth.ts`, backend-token route, `middleware/nextauth.js` | Verified Google/GitHub token bridge; canonical database UUID; no guest institute authorization | NextAuth upsert/access tests pass | No OAuth login/logout/session-recovery performed | Not verified end-to-end / High |
| Pricing / platform commercial owner | `/pricing`; `lib/plans.ts` | Static counts and institute promises exceed implementation | Plan arithmetic tests pass; not commercial acceptance | Claims 5 Free/6 more Pro mocks; live catalogue has no Pro; institute seats are not enforced | Broken claims / High: replace unverified benefits with scope and enquiry-only B2B offer |
| Cashfree / platform finance | `cashfree-sandbox.service.js`, `monetization-payments.service.js` | HMAC + provider reconciliation, idempotent grants; separate legacy sandbox and newer mode | Sandbox/monetization tests pass | No payment initiated | Not verified commercially / High: settlement, refund, failure, reconciliation and mode separation required |
| Advertise / advertiser | `/advertise`; `routes/monetization.js` | Pending-review submission, owner approval, expiry and session dedup | Monetization tests pass | Form and disclosure visible; booking button initially disabled, subsequent config state not exercised | Not verified submission/moderation / High: no records created |
| Sponsored placements / platform | `components/monetization/*` | Client suppression during exams and ad-free access; public creatives omit contact/payment fields | Monetization tests pass | No active ad fixture exercised | Partially working / High: independent payment/rejection audit and visibility tests |
| Staging API configuration / operations | `lib/api.ts`, `app/status/page.tsx`, `next.config.ts` | Missing/localhost production config silently uses production API | Confirmed source defect | Staging currently reports correct URL; wrong-config behavior not triggered live | Broken fail-closed policy / High: remove fallback before tenant work |

## Platform admin control inventory

All listed controls have code, but **none is claimed live-verified merely from rendering**. Public `/admin` correctly showed “Sign in to workspace”. The existing Playwright script intercepts APIs with synthetic fixtures: it validates controls, not OAuth or persistence.

| Module / platform owner | Source and controls | Existing test evidence | Classification and dependency |
| --- | --- | --- | --- |
| Gate/session | `app/admin/layout.tsx`, `app/admin/page.tsx`, `lib/admin.ts`: session gate, retry, tabs, reload | Admin tests and synthetic browser script | Not verified live: tab-switch draft preservation; SessionProvider default focus refetch requires deliberate testing |
| Overview | `admin-command-center.service.js`: counts, publication candidates, refresh and navigation | Admin draft-source/catalogue tests | Not verified live; real counts require DB |
| Question Bank | `components/admin/questions-tab.tsx`, `src/routes/admin.js`: topic selector/create/edit, search, tier/status filters, CSV picker/preview/import, add/edit/review/publish/draft/retire/restore | Question workflow, CSV picker, import, publication gate tests | Partially working by automated evidence; authenticated DB and browser acceptance pending |
| Mocks & Tests | `components/admin/tests-tab.tsx`: draft/live lists, search/filter/pagination, create/edit/clone/delete, preview, checklist, publish/unpublish, tier changes | Admin draft/csv/catalogue/publication tests; synthetic browser coverage in baseline CI | Not verified live; do not mutate existing mocks for audit |
| Ebook Studio | `components/admin/ebooks-*`, ebook API routes: inventory/select/create/save/archive, chapter reorder, access/preview pages/download, PDF upload/preview, JSON and assessment import/export | Ebook/PDF tests; baseline PostgreSQL CI | Not verified live: user-reported create and PDF checks remain open |
| Manual plans | `components/admin/plans-tab.tsx`, `manual-grants.service.js`: search, grant preview/confirm/revoke/history | `manual-grants-pr65` | Not verified provider settlement; never grant from this audit |
| Payment audit | Cashfree audit tab: order/webhook inspection | Cashfree sandbox tests | Not verified live; sandbox success is not live readiness |
| Beta & QA | Invitations, revocation, feedback, audit, readiness, translation drafts, review approvals | Beta/invitations/editorial/translation tests | Not verified staging schema/key readiness; prior blockers are historical, not current proof |
| Monetization | `components/admin/monetization-*`, `routes/monetization.js`: sponsor approval/pause/extend/delete, manual grants, profiles/members, live events, affiliate and ebook policy | Monetization tests | Partially working; B2B accounts/subscriptions absent; ad approval checkbox is an owner attestation, not independent provider evidence |

## Confirmed gaps and proposed review sequence

1. **A — regressions**: fail closed for missing deployed API configuration; remove static catalogue promises and enquiry-only institute claims. Preserve existing paid plan records and prices for current users.
2. **B — tenant foundation**: reuse `pilot_*` tables, add lifecycle/profile/explicit permissions, membership revocation, signed expiring one-use invitations, platform-reviewed applications, tenant-aware audit and tests. Feature off by default, manual migration only.
3. **C/D — workspaces and delivery**: real institute UI, scoped teacher batches, question review/versioning/import, publication snapshots, assignments, server-timed attempts; dedicated tests before enabling.
4. **E/F — reports and commerce**: real aggregates, exports, quota enforcement, independently verified B2B billing and ad approval/audit. No invented prices.
5. **G — release gates**: two-institute real PostgreSQL + browser acceptance, mobile/a11y, dependency scan, backup/restore, exact environment fingerprints and owner signoff.

No feature should be promoted to “Working” without attaching the particular test, environment, revision and observed result. Remaining authenticated workflows, all private B2B functionality and commercial operations block release.

## PR A validation and fixes

- Removed implicit production API fallback across the client, server proxies, status and rewrite configuration. `NEXT_PUBLIC_APP_ENV=staging` constrains the expected staging API; known staging browser hostname also rejects production. Production builds with missing configuration fail closed. Explicit local test builds use `NEXT_PUBLIC_APP_ENV=local`.
- Removed hardcoded mock-count promises and changed institute sales to a pilot enquiry. Existing prices and stored learner entitlements are unchanged.
- After fixes: **289/289 backend tests pass** (three added environment-resolution tests). Frontend build result is recorded in the PR.
- Read-only HTTP diagnostics: both APIs return 200 for readiness, catalogue and government-jobs. Production monetization config returns 404; staging returns 200. Thus production advertisement submission is disabled by configuration, not a functional live booking service.
- Database impact: none. Staging acceptance: deploy only after owner approval; set explicit API and APP_ENV; validate missing/wrong URL fails closed, all learner links and existing PDF proxies, pricing disclosure and account switching. Rollback: revert this PR's frontend/config commits; no data rollback.

## Implementation checkpoint — 11 November 2026

The baseline inventory above describes the deployed baseline, not an assertion that drafted work is deployed. Main remains `4afbeac`. No production/staging changes were made.

- Draft #89: configuration/pricing regression CI passes.
- Draft #90: foundation PostgreSQL passes; its original full CI fails an admin mobile assertion. The deterministic menu-detachment fix is in #91, whose complete CI passes.
- Draft #91: authenticated workspaces, invitations, branding and platform application review; complete CI passes.
- Draft #92: private bank/CSV/review/versioning, batches, assignment, immutable publication, server-timed/graded attempts and own/assigned-teacher results; complete CI passes.
- Draft #93: teaching and student screens connected to those APIs; complete CI [42872627737](https://github.com/yankeeDamn/Quiz-App/actions/runs/42872627737) passes. 296 unit tests and 15 disposable PostgreSQL scenarios pass. The synthetic browser journey covers authoring, role-appropriate review, assignment/publication confirmation, autosave, refresh, mobile submission and result display. Desktop/mobile screenshots were visually inspected; the screenshot capture is being adjusted to start at the top of the page so sticky headers do not appear midway through full-page captures.
- Admin session stability: source inspection shows the authorization effect is keyed by account/status, not the session object. Existing Auth.js focus refresh preserves authenticated status; the regression suite now explicitly checks unsaved draft preservation across three focus refreshes plus account-switch/sign-out removal. No global session revalidation was disabled. Record the new CI result before classifying this behavior as confirmed.

B2B billing/quotas/invoices, independent advertising payment evidence, complete aggregates/exports/rankings, unattended expired-attempt finalization and scale/backup/security acceptance remain incomplete. Provider OAuth and real API-backed browser flows, protected PDF upload/free/Pro workflows, jobs tracker encrypted-record acceptance and all live administrative mutations remain unverified. Legacy consumer quiz statistics remain client-reported practice data and are not used by the institute delivery/result APIs. **NOT READY**.

### Continuation: reporting and expiry (draft only)

`src/services/institutes/expiry.js` closes the abandoned-attempt grading gap through an opt-in background worker. `reporting.js` and `report-summary.tsx` add staff-scoped aggregate scores, completion, topic/section outcomes and bounded CSV exports. Verified locally with 299 unit tests, 17 real PostgreSQL tests and a production build. Browser acceptance is pending CI for this revision; deployed institute controls remain unchanged. Full institute-wide analytics, anonymized learner leaderboards, B2B billing/quota enforcement, independent advertising payment verification, load/restore exercises and authenticated deployed acceptance remain incomplete. Production status remains **NOT READY**.

### Institute billing implementation checkpoint — 12 November 2026 (IST)

Draft code now supplies private configurable plans/quotes, an owner billing workspace, provider-confirmed sandbox order reconciliation, immutable receipts, renewal/cancellation state and transactional capacity enforcement. The five manual migrations passed twice in the disposable database; 21 integration tests and 302 unit tests passed locally. This supersedes the earlier “not implemented” note for those code paths, but **does not** establish deployed billing or actual-provider settlement. Billing/quotas remain disabled by default and live institute charging is explicitly rejected. Advertising independent verification, platform-wide analytics/leaderboards, real-provider acceptance, deployed authenticated regression tests and recovery/load exercises remain blockers. See `EXAMPRO_INSTITUTE_BILLING_ACCEPTANCE.md`.

### Advertising hardening checkpoint — 12 November 2026 (IST)

Confirmed code weakness: legacy `adAction` accepted `paymentVerified: true` as its payment gate. New draft requires an independently fetched matching Cashfree PAID order, bound provider metadata, explicit owner creative approval, single-consumption verification record and audit history. Rejection, pause/resume, seven-day renewal and history-preserving deletion are implemented; literal-IP/local destination URLs are rejected. Institute routes are explicitly ad-free. Real PostgreSQL regression suite now passes 23 tests with simulated provider replies; build passes. Actual provider metadata/settlement compatibility, self-service advertiser checkout, refund operations and live browser acceptance remain unverified/incomplete. This is not approval to publish any ad.

### Consumer persistence checkpoint — 12 November 2026 (IST)

New real PostgreSQL tests verify existing bookmarks, notes and Government Jobs application records using two synthetic verified accounts. Concurrent bookmark upserts preserve one row; notes save/reopen; cross-account reads/removes/reveals/updates fail; application references are encrypted in storage and masked in normal responses; missing encryption configuration fails closed. All five integration tests passed. Confirmed hardening: bookmark/note responses now set private/no-store; input lengths match database limits and reject oversized/non-string notes before SQL. Existing stored records are untouched. These are local API/database results, not evidence of deployed OAuth or browser acceptance.

### Learner rankings checkpoint — 12 November 2026 (IST)

Institute students now have a private Batch rankings section. The API checks the selected current institute and exam assignment on every request, waits until the exam window closes, counts only current active student memberships, and computes ranks from server-graded immutable snapshot results. It returns a caller's own position, top results and tie-aware dense ranks without account IDs or names. Real PostgreSQL tests cover early denial, dual/cross-institute denial, seven-member fixture cohort, scores, revoked membership and hidden identity. This fills the previously identified institute leaderboard gap in code; public/deployed/browser acceptance remains pending.
