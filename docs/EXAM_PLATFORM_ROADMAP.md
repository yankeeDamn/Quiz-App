# Coaching institute SaaS expansion

## Added in this PR
- Public starter catalog endpoints: GET /api/v1/catalog/categories, GET /api/v1/catalog/tests, GET /api/v1/catalog/tests/:id/questions.
- 27 editorial starter multiple-choice questions across 8 categories.
- Public default branding preview at GET /api/v1/branding/default.
- Node built-in tests for catalog integrity and branding allowlisting.

These are **starter practice samples**, not full-length mocks or an operational multi-tenant platform. The questions endpoint deliberately omits correct answers.

## Production implementation next
1. PostgreSQL tenants, memberships, batches, subjects, questions, exam templates, attempts, responses, and result tables. All tenant-owned queries must enforce tenant_id from authenticated membership, never user-supplied tenant IDs.
2. Institute admin-only branding CRUD with verified domains, strict image uploads and safe color validation.
3. Secure server-side grading, immutable exam snapshots, attempt deadlines, randomized question order, negative marks and idempotent submissions.
4. Faculty-reviewed, licensed exam question imports, explanations, difficulty tags, Hindi/Bengali translations, chapter taxonomy and mock exam blueprints.
5. Student-facing Next.js catalog, institute dashboard, reports and responsive exam UI.
6. Investigate deployment health using Render logs, service bindings, environment configuration and /api/v1/health.

Do not use public catalog endpoints as the source of answer keys. Do not advertise the sample questions as past exam papers.
