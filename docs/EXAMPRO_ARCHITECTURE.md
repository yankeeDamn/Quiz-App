# ExamPro clean architecture and admin dashboard roadmap

## Bounded contexts
- **Identity & tenancy:** users, institute memberships, invitations, RBAC; server-derived tenant scope.
- **Question bank:** versioned questions, CSV imports, validation, moderation, approval, ownership and licensing.
- **Exam delivery:** draft/publish, immutable exam question snapshots, schedules, batch assignment, time enforcement.
- **Assessment:** attempts, answers, server-side scoring, ranking and analytics.
- **Billing:** plans, entitlements, provider-verified webhooks, receipts and usage limits.
- **Platform operations:** audit events, abuse controls, backups, support and monitoring.

## Deployment boundaries
- `exam-practice-pro/`: Next.js App Router, institute dashboard and student pages. Vercel deployment root is this folder.
- `src/`: Express API (deploy separately), PostgreSQL queries, authentication and business rules.
- `src/db/`: additive SQL migrations; **PR #12 is currently separate and must be tested before merging**.
- `content/it-certifications/`: source CSV question content, not a live database.

## Current preview (this PR)
`/institute-admin` is a **public, read-only preview**: displays available IT starter tracks, downloadable CSV template and client-side structural CSV checks. It does **not** persist uploaded files, grant admin rights, create exams or manage billing. The frontend JSON sample bank is intentionally not the secure paid-exam source of truth.

## Production API contracts to implement next
- `POST /api/v1/institutes`: authenticated onboarding (with verified identity).
- `GET /api/v1/institutes/current`: resolve institute membership and role server-side.
- `POST /api/v1/admin/question-imports`: teacher/owner only; multipart CSV, size limits, content validation, idempotency and audit.
- `GET /api/v1/admin/questions`: tenant-scoped pagination/filtering.
- `PATCH /api/v1/admin/questions/:id/review`: approve/reject with role checks.
- `POST /api/v1/admin/exams`: draft exam with approved questions.
- `POST /api/v1/admin/exams/:id/publish`: freeze question versions and validate availability.
- `POST /api/v1/student/exams/:id/attempts`: authenticated, assigned student only.
- `POST /api/v1/student/attempts/:id/submit`: server-side scoring in transaction.
- `GET /api/v1/admin/exams/:id/rankings`: tenant/batch-scoped results.
- `POST /api/v1/billing/webhooks`: provider-signature verified, idempotent subscription changes.

## Security requirements
- Current NextAuth guest login must **never** authorize institute operations. Align trusted identity between NextAuth and Express before wiring APIs.
- No client-supplied institute ID may determine authorization; membership must be looked up using authenticated identity.
- Validate uploads on the **server**, including UTF-8, quoted fields, max size, rows, licensing and schema. Browser checks are advisory.
- Do not expose correct answers until submission; implement server-side scoring and rate limits.
- Use parameterized SQL, tenant-aware composite keys, least-privilege DB credentials, audit logs and tests proving cross-tenant denial.
- Never place PostgreSQL URLs or API secrets in `NEXT_PUBLIC_*` variables.
- Avoid deploying billing until webhook and subscription-state tests pass.

## Sequence for a paid institute pilot
1. Test PR #12 migrations on disposable Neon PostgreSQL; verify reruns and constraints.
2. Deploy Express API with database, identity verification, health endpoint and strict CORS.
3. Build institute bootstrap and authenticated teacher CSV import/review; add integration tests.
4. Wire this preview to real, tenant-scoped data; replace browser-only demo actions.
5. Build exam scheduling, server-side attempts and rankings.
6. Add payment provider and onboard one pilot institute.
