# Cashfree prepaid checkout: implementation and test evidence

Run date: **14 November 2026 (IST)**. Base: `main@77307ef`. Runtime: Node **24.22.1**, npm **11.9.0**, Next.js **16.4.3**. Tests ran in the task's disposable workspace; production access was limited to read-only Neon table metadata. No deployment, charge, production credential change, production migration or recurring mandate occurred.

## Changed-file summary

| Files | Result |
| --- | --- |
| `exam-practice-pro/app/pricing/page.tsx`, `components/payments/micro-passes.tsx` | Four exact-price prepaid cards, authenticated Cashfree-only purchasing, plan/amount/days/no-renewal review, explicit backend mode agreement, loading/retry/help states; Free plan and institute enquiry preserved |
| `exam-practice-pro/app/account/payments/page.tsx`, `components/payments/payment-history.tsx` | Owner-only payment confirmation, bounded pending polling, reconciliation/retry, persistent paginated order history and accessible expandable receipts |
| `exam-practice-pro/components/layout/header.tsx`, `hooks/use-plan.ts` | Desktop/mobile account-history navigation and plan refresh after verified settlement |
| `exam-practice-pro/lib/monetization.ts`, `lib/plans.ts`, `app/refunds/page.tsx` | Typed order responses, removal of old manual-payment instructions, accurate prepaid/refund wording |
| `exam-practice-pro/lib/track-policy.js`, `test/telemetry.test.js` | Private account/payment routes excluded from analytics |
| `src/services/monetization-payments.service.js`, `src/routes/monetization.js` | Durable checkout intents and retry aliases, provider UUID idempotency, raw HMAC verification, order plus successful-payment verification, locked settlement, private history/receipts, per-account payment limits and sales-independent reconciliation |
| `src/services/monetization.service.js` | Grant-backed mock access survives sales disablement; exact shared Pro/legacy renewal expiry; focused pass scope; student routes require actual paid access |
| `src/db/cashfree-checkout.sql`, `.env.example` | Reviewed additive migration, unique checkout/payment indexes and independent checkout kill switch; no automatic migration registration |
| `scripts/reconcile-monetization-payments.js` | Bounded operator reconciliation; read-only default, explicit `--apply`, no order creation or charges |
| `test/monetization-payments.test.js`, `test/monetization-payments-postgres.integration.js`, `test/helpers/payment-fixture.js`, `test/monetization.test.js` | Unit and real PostgreSQL payment/expiry/rollback/concurrency/ownership coverage |
| `test/content-exposure.test.js`, `test/dual-tier-catalogue.test.js` | Existing negative fixtures explicitly represent absence of paid grants |
| `scripts/cashfree-checkout.browser.cjs`, `.github/workflows/ci.yml` | Real local API/database mobile-browser acceptance with synthetic OAuth/provider boundaries; repeatable dedicated CI job and screenshot artifacts |
| `docs/CASHFREE_PREPAID_CHECKOUT.md`, `docs/MONETIZATION_SETUP.md`, this report | Production schema evidence, staging acceptance, deployment order, recovery and rollback instructions |

## Executed checks

| Check | Observed result |
| --- | --- |
| `npm test` | **306 passed**, 0 failed/skipped |
| Payment unit/regression suites | **18 passed** (also included in the 306 above) |
| Payment PostgreSQL integration | **12 passed**; 30 total when run together with the 18 payment unit/regression tests |
| Exact migrations | Existing monetization schema and additive checkout migration applied twice to disposable loopback PostgreSQL **18.6**; no production migrations |
| Frontend production build | **Passed**, including `/pricing` and `/account/payments` |
| Frontend `tsc --noEmit` | **Passed** |
| Lint on changed frontend modules | **0 errors**, 3 pre-existing header warnings |
| Full frontend lint | **41 errors, 33 warnings**; compared with a clean detached worktree at `77307ef`: the same 41 errors/33 warnings, **0 added errors** after normalizing paths |
| Backend lint command | Executed; repository script prints `No linter configured`. Modified backend/recovery/browser files also passed `node --check` |
| Deployment safety audit | **0 critical**, 4 existing warnings about general migration seeding, TLS verification, Render auto-migration and service naming |
| Operator recovery default | Read-only local run listed up to 100 old unresolved synthetic orders with `apply:false`; no provider calls or settlement writes |
| Android Chrome emulation | **Passed** on Chromium with Pixel 7 settings; four checkout → redirect → verification → persistent receipt flows |
| iPhone Safari emulation | **Passed** on Playwright WebKit with iPhone 13 settings; same four flows |
| Responsive checks | Both engines passed width assertions at **320, 375, 390, 768 and 1440px**, plus checkout and receipt viewport checks |

