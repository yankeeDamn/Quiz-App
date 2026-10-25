# ExamPro unified milestone — Vercel + existing Render API + external Neon

**Status:** Code proposed in draft PR #21; no production changes made. These steps require owner configuration and a separate live end-to-end test. Never paste credentials into tickets, chat, screenshots or GitHub.

## Current architecture / audit

- **One repository:** `yankeeDamn/Quiz-App`.
- **One frontend:** Next.js 16.4.3, Auth.js/next-auth 5.0.0-beta.30, `exam-practice-pro/` on Vercel, production origin `https://quiz-app-virid-zeta-41.vercel.app`.
- **One backend:** Express `src/server.js` at repository root, intended for Render; its Render blueprint entry was `exam-practice-pro-api`. `https://quiz-app-regd.onrender.com` is owner-supplied but cannot be verified as an API with available public reads. It might be a frontend; inspect the service in the Render dashboard before changing it.
- **One database:** external Neon PostgreSQL via `DATABASE_URL` on Render; no duplicate Render DB. Credentials have **not** been installed or checked.
- Existing `/admin` question/plan/test editor, `mock_topics`, `mock_questions`, `mock_tests`, `users`, and `quiz_attempts` are reused. The existing standalone `exampro/index.html` is retained as a historical source, but `/exampro` and `/exampro/demo` redirect to native `/india-mocks`; no remote HTML iframe is served.
- The local quiz engine on `/` and bundled `data/quizzes.ts` remain legacy local practice. Bundled certification starters remain original **practice-only** questions pending expert review, not database-managed published exams; do not advertise them as synced scored certification exams. Future data migration should preserve their original external IDs.

## Routes

| Route | Role |
| --- | --- |
| `/` | ExamPro homepage, existing local quiz content and links |
| `/india-mocks` | Database-backed published mock catalogue |
| `/india-mocks/:id` | Signed-in, server-scored timed attempt |
| `/india-mocks/topic-...?...mode=practice` | Explicit unscored topic practice with explanations |
| `/certifications` | Original bundled IT certification practice; free / unscored |
| `/dashboard` | Synced attempts plus explicitly local legacy progress |
| `/dashboard/attempts/:id` | Own saved answer review |
| `/admin` | Owner-only question, CSV, mock publishing and plans |
| `/institutes` | Institute onboarding and roadmap |
| `/institute-admin` | **Preview only.** Does not write to database or grant institute roles |
| `/auth/signin` | Shared Auth.js login |
| `/exampro`, `/exampro/demo` | Redirect to native catalogue; historic URLs preserved |

## Authentication & trust

Only Google/GitHub providers with configured `AUTH_*_ID` and `AUTH_*_SECRET` are shown. Auth.js v5 signs an HTTP-only session. The Next.js backend-token handler mints a short-lived HS256 token using **server-side** `AUTH_SECRET`; Express verifies it and upserts only a user with a verified provider/email. Google verification uses OAuth `email_verified`; GitHub verification requests `/user/emails` from GitHub with an ephemeral OAuth access token and requires a verified address. The access token is **not stored in the session, client or logs**.

Administrative endpoints enforce `ADMIN_EMAILS` on the **Express server** with the verified bearer identity; guest accounts and unapproved users are denied. Optional `ADMIN_API_KEY` is only for a private CLI use. Browser callback URLs are same-origin only. Guest practice remains local and does not create persistent scored attempts.

## API contracts and security

