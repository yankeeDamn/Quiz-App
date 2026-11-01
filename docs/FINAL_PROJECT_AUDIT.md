# ExamPro — Final Project Audit (Phase 0)

**Audit date:** 1 November 2026
**Auditor:** GitHub Copilot coding agent (source-tree and GitHub inspection only)
**Baseline:** `main` at `880f4883531fb962ba4e32355f200222f06446af`; latest `main` GitHub Actions run: success.
**Reference:** Draft PR #73 (`audit/staging-release-readiness-20261102`) — reused, not duplicated.

## 1. Scope and method

This audit is **read-only**. No database, deployment, payment, publication or user-data change was made or attempted. Evidence sources:

- GitHub: `main` HEAD, open PRs, recent workflow runs (via `gh`).
- Source tree: `render.yaml`, `src/app.js`, `src/db/migrate.js`, `src/db/*.sql`, `src/routes/*`, `src/services/*`, `exam-practice-pro/lib/api.ts`, `exam-practice-pro/app/status/page.tsx`, existing tests and docs.
- Draft PR #73's read-only Neon staging preflight results.

**Limitation:** the audit environment has no outbound network access, so production/staging URLs, Neon branches, Render and Vercel dashboards could **not** be live-verified here. Every runtime claim below is marked accordingly and has an owner verification command in `docs/DEPLOYMENT_MATRIX.md`. GitHub CI passing is **not** treated as runtime verification.

## 2. Deployment inventory (claimed vs verified)

| Component | Claimed | Verified here | Status |
|---|---|---|---|
| GitHub `main` SHA | `880f488…` | Yes (`git log`, `gh`) | Fully verified |
| `main` CI | passing | Yes (latest run success, 1 Nov 2026) | Fully verified |
| PR #73 CI | passing | Yes (run of 1 Nov 2026, success) | Fully verified |
| Production frontend (Vercel) | quiz-app-virid-zeta-41.vercel.app | No (no network) | Awaiting manual QA |
| Production API (Render) | quiz-app-regd.onrender.com | No (no network) | Awaiting manual QA |
| Staging frontend (Vercel) | exampro-staging-ui.vercel.app | No (no network) | Awaiting manual QA |
| Neon production branch | `production` | No | Awaiting manual QA |
| Neon staging branch | `exampro-staging` (`br-snowy-heart-b5wjnd9e`) | No | Awaiting manual QA |
| Neon staging expiry | Prompt: 2026-12-01 19:20 UTC; PR #73 recorded 2026-11-22 | **Conflicting values** | **Blocker — owner must confirm in Neon console** |

Deployment SHAs for Vercel/Render cannot be read from this environment. Owner: compare the frontend `/status` page commit (it renders `VERCEL_GIT_COMMIT_SHA`) with `git rev-parse main`, and the Render service's deploy SHA in the Render dashboard.

## 3. Feature classification

| Feature | Classification | Evidence |
|---|---|---|
| Public exam catalogue & practice | Implemented, awaiting manual QA | `src/routes/mocks.js`, tests `mocks.test.js` |
| Owner admin dashboard, imports, editing | Implemented, awaiting manual QA | `src/routes/admin*`, `admin-*.test.js` |
| Timed attempts, saved answers, server grading | Implemented, awaiting manual QA | `exam-sessions.test.js`, `exam-grade.test.js` |
| Sectional timers (SSC) | Implemented, awaiting manual QA | `docs/SSC_CGL_SECTION_TIMER_IMPLEMENTATION.md` |
| SSC CGL Mock 01/02 draft banks (4×25, inactive) | Implemented — **must stay inactive** | `docs/PR62_MOCK01_02_STAGING_AUDIT.md`; 0 academic approvals recorded |
| Hindi/Bangla translation APIs | Implemented, awaiting manual QA | `azure-on-demand-translation.test.js`, `docs/AZURE_LIVE_EXAM_TRANSLATION.md` |
| Pro analytics, manual plan grants | Implemented, awaiting manual QA | `manual-grants-pr65.test.js` |
| Cashfree **sandbox** checkout + signed webhook | Implemented — sandbox only | `cashfree-sandbox.test.js`, `docs/PR64_CASHFREE_SANDBOX.md`; raw body mounted before `express.json` (`src/app.js`) — verified |
| Government jobs page/API | Implemented, awaiting manual QA — previously returned 404 on the deployed route | `government-jobs.test.js`, `docs/PR66_GOVERNMENT_JOBS.md` |
| IT certification tracks (10) + ebooks | Implemented, awaiting manual QA | `it-certification-pr63-expansion.test.js`, `ebooks.test.js` |
| Beta invitations + feedback | Implemented in code; **staging schema missing** → Broken in staging until owner-approved SQL runs | PR #73 preflight: `exam_beta_invitations`, `exam_beta_feedback`, `exam_beta_invitation_audit` absent |
| Institute (`pilot_*`) tables | Foundation only; institute product **Incomplete** | `src/db/pilot-schema.sql`, institute records = 0 |
| Production payments | Deferred — requires merchant/security/legal signoff | — |

