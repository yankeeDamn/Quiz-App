# ExamPro — Deployment Matrix & Live Verification Runbook

**Date:** 1 November 2026. This matrix records what is known from source/GitHub and gives the exact owner-run commands for everything that needs live verification. **Never paste tokens or connection strings into issues, PRs, docs or logs.**

## 1. Topology

| Layer | Production | Staging |
|---|---|---|
| Frontend | Vercel — https://quiz-app-virid-zeta-41.vercel.app | Vercel — https://exampro-staging-ui.vercel.app |
| API | Render — https://quiz-app-regd.onrender.com (`/status`, `/api/v1/health/ready`) | Same Render service style; confirm whether a separate staging service exists |
| Database | Neon `exampro-prod`, branch `production` | Neon branch `exampro-staging` (`br-snowy-heart-b5wjnd9e`) — **expiry unconfirmed** |
| Auth | Auth.js/NextAuth Google + GitHub → backend JWT bridge | Same |
| Payments | Cashfree — **not enabled** | Cashfree **sandbox only**, feature-gated |
| CI | GitHub Actions: backend (Node 18/20/22), frontend build, PostgreSQL integration, Docker | Same workflows on PRs |

## 2. Commit alignment checks (owner-run)

```bash
git rev-parse main                      # GitHub truth
# Frontend: open https://<frontend>/status → "Vercel Git commit" must match main
# Render: dashboard → service → latest deploy commit must match main
```

Mismatch → redeploy; check Vercel Production Domains and Render auto-deploy branch.

## 3. Environment variable contract

| Variable | Where set | Expected |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Vercel (each project) | Production UI → `https://quiz-app-regd.onrender.com`; staging UI → staging API URL. **If unset, the frontend silently falls back to the production API** (`lib/api.ts`). |
| `DATABASE_URL` | Render | Neon branch intended for that service; verify branch in Neon console, not by env var name. |
| `CORS_ORIGINS` | Render | Production service must include only the production frontend; staging-enabled draft features require the staging origin and forbid the production origin (`draft-testing-gate.js`). |
| `AUTH_SECRET`, `JWT_SECRET`, `ADMIN_EMAILS` | Render / Vercel | Present, distinct per environment. |
| Azure Translator key/region | Render only | Never in the frontend; verify region matches the resource. |
| Cashfree sandbox keys | Render (staging-flagged service) | Sandbox only; never live keys in staging flags. |

## 4. Endpoint smoke checks (owner-run, read-only)

```bash
API=https://quiz-app-regd.onrender.com
curl -fsS $API/status ; echo
curl -fsS $API/api/v1/health/ready ; echo      # expect 200, database connected
curl -fsS $API/api/v1/mocks | head -c 400     # public catalogue, no answer keys
curl -fsS -o /dev/null -w '%{http_code}\n' $API/api/v1/government-jobs   # must not be 404
curl -fsS -o /dev/null -w '%{http_code}\n' $API/api/v1/beta/access       # expect 401/403 unauthenticated — not 500
```

Repeat against the staging API origin. Expect: 200s above, no 5xx, no answer keys in `/mocks`, security headers present (`curl -sI`).

## 5. OAuth / session manual QA

1. Anonymous: browse catalogue OK; hitting a protected endpoint returns 401, not 500.
2. Authorized Google account: sign in, start a practice attempt, refresh → answers persist; second device shows same history.
3. GitHub account + account switching: sign out/in as a different user → no cross-account data bleed.
4. Unauthorized (non-allowlisted) account → admin routes 403.
5. Rate limiting: burst a public endpoint → eventual 429 with JSON error, not a crash.

## 6. render.yaml safety

- `buildCommand: npm ci --omit=dev && npm run db:migrate` — every deploy migrates and seeds (idempotent). Review per Release Blocker #4.
- `healthCheckPath: /api/v1/health/ready` — correct.
- Blueprint name `exam-practice-pro-api` vs live host `quiz-app-regd` — verify linkage before trusting blueprint changes (Blocker #8).
- Staging-manual SQL (`beta-invitations.sql`, `beta-feedback-audit.sql`, `cashfree-sandbox.sql`) is **not** in `db:migrate` and must stay out — enforced by `npm run audit:deployment`.

## 7. Neon operations (owner-only)

1. Confirm branch identity in the Neon console before **any** SQL: project `exampro-prod`, branch `exampro-staging`.
2. Confirm/extend staging expiry and snapshot/backup before migrations.
3. Apply staging SQL in order, one transaction each: `beta-invitations.sql` → `beta-feedback-audit.sql`.
4. Validate: `\d exam_beta_invitations`, indexes, FKs; then `EXAMPRO_ENV=staging STAGING_PREFLIGHT_BRANCH=exampro-staging DATABASE_URL=<staging> npm run readiness:staging`.
5. `EXAMPRO_ENV=staging` alone does **not** prove branch identity.
