# Changed files

All changes are scoped to Study Plans, its existing-service integrations, test wiring and documentation.

- `.github/workflows/ci.yml`
- `content/study-plans/ssc-cgl-sample.json`
- `docs/study-plans/AUDIT_AND_PLAN.md`
- `docs/study-plans/CHANGED_FILES.md`
- `docs/study-plans/OPERATIONS.md`
- `docs/study-plans/VERIFICATION.md`
- `exam-practice-pro/app/admin/page.tsx`
- `exam-practice-pro/app/admin/study-plans/preview/[id]/page.tsx`
- `exam-practice-pro/app/api/study-plans/[slug]/tasks/[task]/resource/route.ts`
- `exam-practice-pro/app/study-plans/[slug]/day/[day]/page.tsx`
- `exam-practice-pro/app/study-plans/[slug]/page.tsx`
- `exam-practice-pro/app/study-plans/page.tsx`
- `exam-practice-pro/components/certifications/ebook-monetization-controls.tsx`
- `exam-practice-pro/components/layout/header.tsx`
- `exam-practice-pro/components/study-plans/manager.tsx`
- `exam-practice-pro/components/study-plans/student.tsx`
- `exam-practice-pro/lib/admin.ts`
- `exam-practice-pro/lib/ebooks.ts`
- `exam-practice-pro/lib/study-plans.ts`
- `scripts/study-plans.browser.cjs`
- `src/db/study-plans.sql`
- `src/routes/index.js`
- `src/routes/study-plans.js`
- `src/services/ebooks.service.js`
- `src/services/monetization.service.js`
- `src/services/question-import.js`
- `src/services/study-plans.service.js`
- `src/services/study-plans.validation.js`
- `test/study-plans-postgres.integration.js`
- `test/study-plans.test.js`

## Eventual production requirements

Apply `src/db/study-plans.sql` after the existing database setup and deploy the reviewed API/frontend together. Existing authentication, API origin and admin allowlist settings are reused; no new environment variables or payment configuration are required. No production action was performed. Resolve the existing Next.js security advisory and complete staging/content review before approval.
