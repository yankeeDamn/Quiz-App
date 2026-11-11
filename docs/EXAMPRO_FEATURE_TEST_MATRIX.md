# Feature test matrix

Evidence date: 10 November 2026. **NOT READY** until all launch-critical columns pass. The full feature inventory is in EXAMPRO_FULL_FEATURE_AUDIT.md.

| Layer / feature | Current evidence | Remaining acceptance |
| --- | --- | --- |
| Baseline backend | 286/286 pass before changes | Preserve all suites as routes grow |
| API routing/pricing fix | 289/289 pass after PR A; production build passes | Staging missing/wrong env and learner/PDF proxy browser checks |
| Institute policy | 4 added unit tests pass | Do not substitute role-unit tests for DB/API isolation |
| Foundation real PostgreSQL | #90 CI PostgreSQL 16: 7/7 passed; #91 repeated the pass | Provider sign-in and deployed schema/config acceptance |
| Two-institute delivery | Local disposable PostgreSQL 18: 15/15 passed; 296/296 unit tests passed. #92 CI run 42821826044 passes, including PostgreSQL 16 | Real OAuth/API-backed browser runner and rankings acceptance |
| Private content and attempts | Real API tests cover private CRUD/CSV, independent review, assigned publication, immutable snapshots, duplicate starts/submits, cross-tenant IDs, persisted autosave, stale revisions, server grading/deadlines, teacher-scoped reports and membership removal | Teaching/learner UI, scheduled finalization worker, aggregate/export/leaderboard features and capacity tests |
| Consumer exams | Existing sessions/grading/access/editorial suites pass | Authenticated full journey with saved result on a second device |
| Admin controls | Existing synthetic browser script | Real API-backed CRUD and tab-switch persistence |
| PDF/ebooks | Existing unit and CI PostgreSQL tests | Uploaded free preview, entitled full PDF, denied direct fetch, create/save/reopen |
| Jobs tracker | Existing tests and deployed anonymous My Applications tab | Named environment SQL/key readiness; two-user CRUD/reveal isolation |
| Payments/ads | Existing sandbox/monetization tests; production feature disabled | Real sandbox lifecycle, invalid signature, duplicate event, refund/cancel/expiry, moderated creative and verified payment audit |
| Accessibility/responsive | #91 CI run 42821713244 passes: admin and institute navigation, invitations, role controls, mobile width and screenshots. Teaching/runner browser script added in the next draft | Record teaching/runner CI result; full API-backed browser journey, screen reader and accessibility scan |
| Operations | Read-only revision and health evidence | Staging frontend parity, Neon branch identity, backups/restores, vulnerability scan, capacity and owner signoff |

Real OAuth sign-in is not simulated by using a synthetic signed token. The DB integration test uses the real backend identity verifier with synthetic tokens and synthetic users; a provider callback test is separate.

### Reporting / expiry continuation — 2026-11-11

- Local unit suite: **299/299 PASS**.
- Disposable PostgreSQL 18 suite: **17/17 PASS** (two institutes, repeated additive migrations, concurrent worker finalization, grading, revoked access, report authorization, CSV formula protection).
- Next.js production build with loopback-only synthetic configuration: **PASS**.
- Browser script now checks mobile batch aggregates and authorized CSV download. New browser run pending CI; prior institute delivery UI CI #42872627737 passed before this change.
- GitHub checks on external CI-setup commits for PRs #90/#94 are `action_required`, not passing runs. Earlier installation failures occurred in browser dependency installation. Do not infer browser acceptance from unit/build success.
- No live migration, deployment, content publication, or paid entitlement change.

### Institute billing continuation — 12 November 2026 (IST)

- Unit suite: **302/302 PASS** locally; includes plan validation, expiry and production billing denial.
- Disposable PostgreSQL 18: **21/21 PASS**; repeated five-migration sequence; real raw webhook HTTP/HMAC with simulated provider; concurrent webhook/polling, one receipt, consumer plan preservation, tenant denial, quota races, renewal and cancellation.
- Next.js production build: **PASS**. Browser scripts parse successfully.
- Local browser attempt: **BLOCKED**, Chromium `socket() failed: Operation not permitted`. GitHub PR #95 run 43096372117 was queued at the latest check. New billing/browser assertions have not yet run successfully.
- Cashfree provider calls are stubbed only inside the integration test. No real payment, provider credentials, deployment or live migration was used.

### Advertising verification continuation — 12 November 2026 (IST)

- Disposable PostgreSQL 18: **23/23 PASS**, including payment-bound advertising moderation and session metric deduplication. All schemas reapplied twice.
- Focused advertising + existing monetization unit tests: **18/18 PASS**.
- Next.js production build: **PASS**.
- Institute billing final bounded unit rerun: **302/302 PASS**, resolving the earlier unfinished rerun. New advertising full-suite run recorded separately when complete.
- Actual Cashfree order tags/merchant workflow, settlements, ad UI browser checks and live acceptance: **NOT VERIFIED**.

Advertising full local unit run: **304/304 PASS**, no failures/skips. Added synthetic browser assertions that publication remains disabled before provider verification, then uses a specific verified payment ID (never the legacy checkbox). Browser execution is pending CI; no screenshot pass is claimed yet.

### Existing consumer workflows — 12 November 2026 (IST)

- New disposable `consumer_tests` PostgreSQL 18 suite: **5/5 PASS**. Exact users/bookmarks/notes table definitions reused without executing content seeds; application migration applied twice.
- Existing unit suite after bookmark validation/cache changes: **304/304 PASS**.
- CI adds an independent PostgreSQL 16 consumer job with loopback/name guard. No production/staging connection is accepted by the test.
- Coverage: anonymous denial, no-store, concurrent bookmark upserts, reload persistence, two-account isolation, notes CRUD/length validation, encrypted/masked/revealed job references, safe reference removal, ownership foreign keys and missing-key fail-closed behavior.
- Browser login/session recovery and deployed acceptance remain separate unverified gates.

### Institute learner rankings — 12 November 2026 (IST)

- Disposable PostgreSQL 18 institute suite: **24/24 PASS**, including rankings before/after the scheduled end, current active membership, denied teacher/cross-tenant/revoked access, participant counts, score ordering, self rank and no account identifiers.
- Next.js production build: **PASS** with learner Batch rankings menu/section.
- Institute browser journey now asserts ranking lock before close and anonymous ranking display after close; CI run pending.
- Names are hidden but exact scores/ranks can still identify a person in a small cohort; this is permission-limited pseudonymous display, not statistical de-identification.
