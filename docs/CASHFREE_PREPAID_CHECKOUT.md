# Cashfree prepaid checkout: acceptance and rollout

This PR prepares one-time purchases only. No deployment commands, merges, live charges, production credential changes, production migrations, or subscription mandates are authorized or performed by this change. Repository-managed PR preview checks run automatically; they do not deploy production. Existing institute billing and the separate legacy sandbox audit flow are outside this change.

## Product contract

| Code | INR charged | Validity | Access |
| --- | ---: | ---: | --- |
| SSC_PACK_49 | 49 | 30 days | Eligible published SSC CGL 2026 full mocks |
| IT_EBOOK_PACK_99 | 99 | 60 days | Premium IT ebooks, permitted PDFs and ebook assessments |
| PRO_MONTHLY | 199 | 30 days | Published premium mocks and ebooks/assessments |
| PRO_ANNUAL | 999 | 365 days | Same Pro access |

The learner checkout kill switch applies only to learner create-order/availability. Shared provider settings and UUID order keys remain compatible with existing institute and advertising integrations.

All purchases are prepaid. Automatic renewal is **off**. Existing Free/public editions and institute enquiries remain available. A purchase never overrides private/invite-only ebook permissions or PDF download policy. Learner checkout has no UTR field or manual-payment submission. The existing owner administrative grant tools remain available for legitimate support/legacy access; they are not a learner payment mechanism.

## Read-only production schema confirmation

Inspected through the Neon connector on **14 November 2026 (IST)**, before any code deployment:

- Project `exampro-prod` (`noisy-hat-74026044`), branch `production` (`br-noisy-field-b5yp1zxj`), database `neondb`, schema `public`.
- `monetization_orders`: text primary key `id`; UUID `user_id` foreign key to `users(id)`; non-null `code`, `resource_id` (default empty), integer `amount_inr > 0`, mode constrained to `sandbox|production`, non-null `status` (default pending), `created_at`, nullable `paid_at`.
- `monetization_grants`: UUID primary key; UUID `user_id` foreign key; non-null code/resource/expiry/reference/actor/date; **UNIQUE(reference)**; access index `(user_id,code,expires_at)`.
- Production currently has neither checkout retry columns nor the new payment-ID/history indexes. The original orders table has no enumerated product/status constraint; product/price validation therefore remains mandatory on the server.
- Only table metadata was inspected. No customer rows, credentials, production migrations or settings were read/changed.

The additive migration `src/db/cashfree-checkout.sql` adds `checkout_key`, retry-key aliases, the original customer phone, the verified provider payment ID, and unique retry/payment indexes plus a history index. It preserves existing rows and grants. It is deliberately **not** added to `src/db/migrate.js`, boot, Render build commands, or deploy hooks.

## Payment and entitlement guarantees

1. The API authenticates verified OAuth identities and uses their canonical database UUID. Prices and validity come from the server product catalogue; amount, identity, expiry or success supplied by the client is ignored.
2. Checkout requires a UUID retry key. A user advisory transaction lock and persistent order intent serialize checkout creation. All unresolved attempts for that account/product/resource/mode resume the same order. Cross-tab retry keys are saved as aliases, so a lost response followed by settlement cannot turn a retry into a renewal. Cashfree receives a stable UUID `x-idempotency-key` and the saved customer phone. A timeout does not create another intent. The browser stores only the retry UUID in sessionStorage so refreshes after settlement still return the original receipt. A verified paid retry requires an explicit “Start a new purchase” action before a renewal can create another order. If browser storage is unavailable, the server still reuses unresolved orders; check history before a new purchase.
3. Cashfree's raw bytes are HMAC-verified before parsing. Delayed signed retries are accepted; no short replay window discards valid settlement notifications. Replays are harmless because settlement is transactional and idempotent.
4. Webhook events and authenticated status reconciliation fetch `/orders/:id` **and** `/orders/:id/payments` directly from Cashfree. The server checks provider order ID, expected server price, INR, customer UUID, `PAID` order status and a matching `SUCCESS` payment ID/amount/currency/order. The browser redirect and SDK return never confirm payment.
5. A locked order row, locked user row and unique grant reference ensure concurrent webhook/status requests grant once. A unique provider payment ID per environment prevents reuse. Any database failure rolls back both the grant and paid status.
6. Expiry is `max(now, applicable remaining expiry) + days × 24 hours`, measured in UTC. SSC and ebook passes extend their own scope. Monthly and annual purchases share one Pro balance, including legacy Pro/institute expiry. The grant and account use the same resulting expiry. Active institute membership is not downgraded.
7. Declined/dropped attempts remain resumable on the existing provider order. Only provider-confirmed expiry/termination permits a fresh order; a successful retry can still settle an earlier failed attempt.
8. History is a no-store, authenticated owner-only API with stable keyset pagination. Receipts omit phone, provider session, retry keys and credentials. The receipt expiry records the grant generated by that order; a later renewal has its own receipt and later expiry.
9. Existing mocks enforce access in `src/routes/mocks.js` and `src/services/exam-attempts.service.js`. Ebook chapter redaction, preview/full PDF selection, practice questions and assessment starts enforce access in `src/services/ebooks.service.js`. Student mock routes require a valid paid grant/plan even for an owner account; admin draft routes have separate authorization. Disabling sales never disables valid grants. There is no localStorage/URL-based authorization.

