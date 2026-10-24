# ExamPro Phase 1: deployment and verification

## Current known state

The repository contains a Render blueprint (`render.yaml`) for the Express API, Next.js frontend, and PostgreSQL. **This file does not prove any Render services have been created.** The Vercel frontend is a separate deployment and will not deploy the Express API automatically. Never commit credentials or database URLs.

## Provision PostgreSQL and the API

1. In Render, create a Blueprint from this GitHub repository and review the three resources defined in `render.yaml`: `exam-practice-pro-api`, `exam-practice-pro-frontend`, and `exam-practice-pro-db`. Check current Render plan availability and pricing before confirming; the plan in YAML may need updating.
2. Set `AUTH_SECRET` to the **same strong random value** on API and frontend. Set `ADMIN_EMAILS` to your authenticated admin email; optionally set a random `ADMIN_API_KEY` (24+ characters). Configure `CORS_ORIGINS` with the exact Vercel frontend origin, without a trailing slash.
3. Configure Google or GitHub OAuth client credentials on the frontend, with callback URLs for its public hostname. Set `NEXTAUTH_URL` to that hostname.
4. If retaining Vercel for Next.js, configure `NEXT_PUBLIC_API_URL` to the public **HTTPS API hostname** in Vercel Project Settings → Environment Variables, and redeploy. Set `AUTH_SECRET`, `NEXTAUTH_URL`, and the chosen OAuth provider credentials there too. The Render-hosted Next.js frontend is optional; do not pay for duplicate frontend hosting unless needed.
5. Run `npm run db:migrate` against the provisioned database, using `DATABASE_URL` in the API environment. Render's API build command also runs migrations. Confirm the migration succeeds in deployment logs.

## Smoke-test checklist

- [ ] `GET https://YOUR-API/api/v1/health` responds HTTP **200** with `data.database: connected`. HTTP **503** means the database is not ready.
- [ ] `GET https://YOUR-API/api/v1/mocks` returns a catalogue with no answer keys.
- [ ] Open `https://YOUR-FRONTEND/admin` and sign in with the email in `ADMIN_EMAILS`. Create a test question and mock; verify they appear in the public catalogue. Confirm an unrelated account cannot edit content.
- [ ] Sign in as a student, open a free mock, answer questions and submit. The result page should show **Result saved to your account**; an error is explicitly displayed if persistence fails.
- [ ] Refresh the student's dashboard/attempt history and verify the saved attempt is present in PostgreSQL. Repeat with a second user to verify attempts are private.
- [ ] Verify a premium mock is blocked for a signed-out/free user and accessible after an authorized plan grant.
- [ ] Run `npm test` from the repository root and `npm run build` inside `exam-practice-pro`.

## Limitations before commercial launch

The existing admin is an **owner** admin, not a multi-tenant institute dashboard. Institute-scoped roles, batch assignments, rankings, independent institute branding and billing still require implementation. Client-calculated mock scores are suitable for learner feedback, but **not trusted competitive rankings**: a production ranking workflow must accept raw answers and score them on the server without exposing answer keys before submission. The demo auth endpoint must not be treated as production-grade credential login.
