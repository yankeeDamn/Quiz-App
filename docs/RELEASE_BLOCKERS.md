# ExamPro — Release Blockers (prioritized)

**Date:** 1 November 2026 · **Baseline:** `main@880f488` · All items require explicit owner action; none were changed by this audit.

| # | Severity | Blocker | Environment | Evidence | Proposed fix / owner action |
|---|---|---|---|---|---|
| 1 | 🔴 Critical | Staging missing `exam_beta_invitations`, `exam_beta_feedback`, `exam_beta_invitation_audit` → beta invite/feedback endpoints broken in staging | Staging (Neon) | PR #73 read-only preflight | Owner verifies Neon branch identity, then applies `src/db/beta-invitations.sql` → `src/db/beta-feedback-audit.sql` in one transaction; run `npm run readiness:staging` |
| 2 | 🔴 Critical | Neon staging branch expiry unconfirmed — records conflict (2026-11-22 per PR #73 vs 2026-12-01 per owner note) | Staging (Neon) | PR #73 body vs owner brief | Owner checks Neon console; extend/protect branch and document backup before any beta testing |
| 3 | 🔴 Critical | SSC Mock 01/02: 0 academic approvals, 0 human Hindi verifications | Staging | PR #73 preflight | Independent subject review + bilingual review via existing review workflow; keep mocks inactive |
| 4 | 🟠 High | Render deploy auto-runs `db:migrate` (schema + seeds) on every build | Production (Render) | `render.yaml` buildCommand; `src/db/migrate.js` | Decide policy: keep idempotent auto-migrate, or move to explicit step; never add staging-manual SQL to it (`npm run audit:deployment` guards this) |
| 5 | 🟠 High | Staging frontend silently falls back to production API if `NEXT_PUBLIC_API_URL` unset | Staging (Vercel) | `exam-practice-pro/lib/api.ts`, `app/status/page.tsx` | Set `NEXT_PUBLIC_API_URL` for the staging Vercel project; consider failing closed for the staging hostname (Phase 2 PR) |
| 6 | 🟠 High | Live `/status`, `/api/v1/health/ready`, `/api/v1/mocks`, `/api/v1/government-jobs` unverified from this audit; `/api/v1/government-jobs` previously returned 404 deployed | Both | No outbound network in audit env | Owner runs the curl checklist in `docs/DEPLOYMENT_MATRIX.md` |
| 7 | 🟠 High | OAuth (Google/GitHub) callbacks, account switching, cross-device history unverified live | Both | No network | Manual QA script in `docs/DEPLOYMENT_MATRIX.md` §5 |
| 8 | 🟡 Medium | `render.yaml` blueprint name (`exam-practice-pro-api`) ≠ production host (`quiz-app-regd`) — blueprint/service linkage unverified | Production (Render) | `render.yaml` | Confirm in Render dashboard which service the blueprint manages |
| 9 | 🟡 Medium | Migration DB TLS uses `rejectUnauthorized: false` | Production | `src/db/migrate.js` | Accept (Neon-compatible) or pin CA; document decision |
| 10 | 🟡 Medium | Azure Translator region/credentials and live 4xx behaviour unverified | Production | Docs only | Owner verifies on Render env + one manual translation call in staging |
| 11 | 🟡 Medium | Production↔staging question drift (621 vs 820) unclassified | Both | Owner brief | Read-only record-level diff; classify drafts vs drift; never overwrite student history |
| 12 | ⚪ Low | Cashfree sandbox refund/reversal/chargeback and reconciliation process not yet exercised | Staging | `docs/PR64_CASHFREE_SANDBOX.md` | Phase 8 sandbox test matrix before any live-readiness discussion |

**Release gate summary:** nothing ships to production until blockers 1–7 are resolved with owner signoff. Draft mocks, beta features, and payments remain exactly as gated today.
