# PR #65 — Reviewed manual Pro grants and payment provenance

## Context
PR #64 proved Cashfree sandbox payment, webhook and automatic Pro fulfilment on isolated staging Neon. The existing **Unlock plan** admin action was still one click and the Recent unlocks list grouped automated Cashfree grants together with manual unlocks. Accidentally running it against an already-paid user extends expiry a second time.

## Changes
- Admin **Plans and payments** separates Cashfree automatic grants from manually reviewed and legacy/manual grants. It derives source from the existing `plan_grants.note` prefix; no existing DB schema or historical row is modified.
- Manual unlock is now deliberately **two-step**: (1) check existing user and current expiry, review recent Cashfree events; (2) affirm independent payment/complimentary authorization, active renewal, and separate Cashfree payment where relevant.
- Server-side `/api/v1/admin/grant-preview` and `/grant` require **human OAuth administrator**, not an automation API key.
- For manual payment, require a positive INR amount and an 8+ character receipt note; for complimentary access require amount ₹0 and an explicit note. No account is auto-created for misspelled/unregistered email.
- Manual request ID is stored alongside the reference in the existing `plan_grants.note` field. On retry, the server holds the user's `FOR UPDATE` lock and recognizes that same ID, returning an idempotent response without extending expiry again.
- Stale expiry preflight checks and required server-side confirmations prevent racing an unknown recent plan change; the user must reload and review again.
- Staging-only read-only Cashfree order/webhook audit is also shown in the payment admin tab when staging checkout is enabled.

## Boundaries
- **No database migrations, production DB writes, payment capture, refunds, live gateway enablement, topic activation, exam publishing or merging** performed as part of this PR.
- Cashfree checkout/webhook flow is unchanged; cashfree-granted entitlements remain independent of manual approval logic.
- Existing manual grant API clients must now obtain a reviewed plan snapshot, supply a UUID requestId and confirmation fields, and authenticate as a human admin. This is an intentional security hardening change.
- Existing historical manual grants are labeled `Legacy/manual` rather than asserting provenance from notes without verification.
- Manual complimentary access is active Pro/Institute access but its payment status is `complimentary`, not a paid transaction.
- This protects double-clicks/retries using the *same* request ID; it cannot prevent an administrator from explicitly authorizing a new, different request ID after confirmation.
- Future follow-up: refunds/chargebacks, reconciliation and per-actor persistent operational audit beyond plan_grants notes.

## Staging acceptance tests
1. In staging Admin → Plans and payments, check that existing Cashfree sandbox ₹199 grant appears under **Cashfree — automatic grants** and not the manual table.
2. Select a free, existing signed-in test account, set Pro 1 month, choose complimentary, enter a reason, review, then confirm once. No actual payment required. Use an approved test account.
3. Select an active Pro account. Confirm it displays the current expiry and requires a separate active-renewal acknowledgement.
4. Select an account with a Cashfree grant within the last 7 days. Confirm the red duplicate warning and second explicit acknowledgement. **Do not complete the grant** for the existing Cashfree payment.
5. Test that submitting without proof, sending the same request UUID twice, and changing plan expiry between preview and submit cannot extend the expiry twice.
6. Sign in with non-admin, and test an automation x-admin-key: both must fail for manual financial approvals.
7. Confirm mobile layout, existing manual plan/revoke management, and staging Cashfree checkout still work. Keep production Cashfree disabled.
