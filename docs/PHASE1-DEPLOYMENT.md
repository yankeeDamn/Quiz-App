# ExamPro Phase 1 — deployment and end-to-end verification

## What is confirmed

The repository has a Render Blueprint in `render.yaml` defining an Express API, a Next.js frontend, and PostgreSQL. This is **configuration only**, not evidence that a Render service or database exists. GitHub CI tests/builds do not deploy the application. The Vercel frontend may be independently deployed.

## Provision (requires owner access to hosting accounts)

1. Open Render Dashboard > New > Blueprint and connect `yankeeDamn/Quiz-App` using `render.yaml`. Check the PostgreSQL plan and current Render pricing/availability before accepting. If the free database plan is unavailable, select a supported low-cost plan. Keep database and API in the same region. Do not create a second database if an existing production DB is in use.
2. Set API environment: `DATABASE_URL` (Render database connection), `AUTH_SECRET` (same as frontend), `JWT_SECRET` (strong random value), `ADMIN_EMAILS` (your OAuth email), `CORS_ORIGINS` (exact frontend origin). Optional: `ADMIN_API_KEY` (long random secret). Never commit secrets or expose the database URL to the browser.
3. The API build command runs `npm run db:migrate`. Confirm migrations and starter content seeding succeed in Render build logs before allowing production traffic.
4. In Vercel, ensure Root Directory is `exam-practice-pro`. Set `NEXT_PUBLIC_API_URL` to the **public HTTPS API origin** (no trailing `/api/v1`), `AUTH_SECRET`, `NEXTAUTH_URL` (your Vercel origin), and OAuth provider credentials. Add the Vercel URL to OAuth callback allowlists; configure the same frontend origin in API `CORS_ORIGINS`.
5. Redeploy API and frontend. `GET /api/v1/health` checks process liveness; `GET /api/v1/health/ready` checks database readiness and returns HTTP 503 when PostgreSQL is unavailable.

## Smoke checks (read-only)

From the repo root, in PowerShell:

```powershell
$env:API_URL = 'https://YOUR-API.onrender.com'
$env:FRONTEND_URL = 'https://quiz-app-virid-zeta-41.vercel.app'
node scripts/smoke-production.mjs
```

The script checks database readiness, mock catalogue, anonymous admin denial, and HTTP availability of frontend routes. It **does not** prove OAuth, payment, question writes, or attempt persistence.

## Owner-verified end-to-end acceptance

- [ ] Sign in with the email listed in `ADMIN_EMAILS`; confirm `/admin` works, while another account is denied.
- [ ] Create a new topic and one original test question in the admin Questions tab; refresh the browser and verify the question remains.
- [ ] Create a free mock test using that topic, make it active, and verify it appears at `/india-mocks`.
- [ ] Complete the test as a signed-in learner; verify result display. **Current mock engine computes results in the browser; persistent attempt saving must be implemented and verified before claiming end-to-end persistence.**
- [ ] Verify server-side attempt history once persistence is wired, then restart API and verify it survives.
- [ ] Confirm paid mock access is denied to unpaid users and allowed only to authorized active-plan users.
- [ ] Confirm no secret tokens or answer keys leak through public catalogue responses.

## Next implementation PR

Implement secure server-side mock attempt submission and history: authenticate user, validate test and answer IDs server-side, score against database answers, store a transactionally consistent attempt, and expose learner history. Do not trust browser-provided scores or permit public mock APIs to mutate attempts.
