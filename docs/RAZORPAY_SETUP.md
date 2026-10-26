# ExamPro Razorpay payment rollout — gated, test mode first

This PR prepares secure checkout. It **does not** create a Razorpay account, perform KYC, turn on checkout, apply live database migrations, or process real money.

## Architecture
Frontend (Vercel) -> authenticated POST /api/v1/payments/orders (Render) -> Razorpay Orders API.
The browser receives ONLY the public Key ID, approved amount and server-generated order ID.
Razorpay signs payment.captured events -> POST /api/v1/payments/webhook (raw request bytes, Render) -> HMAC validation -> transactionally lock payment order and user -> update users plan and plan_grants.
Browser success is informational only. Account entitlement changes ONLY on a validated captured webhook. Duplicate webhook events do not extend plan twice.

## Prerequisites / required review
1. Have an active Razorpay merchant account with website and legal policy verification. Obtain TEST Key ID/Secret and a TEST webhook secret. Complete legal review of Privacy, Terms, Refund, Contact pages in PR #32 and update those pages for online checkout.
2. Set up a Razorpay webhook on the exact Render HTTPS endpoint: https://quiz-app-regd.onrender.com/api/v1/payments/webhook. Subscribe to `payment.captured`.
3. Set Razorpay automatic payment capture in its dashboard. Verify charge/capture behavior in TEST mode.
4. Manually review and apply `src/db/razorpay.sql` to the intended Neon database through the project migration workflow. **Do not run it in production until approved.** It only creates payment_orders and payment_webhook_events and an index.
5. Set Render environment variables (server only):
   - RAZORPAY_KEY_ID = test public ID
   - RAZORPAY_KEY_SECRET = test secret
   - RAZORPAY_WEBHOOK_SECRET = test webhook signing secret
   - RAZORPAY_CHECKOUT_ENABLED = true **only after migration and webhook test**
   Never set these on Vercel as NEXT_PUBLIC_ variables. The browser receives only the Key ID from the authenticated order endpoint.
6. Retain existing AUTH_SECRET, ADMIN_EMAILS, DATABASE_URL and CORS_ORIGINS. Frontend uses its existing NEXT_PUBLIC_API_URL.
7. Deploy Render manually after approved merge (autoDeploy is currently off), verify /api/v1/health/ready and checkout config, then deploy Vercel. Do not mix test and live credentials.
8. Test payment amounts: ₹199 (one month) or ₹1,990 (12 months). Verify captured webhook grants access exactly once, duplicate events do not extend, mismatched amount fails, failed/authorized payment never grants, another user cannot read an order.
9. Have two users test paid vs unpaid premium access and expiry. Review test-mode settlement logs for discrepancies.
10. Switch to live keys, **a distinct live webhook secret**, and production merchant approval only after a completed end-to-end test and legal check.

## Failure behavior
- No keys, missing webhook secret or feature flag absent: config reports disabled and WhatsApp flow remains.
- A client-side success callback does not unlock Pro; only a signed payment.captured event may do that.
- Payments are one-time purchases, not a recurring Razorpay subscription. Renewals extend existing expiry.
- Payment orders in the database are private to their owner. Store sensitive keys in Render Secrets, not GitHub.
- Do not retry arbitrary raw webhooks, execute SQL manually on Neon production, or enable payments before testing.
