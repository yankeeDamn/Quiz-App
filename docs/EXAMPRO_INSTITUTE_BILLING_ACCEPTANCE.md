# Institute billing sandbox acceptance

Status: draft implementation, NOT READY for commercial release. No live charging, real paid grants, live database changes or actual Cashfree sandbox transactions were performed during automated QA. Provider replies are simulated; real PostgreSQL and verified synthetic JWT middleware are exercised separately from that simulation.

## Implemented behavior

- Platform owner defines private plan codes, whole-paise price, term and explicit student/teacher/batch/question/UTC-month attempt limits. No prices or plans are seeded.
- `/admin/institutes/billing` creates/updates plans and quotes approved institutes. Quotes bind to their verified owner and snapshot terms for seven days. Existing quotes do not change when a plan changes.
- `/institute/{slug}/billing` shows actual usage, verified sandbox subscription, quotes, provider reconciliation, receipts and period-end cancellation preference. One-time renewals require a new quote and payment; no automatic debit is claimed.
- Cashfree order creation uses the stored amount/customer/UUID, an idempotency key and a fixed server callback. Signed webhooks independently fetch the order. Only a matching PAID order activates the managed institute subscription, writes one immutable receipt and audit event in one transaction. Owner status reconciliation also independently checks the provider; URL query parameters never grant access.
- Duplicate notifications, concurrent status polling and retries do not extend the subscription twice. Existing individual plans, legacy subscriptions, advertising and public content are untouched.
- Both `INSTITUTE_BILLING_ENABLED` and `INSTITUTE_QUOTAS_ENABLED` default false. Billing accepts sandbox mode only and requires `APP_ENV=test|local|staging`. A consumer live-payment switch cannot enable institute live charges.
- Enabled quotas serialize new membership acceptance, batches, questions/CSV and attempt creation. Expiry or exhausted capacity blocks new usage while reads, existing attempts/autosave/submission and result history remain available. Existing rows are not deleted or reduced to match a plan.
- Teacher seats exclude owners/admins; student seats count active memberships including students in no batch. Batch capacity currently counts all batches (archiving is not yet implemented). Question capacity counts non-retired questions including legacy private questions. Monthly attempts count started snapshot attempts in the current UTC month. Pending invitations do not reserve seats; acceptance checks capacity atomically.
- Pending provider orders must be reconciled before replacement. An unstarted quote can be cancelled without deletion; a payment confirmed after a checkout timeout must still be recorded. Mid-term plan/limit changes are rejected before checkout. Paid plan conflicts require platform review rather than rewriting an existing period.

## Manual schema / flags

After the four preceding institute migrations, explicitly review `src/db/institute-billing.sql`. It adds plan/order/receipt tables and billing-specific nullable/defaulted columns and partial unique index to existing `pilot_subscriptions`. It extends the allowed provider list with Cashfree. It creates no plan or subscription rows and is NOT called by `db:migrate` or startup.

On an owner-approved isolated staging setup, set API `APP_ENV=staging`, institute/delivery flags, and sandbox Cashfree configuration. Then enable billing; enable quotas only after the test institute has a verified subscription. Confirm the callback is `/api/v1/institute-billing/webhook` and raw bytes reach HMAC verification. Do not point staging to production API/Neon.

## Acceptance steps still required before release

1. Approve/run pending GitHub browser checks. Test platform plan form and owner billing on desktop/mobile; non-owner roles must be denied.
2. With separate sandbox credentials, create a real provider order, exercise success, user abandonment, failed attempt/retry, webhook retry and status reconciliation; retain redacted provider evidence. Verify amount, currency, owner and mode mismatch denials.
3. Validate provider order expiry/time limits, return URLs and callback registration against the current Cashfree account/docs. Documentation retrieval returned HTTP 503 in this environment; this implementation reuses the existing repository provider contract and is not a substitute for current provider acceptance.
4. Test renewal/cancellation/expiry and quota races at realistic cohort scale. Test changes to pricing only affect future quotes. Test a network timeout after provider order creation followed by reconciliation.
5. Define commercial offers, tax invoice requirements, refund/chargeback and support workflows. Receipts here are sandbox payment records, not legal tax invoices. Refund handling and live billing remain blockers. Payment-attempt failure events are not yet a separate customer-support ledger; an unpaid active provider order remains pending and may be retried.
6. Verify backup/restore and approved staging-to-production configuration. Obtain explicit owner signoff before any live charging capability is implemented/enabled.

## Rollback

Disable quota enforcement, then billing UI/API feature flag using an approved configuration change. Keep all quote, receipt, subscription and audit history. Do not delete records or revert existing consumer plans. Resolve in-flight provider orders before disabling reconciliation; disabling callbacks during an active payment window can leave paid orders pending. No schema down-migration is needed for application rollback.