The full-lint failures were verified against a separate clean baseline checkout, rather than assumed to be historical. The focused PR does not modify unrelated lint failures. No package or lockfile upgrades were needed. Browser tooling and the disposable PostgreSQL binaries were installed outside the repository's deliverable files.

## What the payment tests prove

- Each of SSC ₹49/30 days, ebook ₹99/60 days, Pro ₹199/30 days and Pro ₹999/365 days activates the correct server entitlement with an exact UTC expiry only after verified payment. Client amount, identity and status fields cannot override server values.
- Eight concurrent create requests with different retry keys reuse one payable order. Every retry alias still returns that order after settlement. Browser tests additionally refresh/remount each paid checkout and verify its saved retry key returns the original receipt without creating another chargeable order; starting a new purchase is an explicit action. A simulated timeout after provider acceptance resumes the stored intent and original phone rather than creating another order.
- Concurrent signed webhooks and authenticated status checks grant once. Repeated returns do not extend expiry again. Raw-body whitespace/signature/timestamp tampering is rejected.
- Pending, failed, user-dropped and cancelled payments grant nothing. Failed/cancelled attempts resume the same provider order. Only provider-confirmed expiry permits a fresh purchase.
- Wrong provider order ID, amount, currency, customer, payment order ID, successful-payment amount/currency/status or missing payment ID cannot activate access. A signed success event cannot override a pending provider order.
- Monthly/annual Pro renewals preserve valid legacy/institute access and use one shared expiry. Focused passes extend only their own scope. Expired access renews from settlement time. Institute membership is not downgraded.
- A provider-payment uniqueness failure rolls back both the new grant and paid order status. The learner remains unentitled.
- Real OAuth-token middleware and canonical database IDs reject anonymous/cross-account history, receipt and status reads. Equal-timestamp history pagination returns all 55 test orders without duplicates or omissions. Private responses omit phone/session/retry/credential fields.
- Both sales switches can be off while already accepted payments settle, receipts/history stay available and existing mock access remains valid.
- Browser checks cover authentication, server checkout unavailability, exact amount/days/no-renewal terms, absent UTR/manual links, pending and verified UI, failed/cancelled retry, forged URL success/localStorage values, cross-account rejection, receipt persistence and responsive layouts. Both engines finish with no uncaught page errors.
- Existing backend ebook/mock tests cover premium chapter redaction, preview/full PDF selection, assessment protection, account expiry and preservation of Free/public content.

## Browser evidence and limitations

The script produces `test-results/cashfree-checkout/results.json` and Android/iPhone pricing (320px and desktop) and receipt screenshots. The dedicated CI job uploads that directory as **cashfree-checkout-evidence**. These generated artifacts are not committed to source.

The local test used system Chromium and downloaded WebKit. Missing WebKit shared libraries were installed into the task's user-owned tooling directory, and host dependency auto-validation was skipped only after a successful actual engine launch. Tests used ordinary headless browser execution and the real local Express/database path. Unrelated menu prefetches receive synthetic empty responses to avoid WebKit navigation-cancellation noise; payment API requests are not mocked. The test waits for in-flight requests before scripted navigation.

OAuth session/token issuance and Cashfree API/hosted checkout were synthetic. The signed token was verified by the real backend middleware. No actual Cashfree credentials were present, so this run does **not** establish merchant onboarding, real sandbox compatibility, bank/UPI handoff or physical Android/iPhone acceptance. Those unchecked staging release gates are listed in [the rollout guide](CASHFREE_PREPAID_CHECKOUT.md#configuration-and-staging-acceptance).

The PR is intentionally a draft pending those external acceptance checks. Production remains disabled until a separately authorized operator follows the documented rollout.
