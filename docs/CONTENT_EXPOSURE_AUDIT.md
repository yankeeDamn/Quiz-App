# Content exposure audit

Audit date: 2026-11-02. Baseline: `6e3d6c26968625e4fb2e01fc51e197fd91a3ede8` (origin/main). Repository: **public**. This report was written before implementation. No live database records were inspected or modified; deployment documents are historical evidence, not a current production inventory.

## Method and limits

Fetched all advertised branches and tags and unshallowed the repository. Examined all reachable versions of JSON, CSV, JS, TS, TSX, HTML, Markdown and SQL for question/options plus answer keys; traced seeders, API routes, public client imports and admin tier controls. Reviewed `git log --all --stat -- content src/data` as requested. The scan covered 685 commits, 79 branch refs, 428 candidate paths and 951 distinct blobs. Counts below count records, not necessarily unique questions. CSV/JSON duplicates are identified. Deleted GitHub objects, unreachable refs, forks, cached pages and external clones cannot be exhaustively enumerated from this checkout.

## Current question and answer files

| File | Answer-bearing records | Classification | Mapping/evidence | Recommended action |
| --- | ---: | --- | --- | --- |
| `src/data/mock-bank.json` | 120 | Mixed: 28 free-only, 42 shared free/Pro, 44 Pro-only, 6 topic-only | seed-content inserts 11 active definitions (5 free, 6 premium); all 10 topics active. Topic practice currently exposes ALL 120, bypassing the test-tier flag. | Remove entire mixed bank; database/private seed only. |
| `src/data/competitive-questions-500.json` | 500 | Draft (free tier if subsequently approved) | seed-competitive creates 20 inactive free practice sets of 25; questions themselves currently default active. | Remove; private seed only. |
| `content/ssc-cgl-2026-mock-02.questions.json` | 100 | Unpublished draft; no assigned paid tier | Manual SSC pipeline input, not automatically seeded; editorial and bilingual approval absent. | Remove; private authoring input. |
| `content/it-certifications/starter-questions.csv` | 24 | Unpublished free-practice candidates | README marks all needs_review; manual CSV import, no Pro assignment. | Remove; private review/import source. |
| `exam-practice-pro/data/it-certification-questions.json` | 88 | Intentionally public free practice; not reviewed exam content | it-certs.ts imports into client practice-only runner; no paid entitlement applies. review_status includes needs_review. | Keep free practice only; visible under-review label. |
| `exam-practice-pro/data/quizzes.ts` | 33 | Intentionally public free homepage practice | Client-side free quiz bank; no Pro test linkage. Answer keys are intentionally public practice feedback. | Keep explicitly free; under-review badge. |
| `content/separate-exam-practice-starter.json` | 36 | Intentionally public free introductory practice | separate-exams.ts bundles these into practice-only tests; timed mock mode blocked. | Keep free practice only; under-review badge. |
| `content/ebooks-starter.json` | 250 (150 final + 100 chapter checks) | Intentionally public free starter learning content; not an official certification | Public starter tracks imported by frontend and seed-ebooks; custom private ebooks live in DB under RBAC. No Pro mock mappings in seeds. | Keep public learning practice; disclose under-review status, do not claim verified exam readiness. |
| `exampro/index.html` | 120 compact array records (legacy starter copy) | Mixed legacy starter copy; tier is not enforced by static HTML | Independent legacy JS bank; cannot make paid claims or enforce entitlement in client HTML. | Remove legacy bundled bank with retired demo; route users to supported app. |
| `content/ssc-cgl-2026/mock-01/english.json` | 25 (CSV duplicates JSON) | Unpublished draft; not automatically Pro | manifest publicationAllowed=false, active=false, needs_human_review; manual admin import. | Remove private draft source; retain metadata/review tooling. |
| `content/ssc-cgl-2026/mock-01/english.csv` | 25 (CSV duplicates JSON) | Unpublished draft; not automatically Pro | manifest publicationAllowed=false, active=false, needs_human_review; manual admin import. | Remove private draft source; retain metadata/review tooling. |
| `content/ssc-cgl-2026/mock-01/general-awareness.json` | 25 (CSV duplicates JSON) | Unpublished draft; not automatically Pro | manifest publicationAllowed=false, active=false, needs_human_review; manual admin import. | Remove private draft source; retain metadata/review tooling. |
| `content/ssc-cgl-2026/mock-01/general-awareness.csv` | 25 (CSV duplicates JSON) | Unpublished draft; not automatically Pro | manifest publicationAllowed=false, active=false, needs_human_review; manual admin import. | Remove private draft source; retain metadata/review tooling. |
| `content/ssc-cgl-2026/mock-01/quantitative-aptitude.json` | 25 (CSV duplicates JSON) | Unpublished draft; not automatically Pro | manifest publicationAllowed=false, active=false, needs_human_review; manual admin import. | Remove private draft source; retain metadata/review tooling. |
| `content/ssc-cgl-2026/mock-01/quantitative-aptitude.csv` | 25 (CSV duplicates JSON) | Unpublished draft; not automatically Pro | manifest publicationAllowed=false, active=false, needs_human_review; manual admin import. | Remove private draft source; retain metadata/review tooling. |
| `content/ssc-cgl-2026/mock-01/reasoning.json` | 25 (CSV duplicates JSON) | Unpublished draft; not automatically Pro | manifest publicationAllowed=false, active=false, needs_human_review; manual admin import. | Remove private draft source; retain metadata/review tooling. |
| `content/ssc-cgl-2026/mock-01/reasoning.csv` | 25 (CSV duplicates JSON) | Unpublished draft; not automatically Pro | manifest publicationAllowed=false, active=false, needs_human_review; manual admin import. | Remove private draft source; retain metadata/review tooling. |
| `content/ssc-cgl-2026/mock-01/quality-review.json` | 100 answer letters/texts and rationales | Unpublished draft answer-key duplicate | AI desk audit, publicationApproved=false; not teacher approval. | Remove with private draft sources. |
| `content/ssc-cgl-2026/mock-01/QUALITY_AUDIT.md` | 100 keyed answers/rationales | Unpublished draft key duplicate | Manual follow-up inspection found a human-readable answer-key trail. | Remove with private authoring sources. |
| `exam-practice-pro/app/exampro/page.tsx` | 1 inline demonstration | Public free arithmetic sample | Landing-page example explains the selected correct choice; not an exam bank. | Keep nonsensitive public demo. |