- `GET /api/v1/health`: API liveness, JSON `data.database=connected|unavailable`. Liveness can be 200 even without PostgreSQL.
- `GET /api/v1/health/ready`: HTTP 503 if database or backend authentication config is unavailable; shows which layer is missing. Use for Render health checks **after** Neon config is in place.
- `GET /api/v1/mocks`: published live catalogue only, no answer keys.
- `GET /api/v1/mocks/:id`: published authorized test, **no `answer` or `explanation`** fields.
- `GET /api/v1/mocks/:id/practice`: intentionally unscored topic-practice endpoint (reveals explanations); use only with the legacy practice UI.
- `POST /api/v1/exam-attempts/start`, body `{testId}`: authenticated verified identity required; returns existing open attempt if one exists, otherwise creates an immutable server-only snapshot and server deadline.
- `GET /api/v1/exam-attempts/:id`, `PUT .../:id/progress` (body `{responses:{questionId:optionIndex}}`), `POST .../:id/submit`: each checks `user_id`. Server grades snapshot answers and configured negative marking and pass percentage; idempotent submit uses row lock. Expired submissions use previously saved responses and **discard late changes**.
- `GET /api/v1/exam-attempts`: own 100 recent attempts, no answer key until submitted.
- `POST /api/v1/admin/topics/:id/questions/preview` validates 1–200 question records and detects duplicates; `POST /api/v1/admin/topics/:id/import` repeats validation under an advisory transaction lock and either inserts all rows or none. Downloadable CSV template with one original example on admin UI. Import duplicates are checked within the selected topic, not across unrelated topics.
- `GET /api/v1/admin/tests/:id/preview`: admin-only effective question count/preview; new tests start as drafts; only a test with active questions may be published. Existing published records are left as-is.

**Legacy limitation:** The older `POST /api/v1/quiz/attempts` and locally bundled quiz content still support browser-supplied result information for historical/local practice; **do not treat legacy scores as certified rankings**. New scored ExamPro mocks use only `/exam-attempts`. Existing topic practice may share questions with scored tests; for high-integrity exams use distinct question banks and server-side proctoring (future milestone).

## Migration, seeding & data compatibility

The existing migration `npm run db:migrate` creates original tables and the institute pilot tables. This PR adds `src/db/exampro-v2.sql` **after** existing migrations and uses additive operations:

- `mock_questions.difficulty` with a default
- `mock_tests.pass_percent` with a default of 50
- `exam_attempts_v2` and scoped indexes, with server-side answer snapshots

The original `quiz_attempts`, user records, IDs, old `mock_tests` and paid plans are **not dropped**. Seed code taken from draft PR #18 verifies 10 topics and 120 questions, inserts with `ON CONFLICT DO NOTHING`, and leaves edited questions unchanged. Run migration repeatedly only after taking a database backup and reviewing its output.

**Roll back application:** Redeploy the previous known-good commit/Render and Vercel builds; additive DB columns/table can stay unused. **Do not drop `exam_attempts_v2`** after students take tests or their results will be lost. If a destructive rollback is ever necessary, use a verified Neon backup/restore plan and maintenance window. Do not merge PR #18 or #17 on top of this branch without reconciling the overlapping migration and browser-scored code.

## Render service role check (before entering DATABASE_URL)

Open the existing `https://quiz-app-regd.onrender.com` entry in Render dashboard. Check **type=Web Service, root directory (should be repository root for API), build command, start command and deployment logs**.

PowerShell:
```powershell
Invoke-RestMethod https://quiz-app-regd.onrender.com/api/v1/health
Invoke-RestMethod https://quiz-app-regd.onrender.com/api/v1/health/ready
```
- An API instance returns JSON `success` and `data.status` for `/health` endpoint; `/ready` is 503 without Neon (expected until configured).
- HTML/Next.js or 404 at `/api/v1/health` means **do not assume this URL is the API**. Check the existing Render service and correct its settings/root; do not deploy a duplicate frontend or database.
- Prefer configuring an existing Express API service rather than a second paid service. `render.yaml` describes only the legacy-named API `exam-practice-pro-api`, external Neon DB, and no Next.js Render service. Do **not** apply a Blueprint if that would create a duplicate service.

## Owner's exact deployment order

