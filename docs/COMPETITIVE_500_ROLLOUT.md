# ExamPro: 500 SSC, CGL, Banking and Railway questions

## Status: source committed; content staged as drafts (not publicly live)

This change adds `src/data/competitive-questions-500.json` with:
- SSC CHSL / MTS — 125 questions.
- SSC CGL — 125 questions.
- Banking IBPS / SBI — 125 questions.
- Railway RRB NTPC / Group D — 125 questions.

There are **470 original practice MCQs**, **25 adapted prior-paper examples**, and
**5 IBPS illustrative/sample questions**, with four answer options and explanations.
The 30 source-labelled questions are adaptations/samples, not verbatim official
previous-year papers or authoritative answer keys. Verify factual content before
publication, especially changing general awareness and financial regulations.

The integration creates **4 separate exam topics** and **20 sets of 25 questions**.
New topics and sets start **inactive/draft**. No existing 120-question content,
saved attempts, scores, published tests or owner edits are replaced.

## Review, test and import safely

1. Review `src/data/competitive-questions-500.json` and the 30 source
   references, and fix any incorrect content before publishing.
2. Ensure the configured Render API uses the existing Neon `DATABASE_URL`.
   Check `GET /api/v1/health/ready` and back up Neon before any migration.
3. From the repository root, run `npm ci`, `npm test`,
   then `npm run db:migrate`. The same migration command is safe to re-run.
   Competitive seeding runs after the existing `exampro-v2.sql` migration.
4. Confirm **4 new topics, 500 new questions, 20 inactive tests**:

   ```sql
   SELECT t.id, t.category, t.active, COUNT(q.id) AS questions
     FROM mock_topics t
     LEFT JOIN mock_questions q ON q.topic_id = t.id
    WHERE t.id IN ('comp-ssc-chsl-mts-2026', 'comp-ssc-cgl-2026',
                   'comp-banking-2026', 'comp-railways-2026')
    GROUP BY t.id, t.category, t.active ORDER BY t.id;

   SELECT id, exam, active, name FROM mock_tests
    WHERE id LIKE 'comp-%-set-%' ORDER BY id;
   ```

5. Sign into **`/admin`** using the verified email configured in `ADMIN_EMAILS`.
   Check the Questions tab for all four new topics, answers, explanations,
   difficulty and source labels. Correct issues or retire flawed questions.
6. In the Topics admin view, **activate a reviewed topic** before previewing
   its draft quiz; inactive topics are intentionally excluded from the public
   question bank. Activating a topic also creates its automatic long-form
   topic-practice entry, with adequate time for 125 questions.
7. In the Tests admin view, review each corresponding 25-question draft and
   **publish explicitly** when ready. The catalogue filters are **SSC**,
   **Banking**, and **Railways**; both SSC CHSL/MTS and CGL use the SSC filter.
8. Test as a student: start an SSC CGL 25-question set, submit, verify the
   server-scored result, explanations, attempt history and correct ownership.
   Repeat for Banking/Railways on mobile before announcing the new catalog.

## Design and safety

- Seeder: `src/db/seed-competitive.js`. All inserts are
  `ON CONFLICT ... DO NOTHING`, preserving existing rows, edits and publish state.
- It runs inside the current migration transaction. A failed validation or DB
  write rolls back that migration instead of partially publishing questions.
- Question IDs remain stable as `topic-id:position`; each set uses a disjoint
  range of 25 questions, with four possible answers and explanation text.
- Topics/mocks use `active=FALSE` on first insert. Re-running a migration
  **will not disable previously published quizzes**, because conflicts do nothing.
- Practice scoring for these new sets uses +1, −0.25 and 30 minutes per
  25 questions; this is a configurable **practice format**, not a claim to
  match every exam's current official scoring scheme.
- If Neon/Render is not configured, GitHub/Vercel deployment alone **does not
  import the data**. The API cannot expose scored quizzes without the DB.
- Do not expose `DATABASE_URL`, authentication secrets or admin keys.
- No destructive SQL, standalone new database, Vercel project or architectural
  migration is part of this PR.
