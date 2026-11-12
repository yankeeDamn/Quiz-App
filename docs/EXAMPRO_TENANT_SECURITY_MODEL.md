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
# Delivery authorization and integrity

Private banks are available to their creating teacher and institute owners/admins. Students never receive bank records, versions, answer keys or draft exam bodies. Question edits require a fresh independent owner/admin review. CSV imports validate all rows and use one transaction; a duplicate ID or normalized prompt/options fingerprint rolls back the entire import. This is likely-duplicate detection, not a claim of semantic plagiarism detection.

Student exam starts resolve active membership and current batch assignment on the server. The database clock determines the deadline, capped by the published end time. Immutable snapshots are served with answer fields removed. Revision numbers reject stale cross-device saves; the client cannot set a score, deadline, membership or tenant. Row locks and unique exam/student constraints make concurrent starts and submissions idempotent. Late answers are ignored; the previously saved responses are graded. Submitted explanations are withheld until the common exam window closes.

Own results require current membership, and teacher reports require an explicitly assigned batch. A removed batch assignment prevents further in-progress delivery; retained, submitted own results remain available while institute membership is active. Removed membership denies all private APIs. There is no public ranking endpoint. Teacher reports include permitted student identifiers and must not be described as anonymous leaderboards.

Expiry currently finalizes on the next start/read/save/submit request. A durable background finalizer and operational recovery are still required before claiming unattended completion analytics. Existing global IP limits may throttle classrooms behind a shared NAT; measured capacity and adjusted layered limits remain release gates. Database credentials remain a trusted boundary; application isolation and composite FKs are tested, but no PostgreSQL RLS claim is made.