1. **Neon:** Open the existing Neon project; copy the connection string privately. In the *correct existing Express Render service*, set `DATABASE_URL` (prefer TLS required).
2. **Render env:** Set `NODE_ENV=production`, `AUTH_SECRET` (random 32+ bytes), `JWT_SECRET` (different secret if using legacy JWT routes), `ADMIN_EMAILS=owner@yourdomain`, `CORS_ORIGINS=https://quiz-app-virid-zeta-41.vercel.app`, optionally `ADMIN_API_KEY`, and `LOG_LEVEL=info`. Never put these values in GitHub or client envs.
3. **Migration:** Use repository root, Node 22, `npm ci --omit=dev && npm run db:migrate`, then `npm start`. In Neon SQL editor confirm `SELECT COUNT(*) FROM mock_questions;` = **at least 120** (if new questions were added), `SELECT COUNT(*) FROM mock_topics;` >= 10, and `SELECT COUNT(*) FROM exam_attempts_v2;` works. Inspect failures before serving traffic. Render readiness `/api/v1/health/ready` must be 200 with `database=connected`.
4. **Vercel:** Keep `exam-practice-pro` as root directory. Set `NEXT_PUBLIC_API_URL=https://ACTUAL-API.onrender.com` (scheme and origin only, **no trailing `/api/v1`**), same `AUTH_SECRET` as Render, `NEXTAUTH_URL=https://quiz-app-virid-zeta-41.vercel.app`, and one or both of `AUTH_GITHUB_ID/SECRET` and `AUTH_GOOGLE_ID/SECRET`. Never make client-public secrets with `NEXT_PUBLIC_`.
5. **OAuth:** GitHub callback `https://quiz-app-virid-zeta-41.vercel.app/api/auth/callback/github`; Google callback `https://quiz-app-virid-zeta-41.vercel.app/api/auth/callback/google`. Sign-in must use verified email in `ADMIN_EMAILS`. Redeploy Vercel after setting credentials, then redeploy Render as appropriate.
6. **Owner sign-in:** `/auth/signin?callbackUrl=/admin` → `/admin`, verify `GET /api/v1/admin/me` via browser UI, reject any non-admin account.
7. **Question/test:** Admin → Questions: create or edit topic, add original question or import CSV after preview, check saved after refresh. Admin → Mock tests: create draft with question ranges, preview, publish by toggling Draft → Published; check catalogue question count and minutes.
8. **Student:** Use a separate verified non-admin Google/GitHub account. Open `/india-mocks/<published-test-id>`, start, answer, refresh to recover, submit, review saved score.
9. **Cross-device:** Sign in with the same student account in another browser/phone; `/dashboard` → synced history → review. Try accessing that saved result from a different student account; must return 404.
10. **Final readiness:** Verify expired timer behavior, repeated submit gives same result, premium plan rejects unauthorized students, import duplicate detection, admin denial, mobile layout and no leaked answer fields.

### Windows PowerShell development

```powershell
git clone https://github.com/yankeeDamn/Quiz-App.git
cd Quiz-App
git checkout feat/exampro-unified-secure-exams
Copy-Item .env.example .env
# Set DATABASE_URL in your uncommitted .env, or start a disposable local PostgreSQL:
docker compose up db -d
npm ci
npm run db:migrate
npm test
npm run dev
# In a second PowerShell window:
cd exam-practice-pro
Copy-Item .env.example .env.local
# Set AUTH_SECRET identical to API, NEXT_PUBLIC_API_URL=http://localhost:3001,
# and optional Google/GitHub credentials.
npm ci
npm run build
npm run dev
```
When using a local database, place the `DATABASE_URL` from your local Compose setup in `.env`. Do not share console output containing secrets. If using Vercel Preview, OAuth callbacks must be explicitly configured for that preview origin or verified in production after approval.

### Known limitations and verification boundaries

- No Neon credentials were available; PostgreSQL schema was not executed against the owner's real project. SQL migration compatibility must be checked in a backup/staging branch first if existing schemas differ.
- The supplied Render URL could not be positively confirmed as the Express API through available public fetch. Actual service role, SSL connection, migrations, webhook/OAuth redirects and production database persistence are **not verified**.
- No interactive browser/device test was possible from the available development tools; the Next.js production build and backend GitHub Actions tests are the code-level verification.
- Institute administration, billing, tenant scopes, scored certification bank migration and offline timed exams are *not* delivered by this milestone; the institute page remains explicitly labelled preview.
- Autosave is network-dependent: the UI warns when progress is not saved. After the server deadline, only responses saved before the deadline are counted. Exact timer synchronization and CORS should be confirmed in production.