## Historical paths and versions

Every detected answer-bearing path is listed below, including source-code fixtures and blank authoring examples. Version counts are distinct answer-bearing blobs, not commits. An existing path may no longer contain its historical bank.

| Path | Answer-bearing versions | In baseline tree? | Classification |
| --- | ---: | --- | --- |
| `content/ebooks-starter.json` | 2 | Yes | See current inventory above; earlier versions remain exposed. |
| `content/it-certifications/starter-questions.csv` | 1 | Yes | See current inventory above; earlier versions remain exposed. |
| `content/separate-exam-practice-starter.json` | 1 | Yes | See current inventory above; earlier versions remain exposed. |
| `content/ssc-cgl-2026-mock-02.questions.json` | 2 | Yes | See current inventory above; earlier versions remain exposed. |
| `content/ssc-cgl-2026/mock-01/english.csv` | 4 | Yes | See current inventory above; earlier versions remain exposed. |
| `content/ssc-cgl-2026/mock-01/english.json` | 4 | Yes | See current inventory above; earlier versions remain exposed. |
| `content/ssc-cgl-2026/mock-01/general-awareness.csv` | 4 | Yes | See current inventory above; earlier versions remain exposed. |
| `content/ssc-cgl-2026/mock-01/general-awareness.json` | 4 | Yes | See current inventory above; earlier versions remain exposed. |
| `content/ssc-cgl-2026/mock-01/quantitative-aptitude.csv` | 4 | Yes | See current inventory above; earlier versions remain exposed. |
| `content/ssc-cgl-2026/mock-01/quantitative-aptitude.json` | 4 | Yes | See current inventory above; earlier versions remain exposed. |
| `content/ssc-cgl-2026/mock-01/reasoning.csv` | 3 | Yes | See current inventory above; earlier versions remain exposed. |
| `content/ssc-cgl-2026/mock-01/reasoning.json` | 3 | Yes | See current inventory above; earlier versions remain exposed. |
| `docs/PR59_SSC_CGL_DRAFT_PIPELINE.md` | 1 | Yes | Documentation sample or blank authoring template, not a production bank; no paid assignment. |
| `exam-practice-pro/README.md` | 2 | Yes | Documentation sample or blank authoring template, not a production bank; no paid assignment. |
| `exam-practice-pro/app/india-mocks/[id]/page.tsx` | 1 | Yes | Historical legacy public bank/inline runner; tier unverified. Treat as exposed, remove during owner history cleanup. |
| `exam-practice-pro/components/admin/questions-tab.tsx` | 6 | Yes | Documentation sample or blank authoring template, not a production bank; no paid assignment. |
| `exam-practice-pro/components/certifications/ebook-command-panels.tsx` | 1 | Yes | Documentation sample or blank authoring template, not a production bank; no paid assignment. |
| `exam-practice-pro/components/certifications/ebook-studio.tsx` | 3 | Yes | Documentation sample or blank authoring template, not a production bank; no paid assignment. |
| `exam-practice-pro/data/it-certification-questions.json` | 3 | Yes | See current inventory above; earlier versions remain exposed. |
| `exam-practice-pro/data/quizzes.ts` | 1 | Yes | See current inventory above; earlier versions remain exposed. |
| `exampro/index.html` | 2 | Yes | See current inventory above; earlier versions remain exposed. |
| `public/script.js` | 1 | No | Historical legacy public bank/inline runner; tier unverified. Treat as exposed, remove during owner history cleanup. |
| `script.js` | 1 | No | Historical legacy public bank/inline runner; tier unverified. Treat as exposed, remove during owner history cleanup. |
| `src/data/competitive-questions-500.json` | 1 | Yes | See current inventory above; earlier versions remain exposed. |
| `src/data/mock-bank.json` | 2 | Yes | See current inventory above; earlier versions remain exposed. |
| `src/db/seed.js` | 1 | No | Historical legacy public bank/inline runner; tier unverified. Treat as exposed, remove during owner history cleanup. |
| `src/routes/admin.js` | 20 | Yes | Documentation sample or blank authoring template, not a production bank; no paid assignment. |
| `test/content.test.js` | 2 | Yes | Synthetic validation/security fixtures; no paid entitlement. Retain only nonsensitive examples. |
| `test/ebooks.test.js` | 2 | Yes | Synthetic validation/security fixtures; no paid entitlement. Retain only nonsensitive examples. |
| `test/exam-grade.test.js` | 1 | Yes | Synthetic validation/security fixtures; no paid entitlement. Retain only nonsensitive examples. |
| `test/exam-sessions.test.js` | 2 | Yes | Synthetic validation/security fixtures; no paid entitlement. Retain only nonsensitive examples. |
| `test/it-certification-pr63-expansion.test.js` | 1 | Yes | Synthetic validation/security fixtures; no paid entitlement. Retain only nonsensitive examples. |
| `test/mock-publication-readiness.test.js` | 1 | Yes | Synthetic validation/security fixtures; no paid entitlement. Retain only nonsensitive examples. |
| `test/mock01-02-audit.test.js` | 2 | Yes | Synthetic validation/security fixtures; no paid entitlement. Retain only nonsensitive examples. |
| `test/mock01-quality-accessibility.test.js` | 1 | Yes | Synthetic validation/security fixtures; no paid entitlement. Retain only nonsensitive examples. |
| `test/practice-additions.test.js` | 2 | Yes | Synthetic validation/security fixtures; no paid entitlement. Retain only nonsensitive examples. |
| `test/practice-overrides.test.js` | 1 | Yes | Synthetic validation/security fixtures; no paid entitlement. Retain only nonsensitive examples. |
| `test/question-import.test.js` | 1 | Yes | Synthetic validation/security fixtures; no paid entitlement. Retain only nonsensitive examples. |
| `test/separate-exam-and-cert-banks.test.js` | 2 | Yes | Synthetic validation/security fixtures; no paid entitlement. Retain only nonsensitive examples. |
| `test/ssc-cgl-mock-01.test.js` | 3 | Yes | Synthetic validation/security fixtures; no paid entitlement. Retain only nonsensitive examples. |
| `test/ssc-content-pipeline.test.js` | 3 | Yes | Synthetic validation/security fixtures; no paid entitlement. Retain only nonsensitive examples. |
| `exam-practice-pro/data/india-exams.ts` | 1 | No | Historical answer-key/compact-array candidate; inspect/remove with corresponding private draft source. |
| `src/data/exam-catalog.js` | 1 | No | Historical answer-key/compact-array candidate; inspect/remove with corresponding private draft source. |

