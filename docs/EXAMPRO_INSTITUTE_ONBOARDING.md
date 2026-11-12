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


## Workspace slice

The opt-in frontend (`NEXT_PUBLIC_INSTITUTES_ENABLED=true`) now provides `/institute` for onboarding/invitation acceptance, `/institute/:slug/dashboard`, `/institute/:slug/students`, `/institute/:slug/settings` and `/admin/institutes` for platform review. The new public portal uses `/institute-portal/:slug` to preserve legacy `/c/:slug` coaching profiles without slug collisions. Staff can issue/revoke invitations, paginate/search members, confirm revocation, save branding and view actual counts. Unsupported teaching/billing modules are explicitly disclosed. The existing public `/institute-admin` demo remains labelled as such.

Synthetic browser tests validate controls with intercepted APIs. They do not prove provider OAuth callbacks or database persistence. The foundation PostgreSQL CI job passed all seven integration tests. The broader CI initially failed an existing mobile-width assertion after closing an animated admin popup; the workspace slice adds a wait for popup detachment before resizing and reruns that acceptance.
