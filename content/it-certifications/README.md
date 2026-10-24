# IT certification question bank — v1

This folder contains **24 newly authored, introductory practice questions** in `starter-questions.csv`: eight each for AZ-900, AWS-CLF-C02 and CompTIA A+. They are **not official questions, exam dumps, or vendor-endorsed content**. All entries are marked `needs_review`; have a qualified reviewer verify technical accuracy and alignment to the **current** official exam objectives before publishing.

## Upload format

Use UTF-8 CSV with the exact header from `starter-questions.csv`:

| Column | Description |
| --- | --- |
| id | Unique stable question identifier |
| exam_code | Certification track, e.g. AZ-900, AWS-CLF-C02, CompTIA-A+ |
| subject | Broad knowledge domain |
| topic | Specific topic for analytics and filtering |
| difficulty | Easy, Medium, Hard |
| question_type | `single` for this initial schema |
| question | Original question text |
| option_a through option_d | Four answer choices |
| correct_option | A, B, C, or D |
| explanation | Explain why the correct answer is correct |
| language | ISO language code, initially `en` |
| source_type | `original`, `licensed`, or `institute_owned` |
| review_status | `needs_review`, `approved`, or `rejected` |

**Never upload proprietary exam dumps or copyrighted vendor questions without permission.** Preserve original source/license metadata for imported institute content. Do not expose `correct_option` to a student-facing exam API before submission.

## Validation and import workflow

1. Open the CSV in Excel or Google Sheets, or provide your existing question file for conversion.
2. Keep the header and fill all required fields; give each row a stable unique ID.
3. Review every answer and explanation; change `review_status` to `approved` only after a subject-matter expert signs off.
4. Run `python scripts/validate_it_questions.py content/it-certifications/starter-questions.csv` from the repository root.
5. The current PR intentionally **does not insert questions into a production database**. A later authenticated institute-admin import API must validate rows, enforce tenant ownership, store answers separately, and support idempotent imports.

## Next implementation PRs

- **PR 2:** PostgreSQL tables for exam catalogs, question banks, versioned questions, imports, and institute ownership; role-based admin import endpoint; audit log.
- **PR 3:** Student-facing exam delivery and server-side scoring (no answer key sent before submission), attempts, results, and basic analytics.
- **PR 4:** Teacher review queue, institute branding and paid pilot onboarding.

## Suggested pilot milestones

- 3 certification tracks; first 24 questions are sample content, not a complete mock exam.
- Expand to 100–150 **reviewed** questions per track, organized by official exam objectives.
- Run a 10–20 learner pilot, track completion, errors, explanations rated unclear, and willingness to pay.
- Offer institute-specific question libraries only after authorization and tenant-isolation tests pass.
