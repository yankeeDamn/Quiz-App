# ExamPro B2B architecture and delivery boundaries

**Status: implementation in progress, NOT READY for release.** PR A audits/fixes existing behavior; PR B introduces the tenant security/onboarding foundation. Follow-on workspaces/content/delivery/billing must be separately reviewed. The full requested commercial product is not yet implemented.

One Next.js deployment, one Express service, one PostgreSQL database per environment. No institute-specific Vercel project. Existing consumer `users`, `exam_attempts_v2`, ebook, payment and practice records remain intact.

| Context | Existing data reused | New behavior / boundary |
| --- | --- | --- |
| Identity | canonical `users.id`, verified Auth.js bridge | Never authorize from email in a request body, localStorage, a client role, or a slug alone |
| Tenant | `pilot_institutes`, `pilot_memberships` | Immutable slug; profile; trial/active/suspended/archived; owner/admin/teacher/student; active/revoked memberships |
| Onboarding | new `pilot_applications`, `pilot_invitations` | Platform-reviewed request binds owner to authenticated applicant; signed email-bound 72-hour invitation; digest-only token storage |
| Questions/batches/exams | existing `pilot_question_banks`, `pilot_questions`, `pilot_batches`, `pilot_batch_students`, `pilot_exams`, `pilot_exam_questions`, `pilot_exam_assignments` | Composite foreign keys already prevent cross-tenant links; delivery/review/version APIs are a dependent milestone |
| Results | `pilot_attempts` reserved for institute delivery | Do not mix client-computed legacy quiz scores into trusted rankings; snapshots, decimal negative marking and deadlines require an additive delivery migration |
| Billing | `pilot_subscriptions`, existing verified payment infrastructure | No new grants or checkout in foundation. Configurable reviewed plans/limits, ledger, signed provider events and renewal/expiry required before commercial launch |
| Coaching advertisements | Existing monetization JSON profiles/members | Remain separate. Buying an ad or adding a coaching profile must never create tenant membership or exam entitlements |
| Audit | new `pilot_audit_logs` | Transactional actor/action/resource records; no answer keys, invitation tokens, arbitrary bodies or contacts in logs |

## Implemented HTTP contracts

All B2B routes return 404 unless `INSTITUTES_ENABLED=true`; the default is off. Existing `/institute-admin` preview and consumer routes remain intact.

- Public `GET /api/v1/institutes/public/:slug` returns only approved institute branding.
- Verified identity: `GET /institutes/my`, `POST /institutes/applications`, `POST /institutes/invitations/accept` (all under `/api/v1`).
- Platform-only: `GET /platform/institutes/applications`, `POST /platform/institutes/applications/:id/review`, `POST /platform/institutes/:id/lifecycle`.
- Tenant context: `GET /institutes/:slug/workspace`; owner `PUT .../settings`; permitted staff `GET .../members`, `POST .../members/:id/revoke`, `GET/POST .../invitations`, `POST .../invitations/:id/revoke`.

Tenant switching is a fresh server lookup on every route, not a trusted active-tenant cookie. API permissions are explicit. Platform administrators do not automatically bypass private institute membership; their lifecycle/application endpoints are separate.

## Next dependency slices

1. Shared branded workspace, application review controls, invitation handoff and role-aware menus.
2. Questions, versioned reviews, teacher batch ownership, exam snapshots, assignments, server-authoritative attempts and reports.
3. Quotas/billing/audited ad state transitions. Quote approval, refunds and settlement operations require owner decisions and sandbox evidence.
4. Browser acceptance, vulnerability review, restore drill, environment parity and release signoff.

`/c/:slug` already hosts legacy monetization profiles. New branded tenants should use an explicit tenant route or a collision-checked mapping; never infer membership from the existing public slug. Custom domains are deferred.
