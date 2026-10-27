# SSC CGL 2026 Tier-I · Original Practice Mock 01 (DRAFT)

> **Status: DRAFT / UNREVIEWED / NOT PUBLISHED.** This is an independently authored practice mock, **not an official SSC question paper**. Human subject review and the secured full-length exam QA are mandatory before publication.

## What is included

| Section | Topic ID | Questions | CSV |
|---|---|---:|---|
| General Intelligence and Reasoning | `ssc26-m01-reasoning` | 25 | `reasoning.csv` |
| General Awareness | `ssc26-m01-awareness` | 25 | `general-awareness.csv` |
| Quantitative Aptitude | `ssc26-m01-quant` | 25 | `quantitative-aptitude.csv` |
| English Comprehension | `ssc26-m01-english` | 25 | `english.csv` |
| **Total** | | **100** | |

- `manifest.json`: stable mock ID `ssc-cgl-2026-mock-01`, **inactive** four-topic and four-section definition, +2 for correct, −0.50 for wrong, 60 minutes overall (15 minutes per section **for standard candidates only**, gated by the secure exam engine).
- `*.json`: 25 original MCQs each. Every question has four options, a single zero-based `answer` index, explanation, difficulty, subtopic and explicit `needs_human_review` status.
- `*.csv`: direct 8-column CSV compatible with the **existing** Admin → Questions → CSV question import control; one file per new topic. These contain only fields the API accepts. **Never upload all four CSVs into one topic.**
- `scripts/ssc-cgl-mock-01.js`: read-only validation (`node scripts/ssc-cgl-mock-01.js`) and optional deterministic CSV re-export (`node scripts/ssc-cgl-mock-01.js --write-csv`). The script has **no connection to Neon, Render or Vercel**, never runs migrations, never writes student data and never publishes a test.
- `test/ssc-cgl-mock-01.test.js`: schema, coverage, exact CSV parity, duplicate stems, negative marking, server-eligibility and answer leakage regression tests.

**Official pattern source:** SSC's [Combined Graduate Level Examination 2026 notification](https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_cgl_2026.pdf), §13.8/13.8.2: four sections of 25 questions, 200 marks total, 60 minutes with 15-minute sectional timer for standard candidates; +2 and −0.50. Scribe-eligible candidates have an extended 20-minute sectional timer (80 minutes total). ExamPro's currently deployed sectional gate supports the standard 15-minute path only. **Do not advertise this mock as accessible to candidates entitled to the extended arrangement until that separate implementation and tests exist.**

## Safe admin import after owner approves the PR (manual staging only)

The PR adds draft content files and the small admin improvements needed to create and preview **inactive** question topics. It does **not** insert questions into the production database.

1. Sign in to `/admin` with a verified admin email. Open **Questions** and create the **four new topics** from `manifest.json`. Use the exact topic IDs above, category `SSC`.
2. **Leave the new 'Publish topic immediately' checkbox unchecked.** The included admin change now creates new topics as **inactive drafts** by default. An active topic with questions automatically becomes a free topic-practice test even while its full mock remains unpublished. The mock's `active=false` flag alone is not sufficient.
3. For each matching topic, use **CSV question import → Choose CSV → Validate 25 rows → Import validated rows**. If an import reports duplicate rows, stop; do not retry blindly and do not import a second time. Preview checks do not mutate the database.
4. Open **Mock tests → New mock test**. Enter the exact `manifest.json` `mock` values. Add four sections in the listed order with topic ranges **0 up to 25 (exclusive)**. Save with **Draft** status. Do **not** publish, and do not activate topics yet.
5. Review all 100 stems, correct keys, explanations, difficulty, relevance, spelling, distractors and source provenance. Capture a named reviewer and sign-off *outside the public question file*. Translate/test UI separately if needed.
6. **Preview safely:** the protected **Mock tests → Preview** now loads draft questions from inactive topics for admin review, without publishing or exposing answer keys. The public mock catalogue continues to exclude inactive topics and inactive mocks. A draft cannot be taken by learners until explicitly activated.
7. After review, confirm 4×25 question coverage, run the SSC content audit, rehearse autosave, deadline and section locks, and ensure scribe eligibility handling before activating four topics and then publishing the mock. Activating topics also enables standalone topic-practice quizzes, so approval must explicitly cover those as well.

**Do not** run import SQL manually against production or amend Render's auto-migration/seeder. No payment or account changes are part of this milestone.

## Academic QA follow-up (27 October 2026)

- **All 100 questions were reviewed in an AI-assisted desk audit** covering calculation/logic, keyed answers, explanations, English grammar, topic breadth, and existing-bank similarities.
- **20 questions were revised** for ambiguity, near-duplicate practice patterns, cleaner assumptions, and underrepresented syllabus topics. See [QUALITY_AUDIT.md](QUALITY_AUDIT.md) for the 100-row findings and [quality-review.json](quality-review.json) for machine-checked answer texts.
- Syllabus gaps remain (illustrated reasoning, charts, cloze/longer reading comprehension, more representative current affairs). These are documented, not silently counted as complete.
- This is **not human academic approval**; question metadata `reviewStatus: needs_human_review` and `manifest.publicationAllowed=false` deliberately remain unchanged. Standard candidate 15-minute sections do not cover the additional 20-minute eligible-scribe policy.
- Originality audit found zero exact overlaps with 620 bundled previous practice stems. Similar concepts can still occur, and a deeper third-party originality review is required.

## Editorial checks (required, not passed yet)

- Every answer and explanation reviewed independently, including the 25 quantitative calculations, factual dates and 25 grammar/reading items. Automated syntax validation **does not prove correctness**.
- Record original authorship and screen for copyrighted/coaching-source overlap. This set is freshly written, but third-party overlap cannot be ruled out by a mechanical comparison.
- Check subtopic distribution and appropriate 2026 Tier-I difficulty. Review the 2026 official notice and avoid stale current affairs.
- On staging: score 100 correct = **200**, 99 correct + 1 wrong = **197.5**, 99 correct + 1 skipped = **198**. Verify answer keys remain hidden until submission.
- Secure 15-minute section boundaries, browser refresh, simultaneous tabs, delayed autosave and expiry tested. Accommodations remain a separate release gate.
- Obtain owner's explicit approval before any merge, Neon staging or production publication.

## Development commands

```bash
npm ci
node scripts/ssc-cgl-mock-01.js
npm test
cd exam-practice-pro
npm ci
npm run build
```

On Windows PowerShell, run those commands from the repository root (changing directory to `exam-practice-pro` only for the last two).

Issue [#36](https://github.com/yankeeDamn/Quiz-App/issues/36) remains open until **ten distinct original, independently reviewed full mocks** and accessible exam timing have been released. This PR addresses **only Mock 01 draft**, not all ten.