| `content/ssc-cgl-2026/mock-01/quality-review.json` | 1 | Yes | See current inventory; duplicate private draft key or nonsensitive public example. |
| `content/ssc-cgl-2026/mock-01/QUALITY_AUDIT.md` | Manual inspection | Yes | See current inventory; duplicate private draft key or nonsensitive public example. |
| `exam-practice-pro/app/exampro/page.tsx` | Manual inspection | Yes | See current inventory; duplicate private draft key or nonsensitive public example. |

Supplemental manual inspection found the duplicate SSC desk-review trails above and the one-question landing-page demonstration. They are included explicitly even where the initial literal-object scan did not match their format. The original audit commits precede remediation; this supplement records follow-up discoveries.

## Findings

1. **Pro bypass:** the admin “Pro plan only” flag is `mock_tests.tier`, not a property of question rows. `mocks.service.topicDefinitions()` creates free topic tests for every active topic. `/mocks/:id/practice` returns keys for those topics. Test-level denial alone therefore does not protect the 44 Pro-only or 42 shared starter questions.
2. **Public source exposure:** all files above, their git versions and client bundles can be read without an account. API protection cannot recover secrecy for these versions. Treat exposed paid questions as compromised and replace them from an independently reviewed private source.
3. **Review gap:** `mock_question_reviews` records per-paper SSC evidence, but general mock questions lack a publication status. Active flags alone expose drafts; practice overrides/additions also go live without a publication gate. Existing SSC teacher/bilingual/full-paper checks must remain.
4. **Free != reviewed:** the homepage, IT certification, separate starter and ebook banks are free practice. Their correct answers being public is intentional; it does not prove teacher review or official exam alignment. A visible under-review label is required. Never treat 25-question sets as complete SSC papers.
5. **Pre-submission secrecy:** scored exams use server snapshots and `visibleAttempt()` explicitly projects stems/options without keys. `/mocks/:id` strips answer/explanation. Tests must cover HTTP denials and saved/resumed attempts, not only pure grading.

