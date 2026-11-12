# Feature test matrix

Evidence date: 10 November 2026. **NOT READY** until all launch-critical columns pass. The full feature inventory is in EXAMPRO_FULL_FEATURE_AUDIT.md.

| Layer / feature | Current evidence | Remaining acceptance |
| --- | --- | --- |
| Baseline backend | 286/286 pass before changes | Preserve all suites as routes grow |
| API routing/pricing fix | 289/289 pass after PR A; production build passes | Staging missing/wrong env and learner/PDF proxy browser checks |
| Institute policy | 4 added unit tests pass | Do not substitute role-unit tests for DB/API isolation |
| Foundation real PostgreSQL | Runnable CI job + guarded integration test | Record actual job results in PR; never report unexecuted test as pass |
| Two-institute membership | Fixture includes owner/teacher/10 students each, dual membership, FK constraints | API question/exam/results denial must accompany delivery implementation |
| Consumer exams | Existing sessions/grading/access/editorial suites pass | Authenticated full journey with saved result on a second device |
| Admin controls | Existing synthetic browser script | Real API-backed CRUD and tab-switch persistence |
| PDF/ebooks | Existing unit and CI PostgreSQL tests | Uploaded free preview, entitled full PDF, denied direct fetch, create/save/reopen |
| Jobs tracker | Existing tests and deployed anonymous My Applications tab | Named environment SQL/key readiness; two-user CRUD/reveal isolation |
| Payments/ads | Existing sandbox/monetization tests; production feature disabled | Real sandbox lifecycle, invalid signature, duplicate event, refund/cancel/expiry, moderated creative and verified payment audit |
| Accessibility/responsive | Public live desktop-width browser observations only | Keyboard/focus, labels, error states, 390px layout, dark mode and screen reader checks |
| Operations | Read-only revision and health evidence | Staging frontend parity, Neon branch identity, backups/restores, vulnerability scan, capacity and owner signoff |

Real OAuth sign-in is not simulated by using a synthetic signed token. The DB integration test uses the real backend identity verifier with synthetic tokens and synthetic users; a provider callback test is separate.
