# Tenant security model

## Trust and authorization

Auth.js Google/GitHub session -> signed backend token -> existing `authenticateNextAuth` verification -> canonical PostgreSQL `users.id`. The new router never accepts guest identity, a platform API key, or client-supplied user/tenant IDs as authority.

`foundation.within` opens a transaction, resolves a valid immutable slug to an active/trial institute and reads active membership for the canonical user. Both rows are locked for the authorized operation. The role is mapped to explicit permissions in `policy.js`. Every tenant query includes the resolved institute ID. Unrelated tenant/resource access returns 404; unauthorized role within a joined institute returns 403. Responses are private/no-store. Membership/suspension changes serialize with in-flight transactions; requests beginning after revocation commit fail closed.

| Role | Foundation permission |
| --- | --- |
| Platform admin | Application review and lifecycle only; preserved ADMIN_EMAILS trust root |
| Owner | Settings, members, staff invitations, revocation, workspace totals |
| Admin | Members and teacher/student invitations; cannot invite/revoke another admin or owner |
| Teacher | Workspace only in foundation; authoring/assigned reporting permissions reserved for subsequent routes |
| Student | Workspace only in foundation; own assigned exams/results in subsequent routes |

One active owner is enforced by a partial unique index. Foundation refuses owner/self revocation, implicit role replacement and resurrection of revoked memberships. Explicit owner transfer/reactivation workflows remain a launch blocker; operators must not bypass this using arbitrary API bodies.

## Invitations

HMAC-SHA256 uses a dedicated environment-specific 32+ character server secret. Purpose and expiration are signed. Only SHA256 token digest is stored. DB email, role, expiry, issuer permissions, revocation and single-use status are checked transactionally on acceptance. A valid token belonging to a different verified account cannot be accepted. Concurrent acceptance is serialized. Invites from revoked issuers are invalid. Tokens are returned once to the issuing authorized user, never sent by this code, never put in query parameters or audit events. Deliver them through an approved channel; the UI should use a pasted token or URL fragment and clear it after acceptance.

## Database guarantees and limits

Existing composite `(institute_id,id)` foreign keys stop cross-tenant bank, batch, exam, question and attempt references. Membership revocation is a state update: results remain intact. SQL is parameterized. Transactions roll back failed onboarding/invitations and include audit writes. Slug updates fail at the database layer.

**This is application-scoped authorization with composite-FK integrity, not PostgreSQL RLS.** The shared service database role can read multiple tenants. A future unscoped query would be a bug; do not claim protection against a compromised DB credential. Add RLS using a dedicated non-owner DB role and transaction-local context only after testing every legacy query and connection-pool reset. No existing table is silently put under an incomplete RLS policy.

Public branding permits validated hex colours and bounded raster data URLs; it does not fetch arbitrary external logos or render SVG/HTML. Contact information is explicitly public profile data. Avoid sensitive information there. Limits/rate controls are per verified user plus the existing global API limiter; production sizing and distributed limiting remain outstanding.

## Required negative evidence

The disposable PostgreSQL suite tests two separate teachers, ten students per tenant, altered URL/body IDs, role denial, email/token tampering, duplicate invite acceptance, revocation, suspension, immutability, composite FKs and rollback. Exam-start/question-edit/result-denial cases are not proved by foundation and must be added with delivery routes. No assertion of full tenant isolation may omit these gaps.