## Decision and implementation contract

Use **database-only delivery** for paid/unpublished content and optional `PRIVATE_CONTENT_DIR` deploy-time input outside the tracked tree. Remove mixed and draft banks, CSV copies and the legacy static demo from the public branch. Preserve an ignored local source copy during development; the owner must store the original source in a private repository or private deploy artifact. No live data is deleted. Default new/imported questions to draft, publish only explicitly reviewed questions, grandfather only currently active free practice that does not overlap paid definitions, and deny free-topic delivery of paid-assigned rows. A one-time migration marker prevents re-publishing future drafts on reruns. Public free legacy practice stays visibly under review; do not invent teacher approvals.

## Owner follow-up (required; not executed here)

1. Before merge, back up the database and export original content into an access-controlled private repository/artifact. Configure private deployment access if reseeding is needed; otherwise existing database rows remain the source and migrations skip absent private seeds. Do not place private source or its credentials in the frontend, build output or public CI artifacts.
2. After review/merge/deploy, run `npm run db:migrate` on the API environment. It must be safe twice and must not delete questions. Review/publish intended questions in admin; existing paid and unpublished rows remain draft until approved. Verify staging with anonymous, free and paid accounts.
3. Replace already-exposed paid questions. For temporary containment, make the GitHub repository private in Settings → General → Danger Zone (if your account/organization permits); this does not revoke existing clones.
4. Coordinate a history rewrite separately after preserving private originals, freezing pushes and notifying collaborators. The following is an **owner-run destructive history operation**, not part of this PR. Use a disposable mirror and inspect the resulting paths before force-pushing. Back up first; adapt paths for any newly discovered copies.

