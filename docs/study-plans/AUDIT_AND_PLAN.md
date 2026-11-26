# Study Plans: pre-implementation audit and plan

Inspected main at `031cde665b1349bcd11ffd03ef6963f37569e30b`, 26 November 2026.

## Existing architecture
- Next.js App Router/React/TypeScript in `exam-practice-pro`; Express CommonJS API in `src`; PostgreSQL via `src/config/database.js`.
- `authenticateNextAuth` verifies the signed OAuth bridge and reloads canonical user identity/plan from PostgreSQL. Owner administration uses the configured ADMIN_EMAILS allowlist. Reuse both; no new login.
- Questions live in `mock_questions`, grouped by `mock_topics`; stable UUIDs, publication/review/access fields, validated imports in `question-import.js`. Mock attempts live in `exam_attempts_v2`; do not copy questions or results.
- Ebook Studio owns ebooks and PDF uploads. `ebook_pdf_assets` stores bounded, parsed PDF bytes privately; existing routes stream authorized bytes and render restricted previews. No new storage vendor or PDF viewer needed.
- Products match the request: SSC_PACK_49 49 INR/30 days, IT_EBOOK_PACK_99 99/60, PRO_MONTHLY 199/30, PRO_ANNUAL 999/365. Pro grants update canonical users.plan/plan_expires_at; institute plans can be preserved on Pro purchase. Exam passes do not update that balance.
- Important revocation detail: existing revokePlan clears users.plan/expiry but leaves monetization_grants. Study access must require an active canonical paid balance AND Pro scope, not blindly call the broader entitlement helper (which accepts institute plans and old grants). Preserve all existing payment flows. Institute accounts require an active explicit Pro grant in addition to their active balance.
- Tests use node:test and opt-in PostgreSQL integration scripts; frontend ESLint/TypeScript/Next build. Root lint is currently a no-op.
- No AGENTS.md found. No existing Study Plans entity. General API limiter and adminLimiter exist.

## Implementation design (written before feature edits)
1. Add an opt-in, additive SQL migration for exams, versioned syllabus hierarchy, plans/days/tasks, resource/PYQ metadata links, enrollments and task completions. Use foreign keys, bounded fields and indexes. No existing product/schema destruction or content publication.
2. Use immutable published plan editions; clone to a new draft edition to change tasks. Students stay on their enrolled edition, including its stable task IDs. Explicit archival hides content but retains progress. No destructive editor delete operations.
3. Admin allowlist guard, structured CRUD, ordering, preview and explicit publish/archive operations. Validate all references before publishing. Syllabus verification/source required; tasks link existing question, mock and ebook IDs.
4. Public catalogue exposes safe overview metadata only. Free preview is explicitly selected per task; full tasks/progress/PDF delivery check Pro entitlement on the server. Progress is computed from completion rows; every query scopes to authenticated user ID. Schedule uses chosen start date; no missed-day locks.
5. Extend the current importer with strict answer validation and PYQ metadata, transactional duplicate checks, preview and row errors. Imported questions remain draft/unverified unless provenance is explicitly verified by an admin.
6. Reuse private ebook storage/upload/renderer. Study resource delivery checks plan + task + resource + ebook permissions. Premium attachments must reference a Pro-protected ebook; external links are only permitted as public references. No private storage identifiers returned to students.
7. Add unit/API and isolated PostgreSQL tests, run regression suite and frontend checks. Document local/staging verification, no-op rollback (hide module/revert code while retaining data), deployment prerequisites and content limitations.

## Content verification
Official 2026 notice discovered at https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_cgl_2026.pdf; retrieval timed out during audit. Discovery alone is not verification. Do not seed official topics/PYQs or publish a purported complete SSC roadmap until source review succeeds. Catalogue placeholders are explicitly upcoming. Use synthetic questions only in isolated test fixtures, never production seeds.

## Safety
No production credentials, DB migrations, content publish, deployment or merge are authorized. A review branch/PR is authorized. All execution tests must use an isolated database. Published content must only be created by a human administrator after approval.

## Verification follow-up
The official PDF became retrievable later in the session. Its sections 13.10.1 and 13.11.1.1 support the small, draft-only two-topic sample in `content/study-plans/ssc-cgl-sample.json`. Stage hierarchy remains configurable. No question provenance was inferred or fabricated; no source PDF was redistributed. The sample is not a complete syllabus and is not automatically imported. A human must review amendments and approve the full content before publication.
