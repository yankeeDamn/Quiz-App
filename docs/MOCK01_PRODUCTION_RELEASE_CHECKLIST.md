# ExamPro — SSC CGL Mock 01: Final QA and Production Release Gate

**Status: HOLD / NOT APPROVED FOR PRODUCTION.** This document is a controlled release checklist, not approval to publish. The content is still in Neon `exampro-staging`, while the production branch is separate. Do not change production database rows, activate topics or publish from a PR.

## Demonstrated in staging

- [x] Imported four 25-question topic banks (100 questions), matching original GitHub data at import.
- [x] Verified secure, authenticated admin-only **Test Draft** route on staging Render + Vercel.
- [x] Observed automatic 15-minute transition from Reasoning to General Awareness; UI prevents navigation into locked sections.
- [x] Observed result screen and answer-by-answer review after the private exam.
- [x] Checked visible result arithmetic: 20 correct × 2 − 55 incorrect × 0.5 = **12.5 out of 200**; 25 skipped; 6.25%.
- [x] Verified the private mock and its four source topics remained inactive during testing.

The screenshot evidence **does not independently prove** the browser-refresh persistence path, server rejections for tampering, concurrent-tab writes, all 4 actual section transitions, the content's academic correctness, or eligible-candidate timing. Automated tests cover many underlying rules, but they are not an independent production security assessment.

## Release blockers (complete and record evidence before rollout)

### Security and operations
- [ ] Verify guest, non-admin, wrong-key and direct-ID access return 401/403/404 for `/api/v1/admin/draft-attempts/*` and never reveal draft questions or answer keys.
- [ ] Exercise overlapping browser tabs/refresh: confirmed answer persistence, no editing past sections, server refuses future-section writes.
- [ ] Verify normal public mock catalogue, exam history, analytics and share links never expose a draft session/answer key.
- [ ] Confirm `EXAMPRO_ENV=staging` and `ENABLE_ADMIN_DRAFT_TESTS=true` are set **only** on staging Render; production has draft testing disabled.
- [ ] Check Vercel production and staging domains point to the correct API, separate `AUTH_SECRET` values and separate Neon branches.
- [ ] Resolve low-resource/hibernate effects on save and submit; alert on 429/5xx. Render Free may sleep while inactive.

### Editorial, SSC pattern and accessibility
- [ ] Obtain **independent** subject-matter signoff for each of 100 questions (answer key, calculation, explanation, grammar, ambiguity, distractor quality and duplicates).
- [ ] Validate topic distribution and 4×25 sectional timing/marking against the **current official SSC notice** for the exact recruitment year. Do not claim official accreditation.
- [ ] Perform content review for Hindi-language content where promised, and verify translation accuracy rather than relying on UI controls alone.
- [ ] Assess accessibility and accommodation / eligible-scribe timing. The current 4×15-minute standard clock must not be advertised as covering candidates with different permitted timings.
- [ ] Test keyboard-only navigation, screen-reader cues, mobile rendering, low-bandwidth reconnection and error retry.

### Data integrity / release operations
- [ ] Confirm unique content IDs, 25 contiguous active positions (0–24) in each source topic, 100 distinct questions, 4×25 mapping, 60 minutes, +2/−0.50. Do not import duplicate CSVs.
- [ ] Record final staging revision and question-bank checksum; freeze and independently approve it.
- [ ] Prepare a **separate production migration plan and backup**, with question CSV review, idempotent import, and explicit approver. Never paste staging DB URL into production services.
- [ ] Activate vetted topics in production **only after** imported content is complete and approved; use the new server publication-readiness check on the final 100-question mock.
- [ ] Smoke-test a **restricted controlled release**, then evaluate 10–20 opt-in beta learners. Monitor auth, autosave, scoring and speed, and maintain rollback procedure.

## What this PR changes

Before this guard, the **Admin Preview** was able to show 100 questions drawn from inactive staging topics while a test could be switched to **Published**. The public bank then showed **0 accessible questions**, confusing admins and creating an inconsistent live entry.

This PR changes the *server* publication route: every referenced source topic must be active, all configured question positions must exist and be active, duplicates are rejected, and full SSC CGL mocks must match the four-section 100-question timing/scoring pattern. The Admin UI additionally requires explicit confirmation for a Draft→Published change. It **does not** activate topics, publish the mock, or merge content into production.

### Evidence and acceptance

Run `npm ci && npm test` in repository root and `cd exam-practice-pro && npm ci && npm run build`. CI on Node 18/20/22 and frontend build must pass.

Negative checks: leaving any source topic inactive, removing one selected position, introducing duplicate questions, or changing a full-mock duration/marks **must return an error and keep the test Draft**. The private **Test Draft** route must still work with inactive topics after this PR. Short, complete and properly active practice mocks must remain publishable.

## Rollback

If a release unexpectedly appears publicly, immediately switch its mock to **Draft**, then investigate topics and API cache. To close private draft QA, disable `ENABLE_ADMIN_DRAFT_TESTS` on staging Render and redeploy. Roll back code to the prior verified commit only with an operator decision; never reset production Neon from staging.

**Owners:** Project maintainer approves deploy and publication; independent reviewer signs content and accessibility. Both approvals are pending.
