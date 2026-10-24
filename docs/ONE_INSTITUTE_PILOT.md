# One-institute paid pilot: implementation plan

## Current scope (this PR)
Adds PostgreSQL **schema only** for institutes, owner/teacher/student memberships, question banks and review, batches, timed exams, exam assignments, submitted attempts/rankings, and payment-provider subscription records. The migration runs inside a transaction using the existing `npm run db:migrate` command. All tables are prefixed `pilot_` to avoid collisions with existing app data. **No institute data, API endpoints, checkout, student UI or paid features are live yet.**

## Security gates before onboarding a real institute
- Every API query must derive `institute_id` from an authenticated membership (never trust a client-supplied institute ID).
- Enforce owner/teacher permissions for imports, scheduling, analytics and subscription administration.
- Never return `correct_option` or `explanation` to students before exam submission.
- Create attempt and calculate grade entirely server-side in a transaction, using immutable published question snapshots; enforce time window and single-attempt policy.
- Verify payment webhooks using the payment provider's signature and idempotency keys. Do not accept client-reported payment status.
- Run isolation tests with two institutes and prove one cannot access the other's questions, exams, students or rankings.
- Add backup/restore, audit logging, data-retention policy and rate limiting before charging.

## Delivery sequence
1. **Import and review:** authenticated institute creation/invitations, CSV upload from `content/it-certifications/starter-questions.csv`, validation, idempotent import and teacher approval.
2. **Exam engine:** publish approved questions, batch assignment, time-limited student sessions, server-side grading, persistent attempts.
3. **Rankings:** tenant/batch-scoped leaderboards, student results, teacher reports.
4. **Billing:** Razorpay (India) or another approved provider, webhook verification, plan limits and an invoice/receipt workflow.
5. **Pilot:** one institute, 10–30 learners, two exams, one verified payment in test mode before any live charge.

## Setup (Windows PowerShell)
```powershell
npm ci
# Set DATABASE_URL in your local .env; never commit secrets.
npm run db:migrate
```
The migration requires a PostgreSQL instance and will create the new pilot tables. Back up existing production databases before running migrations; test on a separate database first.

## Definition of done for a paid pilot
- Institute owner imports 100 reviewed AZ-900 questions without developer assistance.
- Teacher creates a 30-minute mock, assigns it to a batch of at least 10 students.
- Students sign in and submit; scores are computed by the server.
- Teacher views rankings and per-question/topic performance, isolated to the institute.
- A verified subscription payment activates access; cancellation/expiry disables paid capabilities.
- Cross-tenant and payment forgery tests pass.