```bash
git clone --mirror git@github.com:yankeeDamn/Quiz-App.git Quiz-App-clean.git
cd Quiz-App-clean.git
git filter-repo --invert-paths \
  --path src/data/mock-bank.json \
  --path src/data/competitive-questions-500.json \
  --path content/ssc-cgl-2026-mock-02.questions.json \
  --path content/ssc-cgl-2026/mock-01/quality-review.json \
  --path content/ssc-cgl-2026/mock-01/QUALITY_AUDIT.md \
  --path exam-practice-pro/data/india-exams.ts --path src/data/exam-catalog.js \
  --path content/ssc-cgl-2026/mock-01/english.json --path content/ssc-cgl-2026/mock-01/english.csv \
  --path content/ssc-cgl-2026/mock-01/general-awareness.json --path content/ssc-cgl-2026/mock-01/general-awareness.csv \
  --path content/ssc-cgl-2026/mock-01/quantitative-aptitude.json --path content/ssc-cgl-2026/mock-01/quantitative-aptitude.csv \
  --path content/ssc-cgl-2026/mock-01/reasoning.json --path content/ssc-cgl-2026/mock-01/reasoning.csv \
  --path content/it-certifications/starter-questions.csv \
  --path exampro/index.html --path script.js --path public/script.js --path src/db/seed.js
# filter-repo normally removes origin; restore it only after inspecting the mirror.
git remote add origin git@github.com:yankeeDamn/Quiz-App.git
# Only after coordinating protected branches, tags and every collaborator:
git push --force --mirror origin
```

Historical inline runner `exam-practice-pro/app/india-mocks/[id]/page.tsx` also contained keys. Removing that whole path would remove useful route history; extract the historical blob identified by the audit and use an audited `git filter-repo --blob-callback` or `--replace-text` rule to remove its literal bank while preserving the route. Do not guess a broad regex against executable source. Check all advertised feature branches and tags, not only main. Ask GitHub Support about cached PR refs and cached views where applicable.

**Already-cloned copies, forks, caches and downloaded bundles keep old content even after a rewrite.** Collaborators must reclone; do not merge old branches back. History cleanup is hygiene, not restored secrecy. No force-push, repository visibility change, production migration or merge was performed for this audit.

## Implemented remediation and rollout impact

- Removed the complete mixed 120-question starter, 500-question draft bank, both 100-question draft paper sources and duplicate SSC CSV/JSON/desk-review keys, plus the unreviewed 24-question CSV. Replaced the legacy HTML bank with a portal link. No private repository was created and no live database row was changed. A local ignored `.private-content/` copy preserves source during implementation; it is **not durable hosting**. The database remains the deployed source. The owner must preserve private source separately before cleanup.
- Tests generate synthetic questions from a tiny template and nonsensitive structural metadata. Runtime offline mode contains one explicitly synthetic free demo; it never falls back to paid/draft source. Private input is read only by migration/authoring scripts with `PRIVATE_CONTENT_DIR`, never by the public content service. New private seeds remain inactive drafts.
- `question-review.sql` adds draft/reviewed/published state, review identity/time and Free/Pro question access. Its one-time backfill only publishes currently active free topic practice not referenced by any paid definition. It preserves all question text and answer rows. With the unedited historic starter, **34** rows qualify (28 free-only plus 6 topic-only); the 86 paid/shared rows remain draft. Actual deployed counts can differ after owner edits.
- Public builders exclude draft/reviewed-only rows, free practice rejects paid range assignments (even inactive paid definitions), and any incomplete configured mock is withheld as a whole. **Some existing free/paid mock definitions will disappear from the catalogue until the owner reviews and publishes every configured question.** It never silently turns a full paper into a shorter one.
- Human OAuth admins can mark a question reviewed, choose access and publish; content edits reset approval to draft. Public legacy-practice overrides/additions also require a separate review/publish step. Existing SSC academic/Hindi/full-paper release gates remain mandatory. API keys cannot claim human review. Publication changes are read on every request, across API instances.
- Existing intentionally public free learning banks stay available as practice with EN/Hindi/Bangla under-review badges. Ebook result wording says learning practice completion rather than claiming verified certification readiness. WhatsApp reports include stable question IDs; the application does not send question text automatically through these report links.

Validation: root tests and production frontend build are run without DSNs. A disposable PostgreSQL CI test covers preserving rows, excluding shared paid/draft/retired content, default-draft imports and applying the migration twice. Staging remains unchanged until this PR is reviewed, merged and deployed by the owner; a local/PR preview can demonstrate the badge first.
