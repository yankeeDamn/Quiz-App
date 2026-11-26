# Study Plans operations and review guide

## Scope and publication

This module lives inside ExamPro. It reuses verified OAuth identities, ADMIN_EMAILS, the PostgreSQL pool, question bank, mock catalogue/attempts, Ebook Studio and its private PDF delivery. No payment product, amount, renewal behavior or Cashfree configuration is changed.

Nothing is seeded or published by the feature migration. Until a reviewed edition is published, the four initial exam cards say Upcoming. `content/study-plans/ssc-cgl-sample.json` is a small sourced authoring example, not a complete syllabus, PYQ pack or production seed. Human editorial review and explicit publication are required.

## Setup (staging first; deployment requires approval)

Use the existing environment configuration: DATABASE_URL, matching frontend/backend AUTH_SECRET, verified Google/GitHub sign-in, ADMIN_EMAILS, NEXT_PUBLIC_API_URL and the existing CORS allowlist. No new secret, paid service, storage provider or payment setting is required.

1. Install existing lockfiles with `npm ci` and `(cd exam-practice-pro && npm ci)`.
2. Provision a disposable/staging PostgreSQL database. Apply the existing baseline migrations using the project's established setup; do not point tests or seeds at production.
3. Apply the opt-in migration: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f src/db/study-plans.sql`. The file owns its transaction and is repeatable. It requires users, mock_topics, mock_questions, mock_tests, ebooks, ebook_pdf_assets and existing access/attempt migrations. It does not change existing records. It is intentionally not added to the legacy startup migration, which also seeds unrelated content.
4. Start the existing Express API and Next frontend. Visit `/admin?section=study-plans` with an allowlisted OAuth account. Check `/api/v1/study-plans` returns an empty published list and Upcoming placeholders.
5. Run the tests below. Deploy backend with migration before exposing the frontend. Resolve the existing Next.js dependency security advisory through a separately reviewed dependency change before production release.

If the Study Plans schema is absent, its endpoints return a setup-required 503; unrelated endpoints continue to operate.

## Administrator workflow

1. **Exams:** create a stable identifier, display name, category, source URL, applicable version, pattern reference, default access and order. Duplicate creation is rejected. Edit via the existing record; identifiers cannot change. Keep the exam draft until reviewed. Exam publication alone publishes no plans.
2. **Syllabuses:** create a version for the exam, record the exact official source and pattern reference. Check verification only after reviewing the source and applicable amendments. A version used by a published edition is immutable; create a new version for syllabus changes.
3. **Topics:** build Stage → Subject → Chapter → Topic. Parent and version are stable; order, description, objectives, duration, difficulty, prerequisite IDs and status are editable before publication. Prerequisite cycles are rejected. Resource attachments may reference any hierarchy node. The UI exposes stable IDs for linking.
4. **Resources:** use Ebook Studio for upload/replacement and its normal publication controls. PDF uploads remain limited to 3 MiB and are parsed server-side. Attach the existing ebook slug, attribution, resource type and distribution-permission notes. Public official links can be attached as Free references without copying the PDF.
5. For **new Pro-only Study PDFs**, choose “Study Plans: Pro subscribers only” when creating the ebook, then choose Pro access. This immutable scope excludes exam/ebook passes, including on direct ebook PDF routes. The flag cannot be added to an existing ebook: changing already-purchased access would violate existing entitlements. Existing Free ebooks can be reused. Existing paid ebooks retain their original access scope and are not relabeled as exclusive Study PDFs. Free visitors receive only the separately generated permitted ebook preview; the Study resource endpoint itself requires the attachment's access policy. Download permission remains enforced by Ebook Studio.
6. **PYQs:** enter or edit questions in the existing Question Bank. Select a bank topic to find IDs, then attach exam/year/stage/session/language/source/rights metadata. Unknown fields remain blank. Mark provenance verified only after review. Bulk JSON accepts the existing question fields plus a `pyq` object; preview reports row errors, commit revalidates transactionally, duplicate prompts are rejected, and imported provenance starts unverified. Link an existing ID instead of reimporting it. Question publication remains the existing Question Bank review workflow.
7. **Plans:** create a slug, version, configurable duration, level, daily time, weekly goals and completion criteria. Add ordered tasks by day; choose required/optional, Free preview, topic, resource, mock and question IDs. Use task descriptions for permitted notes and guidance. Saving does not publish. Every configured day must contain a task; quiz/mock tasks require a live existing mock, PYQ tasks require verified published questions, and PDF tasks require a published resource.
8. Preview the draft through the student layout, review Free preview flags and source/rights checks, then explicitly acknowledge and click Publish. No assistant-created sample is automatically published.

## Student behavior and edit policy

- Catalogue and safe overview metadata are public. Backend authorization filters daily tasks; answer checks and PDF delivery separately recheck permissions. Responses use private/no-store cache headers; the existing service worker does not cache these routes.
- Pro eligibility uses the canonical active user balance. Historical grants cannot resurrect a revoked/expired balance. An institute account additionally needs an explicit active Pro product grant. SSC/IT passes alone do not unlock Study Plans. Legacy recorded Pro balances are supported without creating purchases.
- Enrollment uses a chosen calendar start date and relative day numbers. Students can open any published day, resume after missed dates, and explicitly check/uncheck tasks. Opening a page does not complete anything.
- Progress is calculated from required task completions and timestamps, including completed days/topics. Optional tasks are recorded but excluded from the required-task percentage. Quiz results refer to existing submitted mock attempts; practice answer checks do not create a competing attempt store.
- Published editions cannot be edited. Clone to create the next draft edition. Enrolled students remain on their published edition; new students use the newest published edition. Cloning allocates new task IDs without changing existing records. There is no automatic enrollment migration between editions.
- Archiving an exam/plan hides its content even from enrolled students; enrollment and completion records remain. If another edition is published it can be opened/enrolled separately. Resource archive/replacement preserves its stable reference; permissions are checked at delivery time. No destructive content-delete endpoint is supplied.
- Topic archival on a frozen published syllabus requires a new version; this protects historical learning objectives. Question retirement/unpublication and provenance withdrawal take effect immediately on delivery.

## API map

Public/optional identity: GET `/api/v1/study-plans`, `/:slug`, `/:slug/day/:day`; POST `/:slug/tasks/:task/questions/:question/answer`; GET `/:slug/tasks/:task/resource` (optional `download=1`).

Authenticated student: POST `/:slug/enroll`, PUT `/:slug/tasks/:task/complete`. Progress is included in the authenticated overview, scoped exclusively to the caller; caller-supplied user IDs are ignored.

Allowlisted OAuth admin under `/api/v1/admin/study-plans`: inventory; exams/syllabuses/topics/resources creation and editing; plan creation/editing; task creation/editing; plan detail, preview and day preview; explicit publish/archive/clone; question-bank listing; PYQ metadata linking; PYQ import preview/commit. Uses the existing admin limiter and structured actor/action logs. Admin-key shortcuts and frontend role flags are not accepted for this feature.

## Verification commands

```sh
npm test
npm run lint  # existing backend script is a no-op
cd exam-practice-pro
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/eslint components/study-plans lib/study-plans.ts app/study-plans app/admin/study-plans app/api/study-plans
npm run lint
npm run build
```

For a freshly migrated **disposable** database only:

```sh
STUDY_TEST_DATABASE_URL=postgresql://... node --test test/study-plans-postgres.integration.js
```

The integration test creates synthetic users/content, publishes only in that test database, validates migration repeatability, and deliberately retains records for inspection. Use a fresh database on each run. Never set it to production. Existing integration scripts have their own explicit test database variables; see their headers. Browser UI fixtures: `node scripts/study-plans.browser.cjs` with Playwright and Chromium available (not application runtime dependencies). These fixtures validate rendering/interactions; they do not substitute for real OAuth staging checks.

## Staging checklist (not a deployment approval)

- [ ] Apply migration twice; verify existing content counts and purchases are unchanged.
- [ ] Sign in as an allowlisted admin, ordinary Free learner, valid Pro, expired Pro and revoked Pro; test both UI and direct API calls.
- [ ] Create a draft exam/syllabus/plan; confirm neither draft tasks nor private identifiers are returned to students.
- [ ] Create both stages, subjects/chapters/topics; reorder and test invalid parents/prerequisite cycles.
- [ ] Import valid JSON, malformed answers/options, unknown exam/topic references and repeated questions; verify atomicity and existing IDs.
- [ ] Attach an original permitted PDF through Ebook Studio; test oversized/invalid files and replacement revision conflicts.
- [ ] Check guest/Free/SSC-pass/IT-pass/expired/revoked requests to Study resource routes and every ebook pdf/read/download alias.
- [ ] Preview, explicitly publish, enroll with a past start date, skip a day, complete/uncomplete a task; sign in on another device and confirm progress.
- [ ] Attempt cross-user completion and admin URL manipulation.
- [ ] Clone/publish a second edition and verify old enrollment remains intact. Archive an edition and verify hidden content with retained DB progress.
- [ ] Re-run existing mocks/attempts, question workflow, ebooks, Free access and synthetic payment tests.
- [ ] Review mobile rendering, keyboard operation and published content with real staging identities.
- [ ] Obtain approval before production migration, content publication, merge or deployment.

## Rollback

Prefer disabling navigation and reverting only Study route/UI wiring while retaining the additive tables and completion data. Do not drop tables to roll back application code. If any Study-only ebooks have been created, retain their narrow entitlement enforcement; reverting that guard would broaden access through old ebook routes. Before a full code rollback, archive those new ebooks through existing administration (separate approved content action) or retain the guard. Existing ebooks do not need changes. Back up the new tables before any later, separately reviewed removal migration.

## Known limitations

No complete SSC course or actual licensed PYQ/PDF collection is supplied. The source-verified sample demonstrates two topics only. Admin linking uses stable IDs/selectors rather than a drag-and-drop visual curriculum canvas. Timelines are relative-day schedules, not adaptive recommendations. No reminders, automatic progress migration between editions, bulk syllabus importer, or new learning analytics engine. A real staging OAuth/multi-device review remains required; no remote staging or production deployment was performed.
