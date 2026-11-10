# Institute onboarding

Foundation endpoints are implemented, disabled by default. A complete self-service dashboard is a subsequent dependency; do not sell the existing preview as a functioning institute account.

1. Applicant signs in with verified Google/GitHub identity and submits legal/display name and requested slug to `POST /api/v1/institutes/applications`.
2. Existing platform owner reviews applications using the platform endpoint. An approval transaction creates a trial institute and owner membership for the **stored applicant ID**. The reviewer cannot substitute a client email to assign ownership. Rejection creates no institute.
3. Owner reads `/institutes/my` and the selected workspace. Branding changes persist through the owner-only settings route. Slug is immutable.
4. Owner invites admins, teachers or students. An institute admin can invite teachers/students only. The response contains a one-time token and expiry; share only through an authorized channel. The server does not send messages.
5. Recipient signs in using the invited verified email and posts the token to `/institutes/invitations/accept`. No query-string/localStorage role assignment. Tokens expire in 72 hours and cannot be replayed.
6. Every selected institute is reauthorized server-side. Members can hold different roles in different institutes.
7. Revocation immediately denies new requests, preserving results. Platform suspension also denies private requests and hides public branding. Owner transfer and membership restoration require a future explicit workflow.

Teaching/batch/exam delivery, plan quotas and verified institute payment are not completed by this foundation. Do not use personal Pro grants or advertising membership as a substitute.
