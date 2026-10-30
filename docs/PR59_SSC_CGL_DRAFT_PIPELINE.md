# PR #59 — SSC CGL Mock 02–10 draft content pipeline

## Scope and protection

This PR adds an **isolated staging-only** pipeline for Mock 02 through Mock 10. It does not create content during deployment, execute migrations, or modify any live database. Access requires the existing strict staging gate and a verified allowlisted human admin account. Neither API keys nor students can run this pipeline.

### Proposed content format

Paste a JSON object with exactly four arrays: `reasoning`, `general-awareness`, `quant`, and `english`, **25 questions each**. Each item must have `question`, `options` (four distinct strings), `answer` (zero-based index, 0–3), `explanation` (at least 15 characters), and optional `difficulty` (Easy, Moderate or Hard). Use original, rights-cleared questions with checked keys and meaningful explanations.

```json
{
  "reasoning": [
    {"question":"Which number follows 3, 6, 12, 24?","options":["36","42","48","60"],"answer":2,"explanation":"Each number is twice the previous number.","difficulty":"Moderate"}
  ],
  "general-awareness": [],
  "quant": [],
  "english": []
}
```

The example deliberately contains fewer than 100 questions and will **not** validate.

### Workflow

1. Deploy reviewed code only to an isolated staging Render API and staging Vercel frontend.
2. In staging Admin → Tests → **SSC CGL Mock 02–10 Draft content QA**, choose number 02–10 and paste all 100 questions.
3. Choose **Validate draft only**. It checks 4×25 structure, required explanations, distinct choices, duplicate normalized stems within the upload and against **all existing mock questions** (including inactive banks), and blocks untrusted imported `hindiStatus:'verified'` flags.
4. If the preview passes, a separate confirmation permits creating the draft. The backend repeats validation **inside a database transaction**; it atomically creates four inactive source topics, 100 questions under those inactive topics, and one **inactive** 60-minute four-section test with +2 / -0.5 marking. It refuses to overwrite existing IDs.
5. Use the already-existing Admin → Tests → **Review questions** to record genuine, independent academic approval (100/100) and bilingual Hindi verification (75/75). Azure-generated Hindi is a pending draft; this pipeline does not mark it verified.
6. **Load draft progress** displays existing Mock 02–10 counts and review totals. Continue with private staging testing.

### Limitations and review gates

- Exact normalized duplicates are detected; close semantic paraphrases require human editorial review.
- This is an interactive **staging database write** if a human explicitly confirms **Create inactive staging draft**. Opening or merging this PR alone never inserts content.
- No publishing endpoint, automatic topic activation, automatic human approval or live data mutation is added.
- Before merging, review authorization and verify CI Node.js 18/20/22 and frontend production build; perform staging tests with disposable sample data. Keep production draft testing disabled.
- Do not launch mocks or claim content is independently verified solely from passing checks. Keep Mock 01 publication separately gated.
