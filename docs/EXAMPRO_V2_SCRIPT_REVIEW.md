# ExamPro v2 script review and safe rollout

This change was developed after reviewing the uploaded `Apply Exampro V2.sh` (not executed). The current repository **already contains** a Next.js `/admin` dashboard, a Render service blueprint, PostgreSQL migrations, and the **same 120 questions** in `src/data/mock-bank.json` (10 topics × 12 questions).

## Why the uploaded script must not be applied directly

- It deletes `public/` and overwrites `src/routes/index.js`, the frontend `package.json`, `tsconfig.json`, and deployment configuration, risking regressions to current production pages, APIs and dependencies.
- Its new `POST /exams/admin/questions`, `GET /exams/admin/overview`, and `PUT /tenants/current` have **no authorization middleware**. Its `POST /exams/accounts/sync` allows arbitrary client-provided roles/phone numbers, and `GET /exams/progress` returns users' attempts without user scoping.
- It seeds a **second incompatible `users` schema** on an existing database: `CREATE TABLE IF NOT EXISTS users` does not add the new required columns. The existing `users` table is used by existing Auth.js-based account persistence and scoring.
- Its student frontend includes local answer keys and falls back to local grading when API requests fail, so it does not establish trustworthy server-side exam grading.
- It hardcodes a Render URL in frontend environment and rewrite files. Actual service URLs and secret values must be configured in Vercel/Render dashboards.

## Implemented safely here

- Existing database migration now checks/inserts missing starter content **every time** rather than skipping whenever any topic exists.
- Inserts use `ON CONFLICT DO NOTHING`, never overwriting edited, deactivated or custom questions.
- Tests verify source-bank count and repeatable conflict-safe seeding.
- No production database or hosting resources were changed. Seeding occurs only when the migration runs against the configured `DATABASE_URL`.

## Production validation checklist

1. Configure **Neon** with a PostgreSQL database; set `DATABASE_URL` as a secret only in Render, and create the Express API service with `npm ci --omit=dev && npm run db:migrate` and `npm start`.
2. Configure identical `AUTH_SECRET` values in Vercel and Render, OAuth credentials in Vercel, `ADMIN_EMAILS` and `CORS_ORIGINS` in Render, and `NEXT_PUBLIC_API_URL` in Vercel; redeploy both services.
3. Verify `/api/v1/health` returns `database: connected`; inspect Render migration logs for **10 topics / 120 questions / 11 mocks**.
4. Sign in to `/admin` with the approved GitHub/Google account, create/edit a question, then rerun migration and verify the edit persists.
5. Confirm the student mock catalogue, plan gating and attempts work. Merge/reconcile the separate attempt-persistence PR before claiming cross-device result persistence for mocks.
6. Before paid institute launch, implement authenticated tenant membership checks and server-only answer evaluation, then add integration tests on real PostgreSQL.

Do not deploy the uploaded shell script on `main` or run it against a production database.