## Configuration and staging acceptance

Use a dedicated staging API, frontend, **staging database**, and sandbox merchant credentials. Confirm the hosts and database branch before applying anything. Never point sandbox checkout at the production database.

After reviewing the migration, an operator can apply it on staging using an already configured private direct connection:

```bash
psql "$STAGING_DATABASE_URL_UNPOOLED" -v ON_ERROR_STOP=1 -f src/db/monetization.sql
psql "$STAGING_DATABASE_URL_UNPOOLED" -v ON_ERROR_STOP=1 -f src/db/cashfree-checkout.sql
```

Staging API configuration:

```dotenv
APP_ENV=staging
MONETIZATION_ENABLED=true
MONETIZATION_CHECKOUT_ENABLED=true
MONETIZATION_CASHFREE_MODE=sandbox
MONETIZATION_LIVE_PAYMENTS_ENABLED=false
MONETIZATION_FRONTEND_ORIGIN=https://exampro-staging-ui.vercel.app
MONETIZATION_API_ORIGIN=https://exampro-staging-api.onrender.com
```

Supply `MONETIZATION_CASHFREE_APP_ID` and `MONETIZATION_CASHFREE_SECRET` through the server secret store only. Keep existing auth/database/CORS configuration. These are separate from `CASHFREE_*` credentials used by the older sandbox audit implementation. No secret may use `NEXT_PUBLIC_*`.

Frontend: set `NEXT_PUBLIC_MONETIZATION_ENABLED=true` and the staging API URL/environment before building. The browser uses production SDK mode only if **both** server availability and authenticated create-order responses explicitly confirm `production`. No frontend environment flag can enable live mode by itself.