## 4. Confirmed source-level findings

See `docs/RELEASE_BLOCKERS.md` for severity/owner actions. Source-verified facts:

1. `render.yaml` `buildCommand` runs `npm run db:migrate` on **every** Render deploy; `migrate.js` applies schema **and seeds content** (starter, competitive, ebooks). It is idempotent by design, but schema/content change on deploy is automatic, not operator-gated.
2. `render.yaml` blueprint service name is `exam-practice-pro-api`; the documented production host is `quiz-app-regd.onrender.com`. It is unverified whether the blueprint actually controls the live service.
3. `exam-practice-pro/lib/api.ts` falls back to the **production** API origin when `NEXT_PUBLIC_API_URL` is unset in a production build. A staging Vercel deployment missing that variable would silently call the production API. The `/status` page mirrors the same fallback.
4. `src/db/migrate.js` does **not** reference `beta-invitations.sql`, `beta-feedback-audit.sql` or `cashfree-sandbox.sql` — correct; these stay staging-manual-only.
5. Cashfree webhook raw-body parser is mounted before the general JSON parser (`src/app.js`) — correct.
6. Draft/beta features fail closed: `draft-testing-gate.js` requires staging environment, staging origin present and production origin absent — verified in source.
7. `.env` is git-ignored; no PostgreSQL credentials found in scanned tracked sources.
8. Production TLS for migrations uses `rejectUnauthorized: false` (Neon-compatible but weakens verification).

New guard: `npm run audit:deployment` (`scripts/deployment-safety-audit.js`) re-checks invariants 4–8 and fails closed on critical regressions. It is read-only.

## 5. Migration SQL review (Phase 1 readiness)

Both files are idempotent (`IF NOT EXISTS`), staging-labelled, and correctly ordered:

1. `src/db/beta-invitations.sql` — creates `exam_beta_invitations`. FKs: `mock_tests(id)` `ON DELETE CASCADE`, `users(id)` `ON DELETE SET NULL`. Uses `gen_random_uuid()` → requires the `pgcrypto` extension (already created by `migrate.js`; confirm with `SELECT * FROM pg_extension WHERE extname='pgcrypto';` before applying).
2. `src/db/beta-feedback-audit.sql` — creates `exam_beta_feedback` (FKs to `mock_tests`, `users`) and `exam_beta_invitation_audit` (FK to `exam_beta_invitations`). **Must run after** `beta-invitations.sql`.

Neither file is in the auto-migrate path; keep it that way. Execute only after owner approval, inside one transaction, on the verified `exampro-staging` branch, then run `npm run readiness:staging` (PR #73 tooling).

## 6. Data reconciliation note

The 621 (production) vs 820 (staging) question difference is **not** authorization to copy data. Record-level diff must be produced read-only (e.g., compare `topic_id, position, updated_at` per question) and drafts vs drift classified before any owner-approved action. Student history (`quiz_attempts`, `exam_attempts_v2`, `scores`, `bookmarks`, `notes`, `user_stats`) must never be overwritten by content reconciliation.

## 7. What was NOT verified (requires owner/manual QA)

- All live HTTP endpoints, SSL, OAuth sign-in (Google/GitHub, authorized/unauthorized/anonymous), CORS, cookies.
- Render → Neon branch identity and connection string.
- Vercel `NEXT_PUBLIC_API_URL` values in production and staging projects.
- Azure Translator resource region, credential health, live 4xx behaviour.
- Cashfree sandbox dashboard state.
- Neon staging branch expiry (conflicting records: 2026-11-22 vs 2026-12-01).

Runbook for these checks: `docs/DEPLOYMENT_MATRIX.md`.
