# ExamPro legacy practice library editing

## Why this exists

ExamPro has three separate sources of practice content:

- **Neon-scored mock tests:** `mock_topics`, `mock_questions`, `mock_tests` (existing Admin → Questions / Mock tests)
- **Homepage local practice:** `exam-practice-pro/data/quizzes.ts` (supports single, multiple and true/false)
- **Certification starter practice:** `exam-practice-pro/data/it-certification-questions.json` (24 four-choice original questions)

The latter two previously had **no admin editor**. Their question IDs and local quiz URL routes must remain unchanged to preserve existing saved local attempts, bookmarks, and review behaviour.

## New workflow

1. Back up existing Neon production. Merge this PR after CI and review.
2. Deploy the latest `main` on the existing Render **Express API** service. It has auto-deploy **disabled**. Its build command must remain `npm ci --omit=dev && npm run db:migrate`. This adds only `practice_question_overrides`, a new table; it leaves old questions and attempts intact.
3. Deploy the Next.js frontend on Vercel (ensure the production build includes this PR).
4. Admin → **Practice Library** → select `Homepage practice quizzes` or `IT certification starters` → select quiz and question → edit text, choices, correct answers, explanations → Save.
5. Open the original practice page as a new learner session to verify the updated question. Old local sessions intentionally retain their snapshot.

Changes in `practice_question_overrides` are fetched on new practice sessions; the original JSON/TS bundled questions remain the fallback if Render/Neon is temporarily unavailable. No database seeding is needed for baseline practice content. Rows are written only when the admin saves an edit.

## Behaviour and limitations

- The old client-side quiz engine remains **practice/legacy only** and browser-scored. It is not the separate server-scored `/india-mocks` engine.
- Public practice-only overrides contain answers and explanations, just like the existing bundled client-side practice questions. Never use this API for secure server-scored exams.
- Homepage quizzes can share a question ID, so editing a shared question updates all new sessions in every quiz that uses it.
- Starter certifications and homepage practice are **distinct** even when their labels both mention AWS or Azure. Editing one source does not update the other.
- This milestone updates **existing** bundled questions; adding entirely new legacy questions or whole quizzes is deliberately out of scope. New scored exams should be created using Admin → Topics/Mock tests.
- Changes display without redeploying either service **after both new versions are live**.
- This migration is additive. No change to existing `mock_topics`, `mock_questions`, `mock_tests`, scores or existing saved attempts.
- If the API is offline, the bundled starter questions can still run using the original content, and Admin will report the API error.
