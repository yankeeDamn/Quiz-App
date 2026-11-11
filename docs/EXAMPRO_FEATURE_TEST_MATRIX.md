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
