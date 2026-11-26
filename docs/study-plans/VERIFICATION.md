# Verification evidence

Review baseline: `031cde665b1349bcd11ffd03ef6963f37569e30b`. All databases below were newly created, isolated local PostgreSQL databases. No production configuration, payment provider, content, database, merge or deployment was changed.

| Check | Result |
|---|---|
| `npm ci` (backend and frontend) | Passed with existing lockfiles; no dependency changes |
| `npm test` | 325 passed, 0 failed (320 existing + 5 new unit tests) |
| Baseline migrations + `study-plans.sql` applied twice | Passed on isolated PostgreSQL 19 |
| `STUDY_TEST_DATABASE_URL=... node --test test/study-plans-postgres.integration.js` | 8 passed, 0 failed (lifecycle with 7 subtests) |
| Existing `ebooks-postgres.integration.js` | 11 passed, 0 failed |
| Existing `question-workflow-postgres.integration.js` | 2 passed, 0 failed |
| Existing `consumer-postgres.integration.js` | 5 passed, 0 failed |
| Existing `monetization-payments-postgres.integration.js` | 12 passed, 0 failed; synthetic provider only |
| Frontend `./node_modules/.bin/tsc --noEmit` | Passed |
| ESLint on new Study Plan frontend files | Passed |
| Full frontend `npm run lint` | 42 errors, 33 warnings; identical counts reproduced in a clean worktree at baseline |
| Frontend `npm run build` | Compiled and generated routes. First run stopped at the installed Next.js security advisory; retry completed with the same advisory warning. Dependency unchanged; address before production release. |
| `git diff --check` | Passed |

The root `npm run lint` is an existing no-op (“No linter configured”), not evidence of backend lint coverage. An initial root-level `npx tsc` invoked an unrelated CLI because TypeScript is installed in the frontend; the actual frontend compiler was then run successfully.

The local database runtime was installed outside the repository solely for tests; it adds no application dependency. Existing migrations and tests ran against fresh databases, never a reused production URL. Payment regression used synthetic credentials and a mock provider.

## Covered behavior

- Canonical active Pro access, expired and revoked balance rejection, exam-pass exclusion, and explicit institute-plus-Pro scope.
- Admin authorization with verified OAuth; ordinary students and guests denied.
- Draft creation/editing and isolation; stable hierarchy and ordering; explicit publication acknowledgement and revision check.
- Private PDF upload validation, existing storage reuse, direct preview/read/download enforcement for Free/expired/pass/revoked accounts, and full authorized Pro delivery.
- Valid/invalid PYQ imports, duplicate rejection, unverified-by-default provenance, linking existing question IDs, and answer explanations.
- Enrollment date validation, completion idempotency, persisted task timestamps, cross-user write rejection, manual completion, and missed-day access.
- Immutable published editions, cloning, syllabus edit protection, archival with retained student progress.

## Still required before production

- Real staging OAuth and two-device acceptance with the owner's actual configuration.
- Complete SSC content, appropriate official-source/amendment review and licensed PYQ/PDF editorial approval.
- Existing frontend lint cleanup and an approved Next.js security update.
- Explicit approval for any deployment, production migration, publication or merge.

## Browser attempt

`node scripts/study-plans.browser.cjs` could not complete in the execution environment: Next dev initially encountered a restricted network-interface enumeration, and the system Chromium launcher pointed to a missing binary. An attempted Playwright browser download was rejected by the network. The browser fixture script is supplied for staging/local execution, with explicit loopback binding and an optional CHROMIUM_PATH. No visual or browser-interaction pass is claimed.
