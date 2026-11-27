# ExamPro admin and UX modernization — Phase 0

Audited 28 November 2026 (Asia/Kolkata). Repository: `yankeeDamn/Quiz-App`, base `ce422b3945ce837628027db31aa8d4691632ec6c` (`main`, includes PR #114). Product branding in source is **ExamPro**; this audit does not rename it to ExamrPro. Findings are from source and local checks, not a production database or authenticated production UI inspection.

**Outcome:** the existing architecture can support a staged redesign, but the requested independently published Courses/PDFs do not currently exist as separate entities. They share an ebook document and access policy. Resolve that ownership decision before large changes, as requested in Phase 0. Preserve the explicit compatibility constraints below. Phase 0 changes documentation only; Phases 1–9 are not implemented.

## 1. Detected stack

| Area | Current implementation |
| --- | --- |
| Frontend | `exam-practice-pro/`: Next.js 16.4.3 App Router, React 19.2.4, TypeScript. Root `exampro/` also contains the legacy HTML portal; keep legacy entry points working. |
| UI/CSS | Tailwind CSS 4, shadcn-style `components/ui`, Base UI, Radix Slot, class-variance-authority, tailwind-merge, Lucide, Framer Motion. Recharts already installed. |
| Theme/fonts | `app/globals.css` semantic variables; `next-themes`, persisted light/dark/system menu in `components/layout/header.tsx`. Current default is system. Inter, Hind Siliguri and Noto Sans Devanagari through `next/font/google`; no installed geometric heading or JetBrains font. |
| State | React state/effects for admin forms; Zustand for quiz state; account-scoped browser storage and API-backed user data. No reason to replace these. |
| Backend/API | Root `src/`: CommonJS JavaScript, Express 4, `/api/v1` routers/services, express-validator, consistent `{success,data}` / `{success:false,error}` envelopes. Next route handlers proxy selected ebook/study-resource operations. |
| DB | PostgreSQL via `pg`, parameterized SQL, no ORM. `src/db/migrate.js` runs core SQL and seeds; several feature migrations are explicitly manual/opt-in. |
| Auth | Auth.js/NextAuth v5 beta, Google/GitHub, backend token bridge; additional backend JWT/credential routes. Site admins use `ADMIN_EMAILS`; some admin routes also accept `ADMIN_API_KEY`. Human-review routes explicitly reject API-key identity. Institutes have separate membership/permission checks. |
| Files/PDFs | `ebook_pdf_assets` stores protected PDFs as PostgreSQL BYTEA, max 3 MiB. `pdf-lib`, `pdfjs-dist`, `@napi-rs/canvas` already present. Preview bytes/page counts and download permissions exist; public external PDF URLs have different restrictions. Browser iframe/print-based reader also exists. |
| Courses/video | `EbookTrack.chapters` provide markdown/code/reading, concept checks, final assessment and progress. No standalone course/module/lesson tables or current video upload/embed pipeline found. PDF iframe is not a video mechanism. |
| Deployment | Source documents Vercel frontend, Render Express API/Docker and Neon PostgreSQL. GitHub Actions builds frontend, tests backend and runs selected disposable-Postgres suites. Live service state was not checked. |

Evidence: both `package.json` files, `app/layout.tsx`, `lib/auth.ts`, `lib/api.ts`, `src/routes/index.js`, `src/config/database.js`, `src/routes/admin.js`, `src/routes/ebooks.js`, `src/services/ebooks.service.js`, `.github/workflows/ci.yml`, `render.yaml`, `docs/DEPLOYMENT_MATRIX.md`.

## 2. Current administration map

API paths below are relative to `/api/v1`. `/admin` is primarily one client page with local section state, not one route per content type. Its recognized `?section=` values are defined by `SECTIONS`; internal navigation also reaches overview/catalogue/practice. Changing the selected section does not update browser history.

| UI page/section | Responsibility | API and entities |
| --- | --- | --- |
| `/admin` (default: tests) | Session gate, shared navigation, command metrics | `/admin/me`, `/admin/command-center`; users, mock topics/questions/tests, scored attempts, plan grants |
| Overview (internal section) | Bank/test counts, draft queue, workflow links, government-feed health | `/admin/topics`, `/admin/tests`, `/government-jobs`; mocks/topics plus remote feed cache |
| `?section=tests`; internal catalogue | All/live/hidden definitions, filters, sort, paging, grid/list, quick access/publication changes, readiness, preview, review, definition editor | `/admin/tests`, `/admin/catalogue`, `/admin/tests/:id/{preview,publication-checklist,release-readiness,reviews}`, `/admin/tests/publication-candidates`; mock tests/questions/topics, editorial review rows |
| `?section=questions` | Database question bank, topic management, CSV and pasted imports, review workflow | `/admin/topics`, `/admin/topics/:id/questions`, `.../questions/preview`, `.../import`, `/admin/questions/:id/{workflow,review,active}`; mock topics/questions and PYQ metadata when applicable |
| Practice & IT library (internal practice section) | Edit bundled practice through overrides/additions; starter-pack editor | `/admin/practice/library`, `/admin/practice/questions/...`, `/admin/practice/:kind/:source/:id/review`, `/admin/practice/starter-packs/...`; bundled JSON, practice overrides/additions, starter-pack questions |
| `?section=study-plans` | Plans, exams, syllabuses, topic hierarchy, resources, tasks, PYQs, prerequisite review, readiness, clone/publish/archive | `/admin/study-plans` and `/exams`, `/syllabuses`, `/topics`, `/resources`, `/plans`, `/plans/:id/{tasks,readiness,review-prerequisites,preview,publish,archive,clone}`, `/pyqs/...`; all `study_*` tables plus ebooks and mock bank |
| `?section=plans` | User lookup, existing plans, verified manual grants/revocation | `/admin/users`, `/admin/user`, `/admin/grants`, `/admin/grant-preview`, `/admin/grant`, `/admin/revoke`; users, plan grants, payment provenance |
| `?section=payments` | Sandbox Cashfree audit | `/admin/cashfree/sandbox-audit`; sandbox orders/webhook events and grants |
| `?section=monetization` | Verified payments, ads/sponsors, coaching profiles, events, affiliate resources, ebook access rules | `/admin/monetization/...`; monetization documents/grants/orders/metrics/members/registrations, advertising verification/audit tables |
| `?section=qa` | Staging invitations, learner feedback, Mock 01/02 audit, content pipeline | `/admin/draft-testing/status`, `/admin/beta/...`, `/admin/mock01-02/audit`, `/admin/content-pipeline/...`; beta invitations/feedback/audit, mocks and question reviews |
| `/admin/draft-test/[id]` | Private timed student-style mock QA | `/admin/tests/:id/draft-attempt`, `/admin/draft-attempts/:id[/progress\|/submit]`; snapshot-based `exam_attempts_v2`, strict staging and signed-in admin gate |
| `/admin/study-plans/preview/[id]?day=` | Reuses student plan/day renderer for private preview | `/admin/study-plans/plans/:id/preview[/day/:day]`; existing plan/task/resource relations, admin authorization |
| `/admin/institutes` | Platform owner reviews applications and institute lifecycle | `/platform/institutes/applications`, `.../:id/review`, `/platform/institutes/:id/lifecycle`; pilot applications/institutes/memberships/audit |
| `/admin/institutes/billing` | Private sandbox plans and quotes | `/platform/institutes/billing/plans`, `/platform/institutes/:id/billing/quotes`; pilot billing plans/orders/receipts. Preserve pricing. |
| Ebook Studio, opened from `/certifications?tab=start-learning` and learning UI | Inventory, metadata, chapters, assessments, local drafts/backups, visibility/access, PDF upload, access requests | Next `/api/admin/ebooks/...` proxies Express `/admin/ebooks`; additional `/admin/ebooks/requests`, `/:slug/approve-access`; ebooks, ebook access/assets, monetization policies |
| `/institute-admin` | Separate legacy institute import/branding preview | Local preview/template workflow, not a replacement for the secure institute API |
| `/institute/[slug]/[section]` | Tenant admin/teacher dashboard, members, teaching, exams, reports, billing/settings (role-dependent) | `/institutes/:slug/...`; tenant-bound pilot tables and versions/audit. Must not inherit platform-owner powers from the new shell. |

There is no `/admin/design-system`, standalone Courses/PDFs/Certifications admin route, general admin settings page or platform-wide activity feed yet. The public `/certifications/learn/[slug]` reader is the closest existing course player.

## 3. Current content/data model

| Requested concept | Actual model and compatibility boundary |
| --- | --- |
| Mock/Test | `mock_tests`: stable string `id`, name, exam string, minutes, marks/negative marks, level, free/premium tier, `sections JSONB`, active, timestamps; additive `pass_percent` and timing configuration. `lib/mocks.ts` is the frontend projection. Practice JSON quizzes are separate. |
| Section | Nested `{name, parts:[{topic,from,to}]}` in a mock. Parts use half-open position ranges. No platform section table. Arbitrary question reordering cannot renumber the shared bank. |
| Question | `mock_questions`: UUID, topic FK, stable position, question text, options JSONB, integer answer 0–3, explanation, active, difficulty, review status, reviewer/time and access tier. Questions retire instead of renumbering. Separate bundled practice/addition/override and institute question stores exist. |
| Option | Four strings in the platform mock options JSON array; one integer answer. Client generic practice types may differ. No standalone Option table; do not infer server-scored support for multi-answer/ordering/short answers from frontend types. |
| StudyPlan | `study_plans`: UUID, slug+edition, exam+syllabus FKs, title/description/level, duration/daily minutes, goals/completion criteria, free/pro access, status/revision/creator/published timestamp. Published editions are immutable. |
| StudyPlanItem | `study_days(plan_id,day)` and `study_tasks` with day/topic/title/kind/minutes/order/required/preview/resource/mock fields; `study_task_questions` links bank questions. No week table: week can be derived. Allowed tasks: reading, pdf, pyq, quiz, mock, revision, guidance. |
| PDF/Resource | `study_resources` links an exam/topic to an ebook slug or qualified external URL, with attribution/rights/access/status. `ebooks.document` holds track metadata and chapters; `ebook_pdf_assets` is one current full/preview asset per ebook slug. Replacement retains slug URL but not a general asset-version history. |
| Course | No independent Course entity. Closest equivalent: `ebooks` row with JSON `EbookTrack`, free/pro access, preview/download controls, revision and archive state. |
| Module/Lesson | `EbookChapter`: stable id/order, title, duration, summary, markdown, optional code example, takeaways, concept checks. Chapters currently serve as lessons; a separate module hierarchy would be additive. |
| Certification/Category | Multiple sources: `lib/it-certs.ts` static practice IDs/codes; ebook category strings/examId; database `study_exams`, `study_syllabuses`, `study_topics`. PR #114 also exposes ten IT study-plan tracks, including upcoming cards; a card is not proof of published course content. No universal cross-content certification FK. |
| User/Role | `users` stores account and plan fields; site admin authorization uses allowlisted identity, not just the UI or `users.role`. `ebook_access` gives reader/editor grants; `pilot_memberships` provides tenant owner/teacher/student roles. |
| Attempt/Result | `quiz_attempts`, `scores`, `user_stats`; secure mocks use `exam_attempts_v2(snapshot,responses,deadline,submitted_at,result)`. Ebooks use `ebook_attempts`; institutes use tenant-bound `pilot_attempts`. Preserve snapshots and grading. |
| Progress/audit/version | `study_enrollments` + `study_completions`, `ebook_progress`; revisions and immutable plan editions exist. `pilot_question_versions`, pilot/advertising/beta audit tables are scoped systems, not a reusable site-wide content-history implementation. |

Schema evidence: `src/db/migrate.js`, `exampro-v2.sql`, `question-review.sql`, `mock01-quality-accessibility.sql`, `ebooks-schema.sql`, `ebook-pdf-preview.sql`, `ebook-admin-monetization.sql`, `study-plans.sql`, `pilot-schema.sql`, `institute-delivery.sql`; frontend `lib/admin.ts`, `lib/ebooks.ts`, `lib/it-certs.ts`.

## 4. Publishing behavior and conflicts to preserve

| Type | Existing contract | Required adaptation |
| --- | --- | --- |
| Platform mock | Draft is inactive. Active is not necessarily live: catalogue requires complete accessible, reviewed/published questions and active topics. Full SSC CGL mocks require additional editorial sign-off. Preview does not publish; timed draft QA is staging-only. | Status UI must distinguish **active but hidden** from actually published. Reuse `publicationReadiness`, diagnostics and editorial gates; never treat `active=true` alone as readiness. |
| Questions | Draft → reviewed → published, separately from active and free/premium. Human review endpoints reject API keys. | Bulk import/duplicate/schedule must never manufacture review. Preserve original provenance and reset review where content changes. |
| Study plans | Draft → published or archived, with verified syllabus/topic/resource checks, revision match and explicit acknowledgement. Once published, edit through clone/new edition; enrollments reference the old plan ID. | Restore must create a new draft edition, not overwrite an enrolled edition. Generic unpublish-to-edit is incompatible. |
| Ebooks/courses/PDFs | Visibility `admin_only`/`invite_only`/`public`, plus archive and separate free/pro policies. Owner alone changes visibility; editors have narrower rights. Built-in public editions must remain public and free and cannot be archived. | Retain these exceptions. Distinguish publication from entitlement. A PDF and its current reading course share visibility; independent publishing requires a deliberate model decision. |
| Certifications | Static practice catalogue has no publish mutation; `study_exams` has draft/published/archived but controls the study-plan catalogue, not every IT course/mock. | Add explicit reviewed links; do not match and publish content solely by similar title/category. |
| Institute exams | Separate draft/published/closed model, independent review, tenant isolation and immutable published snapshots. | Keep outside a site-owner certification bundle unless separately specified. |

No unified scheduler exists. Existing live-event dates are not content-publication scheduling. Scheduling needs a durable, idempotent worker, revision-bound approval, entitlement/readiness rechecks at execution, cancellation and visible failure results. Do not replace current authorization with an API-key shortcut. The deployment mechanism for that worker is also unspecified; no deployment changes are authorized here.

## 5. Reuse before adding components

Reuse `components/ui/{button,input,textarea,select,switch,checkbox,tabs,badge,card,dialog,sheet,dropdown-menu,progress,scroll-area,tooltip,alert}` and `components/admin/ui.tsx` (`Field`, `Notice`, input/card styles). Extend the existing header theme menu and next-themes persistence.

Extend `MockManager` (search/filter/sort/paging/grid/list/export), `TestsTab`, `PublicationChecklist`, `MockReview`, `CsvImport` (template, 1 MiB/200-row limit, server dry-run, duplicate detection and atomic revalidation), `QuestionReviewDialog`, `StudyPlanManager`, `EbookStudio`, `EbookInventory`, `PdfSettings` and `LessonMarkdown`. Reuse the actual student exam/plan/ebook renderers for previews with their existing server permission gates.

Missing shared primitives: generalized selectable/density-aware table, command palette, toast with safe Undo, skeleton, stepper, file dropzone and common publish panel. Build these on the existing UI primitives; do not add another component framework or rich-text parser. There is no installed Excel parser: CSV exported from Excel already works, native XLSX needs an explicitly justified dependency if implemented.

## 6. Top ten UX issues visible in source

1. Admin navigation is local state; browser Back/deep links do not reliably reconstruct all views.
2. Ebook administration is entered through the student certification area, separate from the main admin workspace.
3. Publication labels encode different concepts: active, catalogue-visible, question-reviewed, ebook visibility and plan status.
4. Mock composition requires editing numeric bank ranges; selected questions and their relationship to ranges are difficult to inspect.
5. Study plans use schema-like forms and a task list without the requested week/day timeline or resource picker.
6. Many list/form panels are eagerly imported into `/admin`; long inventories are fetched before client-side paging/filtering.
7. Shared tokens coexist with hard-coded indigo/violet/slate styles, gradients and varied radii; changing only `--primary` will not re-theme the product.
8. There is no cross-content search, Create menu, keyboard shortcut discovery or consistent breadcrumbs across the admin pages.
9. Ebook draft saving is manual/account-local and server revisions are separate; there is no consistent autosave/saved indicator or general recoverable deletion across editors.
10. Dashboard metrics cover mocks/questions/grants, not the requested seven-day student trends, cross-content completions, actionable scheduled queue or unified recent activity.

These are source-review findings, not observed usability sessions or a completed WCAG audit. Existing filtering, previews, review checklists and partial bulk publishing are present and should not be rebuilt from scratch.

## 7. Phase-by-phase implementation plan

Each row is a separate reviewable commit/PR, with the old UI retained until verified. Proposed flag names below are **not implemented**.

| Phase | Concrete change | Migration/test and compatibility gate |
| --- | --- | --- |
| 0 | This route/model audit and baseline checks | Documentation only. Resolve course/PDF ownership before large changes; establish lint baseline remediation. |
| 1 | Centralize palette in `globals.css`; map existing semantic tokens, use a separate readable accent-ink token in light mode, dark initial default with Light/Dark/System menu. Replace hard-coded branding across admin/student/legacy entry points. Extend primitives and add protected `/admin/design-system`. Preserve Indic fonts; use installed font stacks initially. | No DB migration. Token contrast, hydration/persistence, keyboard/reduced-motion and representative student route checks; real axe/Lighthouse runs. Yellow focus outline on light surfaces needs a dark separating ring. |
| 2 | Flagged shell with URL-aware navigation, collapsible sidebar/mobile sheet, breadcrumbs, search and Create menu; extend command-center service with accurately named, paginated/aggregated metrics and attention links. | `NEXT_PUBLIC_ADMIN_MODERN_SHELL`; old `/admin?legacy=1` fallback. Auth/account-switch regression. Show unavailable metrics honestly; do not invent deltas or scheduled items. |
| 3 | Shared lifecycle UI with per-type server adapters, readiness, revision-safe drafts, snapshots and actor-ID audit, private previews and authorized bulk operations. Keep original status/access fields authoritative. Add scheduling only behind server flag with approved execution mechanism. | Proposed additive `content_versions`, `content_audit_events`, `content_schedules`, optional draft records and indexes. Snapshot on publication in same transaction. Restore creates draft/edition; no destructive down-migration. Flags `ADMIN_PUBLISHING_V2`, `ADMIN_SCHEDULING_ENABLED`, `NEXT_PUBLIC_ADMIN_PUBLISHING_V2`, all default off. Test auth, stale revisions, atomicity, retries, legacy edits and no-op rollback. |
| 4 | Wrap existing mock editor in five steps plus scrolling mode; extend existing list/import/preview. Support existing four-option single-answer scored mocks first. Deep-copy into new stable bank positions; never renumber existing questions. | `NEXT_PUBLIC_ADMIN_MOCK_WIZARD`, default off. Reuse server import validation; add column mapping and JSON parsing. Unsupported question kinds stay unavailable under the no-player-change guardrail. CSV/import/publish golden path and unchanged grading tests. |
| 5 | Timeline over `study_days`/`study_tasks`, resource picker, duration templates and deterministic draft distribution; weekly load validation; student progress styling. | Existing clone/edition and progress semantics retained. Any new task metadata additive/defaulted; do not silently map unsupported video/rest tasks to a different kind. Generator unit tests and plan publish/old-enrollment integration tests. |
| 6 | Dedicated PDF inventory using protected ebook assets/resource links, grid/table, sequential batch upload with cancellation/retry, preview and metadata. Preserve 3 MiB limit and URL. | Asset version retention and descriptive metadata additive if needed. No new storage provider; test same URL replacement, denied download, Pro/free previews and partial batch failure. Lifecycle relationship depends on decision below. |
| 7 | Course workspace extending the existing chapter reader or linking separate new course records, based on ownership decision. Stable chapter IDs and ebook progress must survive. | Additive grouping/metadata only for existing tracks. New video handling is outside existing mechanism and must be designed explicitly; no fabricated upload integration. Course access/progress/completion regression and publish golden path. |
| 8 | Use `study_exams` as proposed editable hub with explicit cross-content link records and preserved static certification aliases; tabs, domain weights, coverage gaps and shared student landing. Bundle preflight validates all linked revisions before any mutation. | Additive `exam_domains`/link tables where existing syllabus topics cannot represent weights. No automatic title-based migration, forced publication of upcoming cards or cross-tenant links. Atomic bundle/conflict/permission/coverage tests. |
| 9 | Debounced search, lazy-loaded heavy editors, consistent empty/loading/error states, scoped keyboard shortcuts, responsive layouts, onboarding and `docs/admin-guide.md`. | Do not intercept shortcuts inside inputs or bypass confirmation/review. Browser golden paths for mocks/plans/PDFs/courses/bundles and student regression; dark/light tablet/mobile screenshots and axe/Lighthouse evidence. |

Do not add new optional migrations to the current startup seeding path without a reviewed rollout. Existing content requires type-specific backfill preserving visibility, access and hidden/readiness states; a blanket `status='published'` would be unsafe. Reverting application code must leave additive data intact. Flags must gate backend mutations, not merely hide buttons.

## 8. Baseline verification and Phase 0 delivery

- Dependencies installed from both existing lockfiles with `npm ci`; no package/lockfile changes.
- Root `npm test`: **325 passed, 0 failed**, no skipped tests in that command. It runs `test/*.test.js`, not all `*.integration.js` suites.
- Frontend `npm run lint`: **fails on untouched main: 42 errors, 33 warnings**. Includes effect-state/ref rules, declaration order, unescaped JSX, empty interface and `prefer-const`. No rules were disabled. Establish a separate baseline-fix commit before claiming any later phase meets the full lint bar.
- Root `npm run lint`: exits successfully but only prints **No linter configured**; not a real lint pass.
- Frontend production build: compilation, TypeScript and route generation completed, then the initial command exited 1 with a dependency `SecurityFatalError` notice. Repeating the same command **passed (exit 0)**, retaining the Next.js dependency security warning. This is not a resolved security finding; review the advisory and a compatible patch separately. No dependency version was changed.
- `npm run audit:deployment`: **0 critical, 4 warnings** (automatic seeding/migration, DB TLS verification, Render service-name mismatch); source-only, no service changes.
- Database integration, authenticated browser golden paths, screenshots and accessibility measurements have **not** run. No production or staging database was accessed, migrated or published to.

Manual review of this phase:

1. Compare this map with `/admin` and the existing `?section=tests`, `questions`, `study-plans` and `plans` entry points using an authorized local/staging account.
2. Open the current ebook studio and verify a track's PDF and chapters belong to the same ebook slug/access policy; do not publish or change access.
3. Inspect the service guards for a bundled public ebook and a published plan edition; confirm the redesign must preserve their restrictions.
4. Reproduce `npm test`, frontend `npm run lint` and `npm run build` from the two documented package roots; review failure categories before implementation.

Migrations: **none**. New dependencies/env vars/active feature flags: **none**. Runtime code, routes, authorization, content, payment configuration and deployment are unchanged. Rollback is reverting the documentation commit. New UI screens and dark/light screenshots are not claimed for an audit-only phase.

## 9. Decision needed before large changes

**Should Courses and IT PDFs have independent publication/access, or remain two views of the same existing ebook?**

Recommended: independent lifecycles for new course/PDF records, linked explicitly to existing ebooks and `study_exams`, while existing ebook slugs, entitlements, progress and bundled public content keep their current behavior. This needs an additive ownership/link design before the shared publishing UI is built. The lower-complexity alternative is two admin views of the same ebook, which means publishing/unpublishing affects both and does not fully satisfy independent content publishing.

Other conflicts do not need guessed behavior: keep immutable study-plan editions, protected public starter ebooks, four-option single-answer scored mocks, staging-only timed draft QA, and independent human-review gates. Record unsupported question/video capabilities as follow-ups unless their behavior is explicitly expanded. After the ownership decision, start with baseline lint remediation, then Phase 1; do not merge, deploy or publish without the already-required explicit approval.
