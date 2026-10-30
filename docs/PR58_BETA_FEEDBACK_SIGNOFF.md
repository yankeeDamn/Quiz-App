# PR #58 — Mock 01 beta feedback, invitation audit and release reporting

All new features are **staging-gated**. No production data, content status or approval records have been changed.

## Database migration

After security review, execute `src/db/beta-feedback-audit.sql` **only against isolated staging Neon**. This PR deliberately does not insert this SQL into the automatic global migration script. Ensure the earlier `beta-invitations.sql` migration is present first.

## Beta tester QA

Sign in with an unexpired redeemed invitation on staging at `/exampro/beta/mock-01`. The feedback form allows a category, impact (low/medium/high), and a 10–1500-character description. Avoid credentials, answer keys and private information. Only invited testers can submit feedback.

## Admin QA

On staging, open Admin → Tests → Beta feedback & release sign-off and choose **Load / refresh**. Only signed-in allowlisted human admin reviewers can read feedback, view invitation event metadata, and triage an issue as open, triaged or resolved. The API shows up to 200 newest feedback and events, and intentionally does not expose raw invitation tokens or exam answer keys.

The combined Mock 01 release report includes live academic/Hindi review counts and unresolved high-severity feedback. **It is never a publish approval** and contains no action that activates topics or publishes Mock 01.

## Security / manual acceptance gates

- [ ] Verify staging URL, separated Render instance, staging Neon DB, and draft testing gate.
- [ ] Invitee can submit; a non-invited authenticated user and anonymous user cannot.
- [ ] Validate length, category, impact, and HTML-safe rendering.
- [ ] Confirm only human admins may view/triage feedback or invitation audit.
- [ ] Create/redeem/revoke invitations and confirm audit events contain metadata, not tokens.
- [ ] Confirm expired/revoked invitations are rejected on all attempt paths.
- [ ] Test a full 100-question attempt, saved responses, resume, time cutoffs and grading without revealing keys prematurely.
- [ ] Confirm independent editorial 100/100 and Hindi 75/75 verification, accessibility review and beta issue resolution.
- [ ] Obtain explicit security, academic and owner approval before any *separate* publication procedure.

No audit or feedback migration is applied by this PR. Production remains unchanged.
