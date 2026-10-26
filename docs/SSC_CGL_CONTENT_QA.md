# SSC CGL Tier-I: 10 complete, original mocks — editorial acceptance

## Do not call practice sets "full mocks"
The production database currently has 621 question rows and 31 mock-test records, including 20 unpublished **25-question** practice sets spread across competitive subjects. There are only 2 published SSC CGL-labelled mock-test definitions, and neither inventory count alone proves a standards-compliant 100-question paper.

## Goal and evidence
Produce **10 independent, fully reviewed Tier-I mocks**, each with 100 original questions, 25 each:
- General Intelligence and Reasoning
- General Awareness
- Quantitative Aptitude
- English Comprehension

Use **+2 correct, -0.50 incorrect, 60 minutes overall**, and check the applicable 2026 SSC CGL official notification for any sectional timers or accommodations before publishing. Current exam engine only has one overall deadline; section-level timing may need a separate implementation. This document is an editorial readiness standard, not a claim that the app already matches all official rules.

## Publication gate for each mock
1. Named reviewer records sources, syllabus coverage, and current official pattern. Do not copy copyrighted coaching question banks.
2. Each question has four plausible options, a single verified correct answer and a useful original explanation explaining *why*.
3. Verify coverage across subtopics, language clarity and reasonable difficulty; check dates/current-affairs statements.
4. Reject duplicates within a mock and substantial repetition across mocks, including paraphrased copies.
5. Compare expected vs actual mark calculation on a sample completed test; validate Hindi/Bangla translations separately where available.
6. Test full 60-minute exam flow, negative marking, save/resume, expiry, answer reveal only after submission and mobile responsiveness.
7. Keep unreviewed tests inactive in Neon. Publish from the existing protected Admin dashboard only after sign-off.
8. Run `node scripts/audit-ssc-cgl.js` against a **read-only** production or isolated DB connection. This program only audits; it never publishes, edits, or runs migrations.

## Capacity estimate
10 × 100 = 1,000 **question slots**. If avoiding reuse across all papers, aim for at least 1,000 distinct, reviewed question stems. The current 125-question CGL topic group is useful as a starting point, not a completed 1,000-question release.

## Tracking spreadsheet format
Columns:
`test_id,section,subtopic,question,option_a,option_b,option_c,option_d,correct_option,explanation,source_reference,reviewer,review_status`.
Keep working content in a separate authoring branch or reviewed import file. Never import directly to active production tests.
