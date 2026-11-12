# Private institute delivery API acceptance

Draft implementation only; opt-in `INSTITUTE_DELIVERY_ENABLED=false` by default. No deployment, live publication, paid grant or live migration was performed.

## API workflow

Every private endpoint uses `/api/v1/institutes/:slug` with the existing backend verified OAuth bearer token. Caller-provided `institute_id`, scores and admin flags never select scope or authority.

1. Owner approves verified memberships using the foundation flow. Teacher creates `POST /banks` (`title`, `examCode`).
2. Teacher creates `POST /banks/:id/questions` with `external_id`, `topic`, `difficulty` (`Easy/Medium/Hard`), `prompt`, four `options`, `correct_option` (`A/B/C/D`), `explanation` and `language` (`en/hi/bn`). `PUT /questions/:id` preserves external ID, creates a version and resets review. `POST /questions/:id/retire` preserves historical snapshots.
3. `POST /banks/:id/import` accepts `{csv}` with headers `external_id,topic,difficulty,prompt,option_a,option_b,option_c,option_d,correct_option,explanation,language`. Maximum 100 rows / 200 KB; all-or-nothing and duplicate detection. Only private authorized staff can access `GET /questions/:id/versions`.
4. A different authorized reviewer sends `POST /questions/:id/review` with `action: approve` or `reject`. Self-approval is denied.
5. Owner/admin creates `POST /batches` (`name`) and assigns verified members with `PUT /batches/:id/members/:userId` (`role: student` or `teacher`). `DELETE` on the same path removes only that batch membership.
6. Teacher creates/edits a draft using `POST /exams` or `PUT /exams/:id`: `title`, `bankId`, `minutes`, `marksPerCorrect`, `negativeMarks`, `passPercent`, ISO `startsAt`/`endsAt`, and `sections: [{name, questionIds}]`. Maximum 200 distinct questions from the authorized bank.
7. Owner/admin assigns batches with `POST /exams/:id/assignments` (`batchId`). After independently approved questions and a valid window, explicit `POST /exams/:id/publish` stores the immutable snapshot. Existing published content is never touched by these changes. Publication is only tested on synthetic fixtures.
8. Student lists `GET /assigned-exams`, starts `POST /exams/:id/start`, and reloads `GET /attempts/:id`. Save full current answers with `PUT /attempts/:id` (`revision`, `responses: {questionId: zeroBasedOption}`). A 409 means another device saved first; reload before retrying. Do not silently overwrite.
9. `POST /attempts/:id/submit` uses the same revision/responses shape. Duplicate submissions return the original grade; deadline expiry discards late unsaved answers. `GET /results` lists only the current student's results. Review explanations unlock after the exam window ends.
10. Owners/admins and explicitly assigned teachers can use `GET /batches/:id/report`. Reports are bounded to 100 rows; paginated exports and institute aggregates are not implemented by this API slice.

## Recorded tests

- 296/296 backend unit tests passed locally.
- 15/15 scenarios passed on disposable PostgreSQL 18, including both institutes with distinct owners, teachers, ten students, private banks, draft/published fixtures, ID substitution, rollback, concurrent starts/saves/submissions, membership revocation and dual-institute role selection.
- CI uses PostgreSQL 16; consult the exact draft commit's run before approving it.
- Existing consumer tests remain separate. No real OAuth provider callback, Cashfree transaction, live admin mutation or live exam attempt was used as test evidence.

## Remaining gates / rollback

Teaching/runner UI, deferred expiry finalization, CSV export, anonymized rankings, full analytics, limits/billing and load testing remain separate work. The legacy consumer self-reported quiz history is not an authoritative institute result. Follow the main staging acceptance and rollback documents: owner-approved environment/SQL only, restore code and disable feature flags, preserve additive tables and all historical records.
