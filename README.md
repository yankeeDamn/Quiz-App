# Exam Practice Pro

A full-stack exam practice site in the style of CertyIQ and Udemy practice tests, with India exam mocks, premium plans and WhatsApp for coaching, doubts and payments.

- **Learners:** 21 India mock tests (SSC, Banking, Railways, UPSC / PSC, campus), timed with sections, palette, mark for review and negative marking. Every question has an explanation and a "Discuss on WhatsApp" button. Three free IT certification starter tests (AZ-900, AWS Cloud Practitioner, CompTIA A+; 8 questions each, pending expert review). Certification quizzes and flashcards, bookmarks, notes and progress.
- **Money:** Free and Pro plans. Premium mocks are served by the API only to users with a running plan. Payment is confirmed on WhatsApp, then you unlock the plan with one request.
- **Institutes:** an Institute plan sold the same way. Branding per institute is not built yet.

## How it fits together

```
exam-practice-pro/   Next.js 16 site (Render service: exam-practice-pro-frontend)
src/                 Express API + PostgreSQL (Render service: exam-practice-pro-api)
test/                API tests (node:test)
render.yaml          Render blueprint for both services and the database
exampro/             Separate static demo page, shown at /exampro (see note below)
content/, docs/, scripts/   IT certification starter CSV, planning notes for the institute pilot, helper scripts
```

**Note on `/exampro`:** this page is a standalone demo (`exampro/index.html`, loaded by `exam-practice-pro/app/exampro`). It has its own question copies, every test in it is free and its sign-in is simulated, so it is not the paid product. The real product is `/india-mocks`, `/pricing` and `/admin`.

| API route | Who | What |
|---|---|---|
| `GET /api/v1/mocks` | Anyone | Catalogue of all tests. No questions. |
| `GET /api/v1/mocks/:id` | Free tests: anyone. Premium: signed-in user with a running plan | Questions, answers and explanations |
| `GET /api/v1/user/profile` | Signed-in | Profile with `plan`, `planActive`, `planExpiresAt` |
| `POST /api/v1/admin/grant` | You, with `x-admin-key` | Unlock a plan |
| `POST /api/v1/admin/revoke` | You, with `x-admin-key` | End a plan now |
| `GET /api/v1/admin/user?email=` | You, with `x-admin-key` | Check a user's plan |
| `/api/v1/quiz/*`, `/api/v1/user/bookmarks`, `/notes` | Signed-in | Attempts, stats, bookmarks and notes |

## Admin page (owner only)

Open `/admin` on the site and sign in with Google or GitHub. Only emails listed in `ADMIN_EMAILS` (API service) get in; everyone else sees "not an admin". Guest accounts never qualify.

- **Questions:** pick a topic, add one question with the form, or paste many lines (`question | A | B | C | D | right answer | explanation`). Edit a question, or retire it. Retiring hides it but keeps the numbering. Create new topics.
- **Mock tests:** create a test from topic ranges (for example Reasoning questions 0 to 6), set minutes and marks, make it free or Pro only, hide or show it, or edit it. A test is made automatically for every topic.
- **Plans and payments:** unlock or end a plan, search users, see recent unlocks.

Changes show on the site within 30 seconds. The first deploy copies the starter content from `src/data/mock-bank.json` into the database; after that the database is the source and the JSON file is only a starting copy.
Admin requests are never counted against the normal rate limit; only failed attempts are limited.

## Taking a payment

1. The visitor signs in with Google or GitHub and taps a plan on `/pricing`. WhatsApp opens with the plan and their email filled in.
2. You send payment details in that chat (UPI, bank transfer, a payment link) and wait for the money.
3. Unlock the plan on the Plans tab of `/admin`, or from a terminal (needs `ADMIN_API_KEY`):

```bash
curl -X POST https://YOUR-API.onrender.com/api/v1/admin/grant \
  -H "x-admin-key: $ADMIN_API_KEY" -H "content-type: application/json" \
  -d '{"email":"learner@gmail.com","plan":"pro","months":1,"amountInr":199,"note":"UPI ref 1234"}'
```

Renewals add to the current end date. `plan` is `pro` or `institute`; `months` is 1 to 36. The person can be unlocked before they ever sign in; the plan is waiting when they do. Every grant is saved in the `plan_grants` table. To end a plan, post `{"email": "..."}` to `/api/v1/admin/revoke`.

Guest accounts have no email, so a plan cannot be attached to them. The pricing page tells people to sign in with Google or GitHub first.

## Change prices, plans and the WhatsApp number

- Prices, plan names and features: `exam-practice-pro/lib/plans.ts`.
- Which mocks are free or Pro: the Mock tests tab on `/admin`. Topic tests are always free.
- WhatsApp number: `NEXT_PUBLIC_WHATSAPP_NUMBER` on the frontend service (country code and digits only).
- Questions and tests: the `/admin` page (see above).

## Run it locally

```bash
cp .env.example .env              # fill in DATABASE_URL, AUTH_SECRET, ADMIN_API_KEY
docker compose up db -d           # PostgreSQL
npm install && npm run db:migrate && npm run dev      # API on :3001

cd exam-practice-pro
# create .env.local with: AUTH_SECRET=<same value>, NEXT_PUBLIC_API_URL=http://localhost:3001,
# NEXTAUTH_URL=http://localhost:3000 and the Google or GitHub keys you use
npm install && npm run dev        # site on :3000
```

Tests: `npm test` in the root runs the API tests. `npm run build` in `exam-practice-pro` builds the site.

## Environment variables

| Variable | Service | Required | Notes |
|---|---|---|---|
| `DATABASE_URL` | API | Yes | Set by Render from the database |
| `AUTH_SECRET` | API and site | Yes | Must be the same value on both |
| `JWT_SECRET` | API | Yes | Generated by Render |
| `CORS_ORIGINS` | API | Yes | The site's URL, for example `https://quiz-app-regd.onrender.com` |
| `ADMIN_EMAILS` | API | For `/admin` | Your Google or GitHub email, comma separated for more than one |
| `ADMIN_API_KEY` | API | No | Optional 24+ character key for `curl`. Not needed for the admin page |
| `NEXT_PUBLIC_API_URL` | Site | Yes | The API's URL |
| `NEXTAUTH_URL` | Site | Yes | The site's own URL |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Site | For Google sign-in | |
| `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | Site | For GitHub sign-in | |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Site | No | Defaults to the number in `render.yaml` |

The Render build runs `npm run db:migrate` for you. It adds the plan columns and the `plan_grants` table and is safe to run again.

## Not built yet

Online card or UPI checkout, per-institute logins and branding, CSV file upload (pasting lines works), an editor for certification quizzes (still in `exam-practice-pro/data/quizzes.ts`) and for the IT certification starter questions (bundled in `exam-practice-pro/data/it-certification-questions.json`), Pro-only topics (every topic gets a free practice test, so a question added to any topic can be played free there; Pro mocks only re-arrange questions that already exist in topics), batch analytics and automatic WhatsApp messages. Question explanations were written for this site and should be reviewed by a teacher before real students rely on them.
