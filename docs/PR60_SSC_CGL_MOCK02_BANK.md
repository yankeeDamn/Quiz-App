# PR #60 — Original SSC CGL 2026 Mock 02 candidate question bank

This PR adds **100 original candidate questions**, divided into Reasoning, General Awareness, Quant, and English (25 each), with 0-based answer indices, four options, and explanations.

## Files

- `content/ssc-cgl-2026-mock-02.questions.json`: staging content pipeline input. No import code runs automatically.
- `test/ssc-cgl-mock02-bank.test.js`: validates format, the 100 questions, explanations, uniqueness against **620 existing bundled question stems**, and the official four-section timing structure.

## Staging import procedure (separate manual action)

1. Confirm isolated staging Vercel, Render, and Neon. **Never paste this bank into production admin or run a migration.**
2. Admin → Tests → SSC CGL Mock 02–10 Draft Content QA; select Mock **02**.
3. Paste the JSON file and choose **Validate draft only**. The server compares it against all database question stems, including existing unpublished rows, which may differ from the 620 bundled questions.
4. Resolve duplicate and content errors before selecting **Create inactive staging draft**. This creates four inactive source topics and one unpublished Mock 02 in an atomic staging transaction only after explicit human confirmation.
5. Independently verify every English question/answer/explanation and source accuracy. Assign genuine academic reviewer approvals, **100/100**.
6. Generate Hindi drafts through the separate existing Azure tool only if desired. A bilingual reviewer must examine each of the **75** required Hindi versions and mark them verified.
7. Run private 60-minute four-section exam QA and obtain separate owner signoff. No publication or topic activation is authorized by this PR.

## Quality caveats

- Answer indices and worked calculations have been authored and subject to programmatic structural checks, **not certified by an independent academic subject-matter expert**. The 100 questions and 75 Hindi items remain pending human review.
- Duplicate tests catch normalized identical stems across the two bundled banks. Semantic near-duplicates and questions present exclusively in the live staging or production DB require additional reviewer inspection and staging preview checks.
- General Awareness facts are mostly evergreen but require independent fact-checking, source attribution where appropriate, and periodic content review.
- Do not treat a green CI result as permission to publish, approve Hindi, enable topics or alter production data.
