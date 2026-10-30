# PR #57 — Invite-only Mock 01 staging beta

**Safety:** No production deployment, data changes, topic activation or publishing. All beta access is gated by the pre-existing strict staging-only `draft-testing-gate`.

## Setup (staging only, after review and explicit approval)

1. Use the dedicated **staging Neon database** and staging Render service. Never apply the migration to production.
2. Run `src/db/beta-invitations.sql` against the staging database using the team's approved migration process. This is **not automatically executed** by this pull request; no live database was touched.
3. Confirm `EXAMPRO_ENV=staging`, `ENABLE_ADMIN_DRAFT_TESTS=true`, staging-only `CORS_ORIGINS` and existing verified OAuth setup. The strict gate rejects a production origin or environment.
4. Sign in as an allowlisted human admin on the staging frontend. In Admin → Tests, create an invitation for a beta participant's **verified Google/GitHub email**. Expiry: 1–168 hours.
5. Share the generated 64-character code **privately**. Only its SHA-256 hash is stored in the database; the original appears once in the admin interface. Treat it as confidential.
6. Participant visits `/exampro/beta/mock-01` on the **staging frontend**, signs in with the exact verified email, redeems the code and takes or resumes the test.

## Access protection

- Invitations bind to the verified OAuth email and canonical user UUID. Redeeming requires an unexpired, non-revoked, unused-or-self-redeemed grant; access is rechecked on every attempt operation.
- Ordinary signed-in students have no admin privileges. The existing public `/exam-attempts` routes still cannot access draft attempt data.
- Only `ssc-cgl-2026-mock-01` is allowed. Draft test content stays unpublished and answer keys remain unavailable until submission.
- Existing server-side 4×25 section timing, answers, recovery, accessibility accommodation, grading and privacy protections are reused.
- Invite revocation is available to a verified human admin via `POST /api/v1/admin/beta/invitations/:id/revoke`; the API does not currently expose invitation listing. Keep the created invitation identifier within your authorized staging operations workflow if revocation is required.
- On expiry/revocation, future access including resume/submission is denied. Plan invitation windows to cover the full timed exam.

## Required before beta

- Independent academic and Hindi QA must be completed; this code does **not** mark reviews approved.
- Obtain consent and privately invite 10–20 test participants; validate with test identities and isolated staging data first.
- Validate sign-in, wrong-email denial, expired/revoked tokens, replay, saved attempts, timeouts, EN/Hindi/Bangla, result privacy, and mobile/keyboard accessibility.
- Staging-only migration application and real-world email/revocation QA are still manual steps.
- **Do not merge this PR until CI and the security review are complete.** Do not publish Mock 01 or alter production DB.

## Future hardening

Invitation management should expose an audited list/revoke UI and user-facing invitation expiry notices before broad external beta. Limit invitations to test accounts initially.
