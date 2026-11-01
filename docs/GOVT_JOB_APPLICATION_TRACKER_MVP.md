# ExamPro — Government Jobs Application Tracker MVP

**Draft-only implementation. No migrations, deployment, publication or production/staging data changes were performed.**

## Features added

- Preserves the public /government-jobs page and GET /api/v1/government-jobs as before.
- Adds My Applications tab with manually entered past or new applications, status, category, dates, official website and optional registration reference.
- Each official indexed notice has an optional Save tracker draft action, which prefills the form but never marks an application submitted and never automatically persists data.
- Only signed-in, verified Google/GitHub OAuth identities can create, read, edit, delete or reveal their own entries. All database queries include canonical server-derived user_id, not a client-provided identity.
- Application references are encrypted by the backend using AES-256-GCM with random per-reference nonce and authenticated tag. List/create/update responses return only masked last-four hints; an explicit authenticated on-demand reveal endpoint returns the owner's reference.
- All statuses are self-reported. ExamPro does NOT verify the government application's real status, submit applications, collect Aadhaar/OTP/passwords or documents, or offer reminders.

## Private API contract

| Request | Purpose |
| --- | --- |
| GET /api/v1/government-job-applications | List current account's masked records, maximum 200 |
| POST /api/v1/government-job-applications | Create a record (requires title and organisation) |
| PATCH /api/v1/government-job-applications/:id | Update the current account's record |
| DELETE /api/v1/government-job-applications/:id | Permanently delete the current account's record |
| GET /api/v1/government-job-applications/:id/reference | Explicitly reveal only the owner's full reference |

Headers: Cache-Control private, no-store; X-Robots-Tag noindex, nofollow. Guest/unverified identities are rejected. Non-owner UUIDs return 404.

## Key custody and security

GOVT_APPLICATION_ENCRYPTION_KEY is a **server-only Render variable**. Generate a unique 32-byte Base64 key for **each environment** locally:

~~~bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
~~~

Store it only in approved environment-secret management, never in Vercel NEXT_PUBLIC_* variables, GitHub diffs, screenshots, or logs. Losing the key makes saved references unreadable. Do not rotate without an approved staged re-encryption, backup and rollback plan. The feature fails closed with HTTP 503 if no valid key is configured. This protects stored references at rest from simple database-only exposure; it is NOT end-to-end encryption against the server operator.

Supported official hyperlinks must use HTTPS and an allowed government/nic.in or IBPS hostname. Other legitimate authority domains should be assessed in a future allowlist change; omit the link instead of bypassing validation.

## Exact staging setup (requires separate owner approval)

1. Review this draft PR and all CI results. No deployment is authorized by merging or by this runbook.
2. In Neon Console verify project exampro-prod, branch exampro-staging (br-snowy-heart-b5wjnd9e); verify the current expiry, which was observed as **2026-12-01 19:20 UTC / 2026-12-02 00:50 IST**, and confirm an approved, recoverable staging backup.
3. On the verified STAGING branch, read-only inspect:
~~~sql
SELECT to_regclass('public.govt_job_applications') AS application_tracker_table;
~~~
4. After separate explicit owner permission to mutate STAGING, review src/db/government-job-applications.sql and apply its contents in one controlled staging-only transaction. Confirm its schema, owner FK, statuses, index and checks. IF NOT EXISTS will not reconcile preexisting incompatible columns.
5. **Do not run npm run db:migrate** to apply this table. That general command also seeds content and the tracker migration is intentionally NOT wired into automatic migrations.
6. After staging schema approval, configure a unique GOVT_APPLICATION_ENCRYPTION_KEY on staging Render. Verify staging Vercel NEXT_PUBLIC_API_URL resolves to the isolated staging API, not the production API, and AUTH_SECRET matches only the staging pair.
7. After separately approved staging deploy, verify guest public notices and official links remain available, and private account create/list/edit/delete, manual status, full-reference reveal, masked summaries, and non-owner 404 are working.
8. Test sign-out/account-switch isolation, missing key, invalid official URL/date, poor connectivity, mobile/keyboard interactions and privacy disclosure. Verify opening an official website never auto-marks status applied.
9. Production needs its own backup, schema+secret approval, privacy/retention review, and explicit owner-authorized deployment. Do not share the same encryption key across staging and production.

## Available tests

~~~bash
npm ci
node --test test/government-job-applications.test.js
npm test
npm run audit:deployment
cd exam-practice-pro
npm ci
npm run build
~~~

The new tests use mocked PostgreSQL and synthetic OAuth identities, do NOT contact Neon or apply migrations. CI passing does not replace live staging manual verification.

## Remaining limitations and follow-ups

- Existing automatic indexing still covers Employment News and UPSC only; other portals are official links, not verified open vacancies.
- No official government application status verification exists or is claimed.
- No reminders, document uploads, private notes, export, external identity document collection or live payment changes in this PR.
- Records are capped at 200 in the list. Pagination, secure export, key rotation, data retention schedule and additional official domains require separately reviewed work.
- GitHub pushes could trigger a Vercel preview in repositories configured for automatic previews. No manual deployment action was taken by this task.

**Release decision: HOLD until code review, staged schema approval, key stewardship, isolated deployment and owner signoff.**
