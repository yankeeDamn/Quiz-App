# ExamPro PR #64 — Cashfree Sandbox-Only Pro Payments

## Design and safety
- **Sandbox only.** Backend is hardcoded to `https://sandbox.cashfree.com/pg`. No live payment endpoint or live checkout mode exists in this PR.
- **Feature is disabled by default**, even after merging. It requires **all** of: existing isolated staging draft gate, `CASHFREE_SANDBOX_ENABLED=true`, `CASHFREE_ENV=sandbox`, nonempty test credentials, the exact `CASHFREE_SANDBOX_FRONTEND_ORIGIN=https://exampro-staging-ui.vercel.app`, and an HTTPS staging Render origin `CASHFREE_SANDBOX_API_ORIGIN=https://<YOUR-STAGING-SERVICE>.onrender.com` that is not the production API.
- Set `NEXT_PUBLIC_CASHFREE_SANDBOX_CHECKOUT=true` **only for the staging Vercel project** to show the test checkout. Existing production Pricing/WhatsApp remains as before.
- Only **Pro** monthly (₹199 for one month) and yearly (₹1,990 for twelve months) one-time orders are supported. Institute plans stay on manual quotes; no recurring mandate, tax invoice, actual recurring subscription, or refund API is claimed.
- Sandbox customer phone and verified account email are sent to Cashfree to create the checkout; no card information is handled by ExamPro.
- The server decides plan, price and user from the verified OAuth session. There is no browser-provided amount/paid flag.
- Local order row is created before calling Cashfree; the provider's temporary payment session is only returned to the authenticated user.
- The webhook must have a valid Cashfree **base64 HMAC-SHA256** signature computed over the timestamp concatenated with the untouched raw JSON bytes. The backend **also fetches the order directly from Cashfree** and checks the exact local ID, `PAID` state, INR and the server-stored amount.
- Fulfilment uses one PostgreSQL transaction with `SELECT ... FOR UPDATE`, paid-state guard, per-event unique fingerprint, one `plan_grants` row, updated `users.plan_expires_at` and payment status. Duplicate signed webhook deliveries cannot grant twice.
- A refund, chargeback or reversal requires **manual reconciliation**; do not assume current code automatically revokes entitlement. Expand this before live payments.
- Only human allowlisted Admin OAuth accounts can view private order/event audit; students see only their own order history. No admin action can mark an order paid.

## Required staging setup (after PR security review)
1. **Do not run any migrations on production.** On isolated staging Neon only, manually review and execute `src/db/cashfree-sandbox.sql`. Nothing in this PR runs that migration automatically.
2. Obtain **Cashfree Sandbox** App ID and Secret from the Cashfree test merchant dashboard. Never commit keys.
3. Set on **staging Render only**: `EXAMPRO_ENV=staging`, `ENABLE_ADMIN_DRAFT_TESTS=true`, `CORS_ORIGINS=https://exampro-staging-ui.vercel.app`, `CASHFREE_SANDBOX_ENABLED=true`, `CASHFREE_ENV=sandbox`, `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_SANDBOX_API_ORIGIN`, `CASHFREE_SANDBOX_FRONTEND_ORIGIN`. Production must NOT carry these enabled variables.
4. Deploy the reviewed branch to staging Render and staging Vercel, then add `NEXT_PUBLIC_CASHFREE_SANDBOX_CHECKOUT=true` to staging Vercel only.
5. Confirm your Cashfree test merchant checkout origin and webhook configuration; the notify URL is `https://<staging-api>.onrender.com/api/v1/cashfree/webhook`.
6. Sign in with a verified Google/GitHub student account, choose Pro monthly/yearly on `/pricing`, supply an allowed sandbox test phone, complete a Cashfree-supplied test transaction, and refresh payment history.
7. Verify `/api/v1/user/profile` reflects Pro only after validated signed webhook and independent Cashfree order check. A browser return without the webhook must **not** grant Pro.
8. Re-deliver identical success webhook, deliver failed/unsigned or amount-mismatched webhook, switch user accounts, and verify double-grant and data leaks never happen. Check Admin → Tests → Cashfree sandbox payment audit.
9. Confirm production checkout still uses WhatsApp/manual process and production database receives **no** new tables or updates.

## Before live billing in a separate future PR
- Merchant onboarding and legal/tax validation, cancellation/refunds/chargebacks, automated reconciliation, operational alerts, volume/rate limits, integration tests with real Cashfree sandbox, privacy retention and consumer consent.
- Separate approval to implement live mode with **production credentials**; do not simply change a boolean.

Official references:
- https://www.cashfree.com/devstudio/preview/pg/web/checkout
- https://www.cashfree.com/devstudio/preview/pg/tools/webhookVerification
- https://docs.aws.amazon.com/ (not used)