Configure Cashfree payment success, failure and user-dropped webhook deliveries to `<API origin>/api/v1/payments/webhook`. Cashfree's payment endpoint/API version is pinned to `2025-01-01`. Validate the merchant's allowed checkout domain and return URL in its dashboard. Signature verification follows [Cashfree raw-body HMAC documentation](https://www.cashfree.com/docs/payments/online/webhooks/signature-verification).

Before production approval, record evidence for each unchecked item:

- [ ] Migration applied twice successfully to the staging branch; existing plan/grant/attempt counts and expiries unchanged.
- [ ] Real Google and GitHub sign-in, sign-out and account switch; anonymous create/history/status/receipt requests denied.
- [ ] All four sandbox purchases: displayed amount/code/validity, Cashfree amount, verified receipt, expiry and correct scope agree.
- [ ] Actual sandbox success, pending/delayed success, declined payment, cancellation/user-drop, offline SDK load and redirect interruption.
- [ ] Duplicate clicks, refresh, multiple tabs, timeout after order acceptance and repeated webhooks produce one order/grant. Retrying a paid checkout key returns its existing receipt.
- [ ] Tampered raw body/signature/timestamp, wrong customer/amount/currency/order/payment ID, and forged browser status fail closed.
- [ ] Account B cannot read or reconcile account A's order; history and receipts are accessible by keyboard and screen reader.
- [ ] Early SSC/ebook renewal, mixed Pro monthly/annual renewal, expired purchase and valid legacy/institute access preserve exact paid days.
- [ ] Paid mock detail/start, premium ebook chapters, full PDFs and assessments are denied without entitlement and available with the correct purchase. Free/public content and ebook invite ACLs remain correct.
- [ ] Real **Android Chrome**: UPI/app handoff, browser back, cancel, return and pending reconciliation.
- [ ] Real **iPhone Safari**: UPI/deep-link handoff, tab restore, return and pending reconciliation. Playwright WebKit emulation does not replace this check.
- [ ] Kill switch off after a saved order: new purchases stop; webhook/status reconciliation, existing access and history still work.
- [ ] Merchant onboarding, domains, settlement/refund procedures and operator monitoring approved. No recurring mandate is created.

No actual merchant sandbox or physical-device run was performed in this task: no Cashfree credentials or devices were configured. Keep live charges disabled until these acceptance items have evidence.

## Production deployment instructions (operator action, not executed)

1. Complete staging acceptance and review the PR and migration. Obtain a production backup/restore point. Verify production branch/host mappings and keep all sales switches off throughout preparation. Existing Render deployment scripts run general migrations: inspect that behavior separately; this payment migration is never auto-run.
2. Apply **only** `src/db/cashfree-checkout.sql` through the approved production migration process using the direct production connection. Recheck columns, foreign keys, unique grant reference, unique retry/payment indexes and history index. Compare existing access expiries/counts. Do not recreate or truncate tables.
3. Deploy the reviewed backend with `APP_ENV=production`, `MONETIZATION_CASHFREE_MODE=production`, `MONETIZATION_CHECKOUT_ENABLED=false`, and `MONETIZATION_LIVE_PAYMENTS_ENABLED=false`. Use the approved server-only production credentials and exact HTTPS frontend/API origins. This PR does not alter or provision those credentials.
4. Configure and verify Cashfree's production webhook URL/domain settings. Keep API credentials and webhook processing available for outstanding orders even when new sales are stopped. Never mix sandbox and production merchant modes within one outstanding-order environment.
5. Deploy the frontend pointing to the production API with `NEXT_PUBLIC_MONETIZATION_ENABLED=true`. Confirm all four cards, exact terms, account payment history and unavailable-checkout state. No live order is created during this check.
6. Only after separate explicit release approval, the operator may enable `MONETIZATION_ENABLED=true`, `MONETIZATION_CHECKOUT_ENABLED=true`, and `MONETIZATION_LIVE_PAYMENTS_ENABLED=true`. Confirm `/api/v1/monetization/config` reports `production`. The code defaults to fail closed, including if schema columns are missing. Live charge validation requires its own authorization.
7. Monitor provider failures, unpaid pending orders, duplicate attempts, grant mismatches and webhook retries. Do not log secrets, phone numbers, session IDs or raw payloads. Reconcile received payments before re-opening purchases after an incident.

### Missed-webhook recovery

An authenticated learner can use **Recheck payment** on the return page or **Verify latest status** from order history. Operators can run the recovery command with the appropriate environment privately supplied:

```bash
# Read-only database list: no provider calls or grants.
node scripts/reconcile-monetization-payments.js
# Explicit settlement reconciliation: provider GET requests; no orders/charges.
node scripts/reconcile-monetization-payments.js --apply
```

Each run handles at most 100 oldest unresolved orders older than one minute, in the configured merchant mode. It uses the same verification/transaction path as webhooks. Failures set a nonzero exit code and disclose only the local order ID and status code. Old local intents with no provider order require investigation, not manual deletion/recharging. Schedule recovery only through a separately approved job configuration; no scheduler/deployment is created here.

## Rollback

1. Set **`MONETIZATION_CHECKOUT_ENABLED=false`** first (and the live-sales flag false if desired). Confirm availability returns null and new create requests fail. This is the preferred immediate rollback.
2. Keep the settlement-compatible backend, merchant mode and credentials in place. Signed webhooks and authenticated reconciliation must continue settling already accepted orders. Keep payment history available.
3. If necessary, roll back the frontend while leaving the settlement backend running. Do not restore the WhatsApp/manual purchase experience as a fallback. Disable the paid checkout UI if its prior version lacks compatible purchase terms.
4. Do not roll back to the old backend while outstanding orders exist: its mode/sales flag handling and payment verification do not preserve these guarantees. Fix forward or route settlement to the last verified compatible version. Reconcile the backlog using the recovery command after review.
5. Leave additive columns/indexes, orders, grant references and user expiries intact. Never drop grants, delete orders, reset expiry or replay payments to undo a code deployment. Refund/reversal decisions use a separate reviewed support procedure and the original provider payment method.

## Repeatable local/CI validation

The integration and browser fixtures reject non-loopback database hosts and database names outside `payment_tests` / `payment_tests_<suffix>`. Only synthetic identities/provider responses are used. No live Cashfree endpoint is called.

```bash
npm ci
npm --prefix exam-practice-pro ci
npm test
node --test test/monetization.test.js test/monetization-payments.test.js
PAYMENT_TEST_DATABASE_URL=postgresql://...@127.0.0.1:5432/payment_tests \
  node --test test/monetization-payments-postgres.integration.js
cd exam-practice-pro
npm run lint
npx tsc --noEmit
NEXT_PUBLIC_API_URL=http://localhost:3001 NEXT_PUBLIC_APP_ENV=local \
  NEXT_PUBLIC_MONETIZATION_ENABLED=true AUTH_SECRET=synthetic-only npm run build
cd ..
# Install playwright@1.62.1 and its Chromium/WebKit engines in your test tooling.
PAYMENT_TEST_DATABASE_URL=postgresql://...@127.0.0.1:5432/payment_tests \
  PLAYWRIGHT_MODULE=/path/to/playwright node scripts/cashfree-checkout.browser.cjs
```

CI adds a dedicated PostgreSQL 18 payment job with unit/integration tests, changed payment UI lint, typecheck, frontend build, Chromium/Android and WebKit/iPhone emulation and screenshot artifact upload. Full frontend lint currently has unrelated baseline failures; see the evidence report for the actual run, without implying a clean global lint result.
