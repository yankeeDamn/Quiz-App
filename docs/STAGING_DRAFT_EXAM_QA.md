# Private draft exam QA — staging only

**This feature is disabled by default.** It does not insert or publish any questions, change test flags, or alter production data. PR must be reviewed and approved before merge/deploy.

## Deploy conditions (after PR approval, in staging Render ONLY)

1. Confirm the Render service is `exampro-staging-api` and `DATABASE_URL` connects to Neon **exampro-staging**, not production. Keep `NODE_ENV=production`.
2. Set **`EXAMPRO_ENV=staging`** and **`ENABLE_ADMIN_DRAFT_TESTS=true`** **only on the staging Render service**.
3. Ensure `CORS_ORIGINS` contains `https://exampro-staging-ui.vercel.app`, and does **not** contain production origin `https://quiz-app-virid-zeta-41.vercel.app`. Existing `ADMIN_EMAILS` and staging `AUTH_SECRET` continue to authorize verified Google/GitHub admin sessions.
4. Deploy staging Render and the separately configured `exampro-staging-ui` Vercel project. Do **not** set these feature flags on production Render. Frontend reads feature status from authenticated staging backend, so there are no secrets/permissions in a `NEXT_PUBLIC_` variable.
5. Open **Staging Admin → Mock tests → SSC CGL Mock 01 → Test Draft**. Only verified, allowlisted admin OAuth accounts can start/resume. No sharing controls are shown in draft mode.
6. Use the same server-timed 4 × 15-minute section policy, 100 questions, autosave, per-section locks and grading. A full 60-minute end-to-end browser test is still needed before considering publication.

## Threat model and isolation

- The backend requires verified OAuth identity in `ADMIN_EMAILS`; an `ADMIN_API_KEY` is **not sufficient** for draft testing.
- The API fails closed unless both staging flags, staging CORS isolation and a configured database are present. Keep the staging service and domain non-discoverable, restricted by network controls if needed; the feature does not turn the staging site itself into a private website.
- The source mock **must be inactive**. It may reference existing active topics, inactive topics, or a mixture. All configured topics must exist and all question positions must be active and unique. Source topic flags are never changed by private testing. New unpublished content banks should still be created inactive; do not deactivate shared learner topics to run QA. Public catalogue and guest endpoints continue to ignore the unpublished definition and draft questions.
- Private attempts use `test_id='draft-<original-id>'` and a server-generated snapshot `adminDraft:true`, avoiding collisions with published attempts. Public get/save/history/analytics reject or exclude draft attempts, including after completion. The secure exam UI receives question text/options but no correct answers/explanations until submission.
- Submitted results use the existing `cleanResponses`, `sectionTiming`, `lockedResponses` and `grade` functions. Autosave and refresh recovery are intentionally identical to the production exam engine.
- The feature is for **staging QA**, not student access. Never activate topics or the mock just to test. It **does not** replace independent subject-matter review, Hindi question QA or eligible-scribe timing support.
- In an existing already-expired draft session, the saved timer is authoritative. Creating a new run requires a previously submitted run; do not change exam-attempt records manually.

## Operational QA checklist

1. Admin enters draft runner successfully; non-admin, no-token, admin API-key and wrong staging flags are denied.
2. Draft questions count 100; no answer keys in start, recover or autosave payloads.
3. Browser refresh returns the same attempt/answers. Only section 1 selectable initially; section 2 opens at 15 minutes and section 1 is locked, and so on.
4. Two simultaneous browser tabs cannot overwrite completed-section answers.
5. Submit to see grading; verify `99 correct + 1 wrong = 197.5`, `100 correct = 200`, and skipped calculations.
6. User dashboard and public mock list show neither draft attempt history nor draft content.
7. Confirm private QA leaves the source mock inactive and every source topic/question flag unchanged. Test generic one-topic drafts and mixed active/inactive topic drafts as well as the four-section SSC example. New private SSC source banks should remain inactive until separately reviewed and published.

**Suggested tests:** `npm ci && npm test`; then `cd exam-practice-pro && npm ci && npm run build`.

## Rollback

Turn off `ENABLE_ADMIN_DRAFT_TESTS` on staging Render and redeploy. Private routes immediately fail closed; the draft remains hidden. No production migration/DB reset is required.

## Finding live tests and publication blockers

Open **Mocks & Tests Manager → Live Catalogue**, or click the **Live mock catalogue** KPI. This list uses the same database catalogue as learners and includes automatic topic tests. The **All mock definitions** table contains authored mock definitions; it does not list every generated topic test. **Drafts / Hidden** filters unpublished and blocked definitions.

A mock row’s **Publication checklist** reads counts for configured positions, missing/retired records, recorded human review, question publication, topic activity and access conflicts. It links to each source topic in Question Bank. It never marks questions reviewed, publishes them or changes access automatically. Test Draft is independent private QA; completing it does not satisfy publication review.
