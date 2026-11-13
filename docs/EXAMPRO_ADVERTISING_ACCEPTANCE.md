# Advertising verification and moderation acceptance

Draft only; no live advertisement was changed or published. Independent provider verification replaces the old owner checkbox for new approvals/renewals. Existing active records are not rewritten or retroactively labelled provider-verified.

## Setup and behavior

Review the manual additive `src/db/advertising-verification.sql` migration after `monetization.sql`. It creates verification and audit tables, no ad/payment rows. Set `AD_PAYMENT_VERIFICATION_ENABLED=true` only after approved migration and staging acceptance. With the flag false, the admin UI explains that new moderation is disabled; existing placements continue according to their stored status/expiry. This is a deliberate deployment prerequisite, not a claim that existing checkbox approvals establish independent settlement.

The platform owner enters a merchant provider order ID and booking/renewal purpose. Server-side Cashfree GET must return PAID, INR, the exact stored booking quote or existing seven-day slot price, and provider order tags `exampro_ad_id=<ad UUID>` plus `exampro_purpose=booking|renewal`. Order metadata must be set through a trusted merchant-side order-creation process. An arbitrary consumer/institute payment, browser success URL, submitted UTR or checkbox cannot satisfy this boundary. This change does not implement self-service advertiser checkout or create merchant orders; that purchase flow still needs an approved provider integration.

Verified payments are unique, product-bound and consumed once by an explicit owner approval or renewal. Repeating an action with the same payment does not extend expiry twice. Pause/resume preserves expiry. Rejection is available for pending submissions. Deletion removes delivery by setting deleted status while retaining payment/audit history. Sandbox-funded records are excluded from public delivery unless API `APP_ENV=test|local|staging`; legacy records with no new marker retain their existing behavior.

All institute workspace paths block sponsored placements, including before timers load. Existing timed-exam/ad-free rules remain. Destination validation now rejects IP literals (including normalized numeric IPv4), local/single-label names, credentials, nonstandard ports and non-HTTPS schemes. It does not crawl destinations or certify their content/DNS; owner creative/destination review is still required.

## Verified with synthetic data

- Real PostgreSQL: owner authorization; checkbox denial; unrelated provider-product denial; duplicate verification; concurrent approval; single renewal consumption; session metric deduplication; pause/resume; rejection; retained history after deletion; unchanged learner entitlements.
- Unit tests: destination validation and sandbox ad delivery denied in production.
- Provider responses are stubbed. No real merchant order, settlement, refund or live creative was used.

## Still required

1. Run the updated browser acceptance on desktop/mobile. Verify the migration-disabled explanation and the verification/approval flow.
2. Confirm current Cashfree support/semantics for order tags and merchant order creation, then test a real sandbox booking/renewal. Current documentation retrieval was unavailable (HTTP 503), so provider compatibility remains an explicit blocker.
3. Validate refund/dispute policy for rejected or deleted paid bookings, customer contact retention/deletion policy and support reconciliation. No refund automation is claimed.
4. Validate deployment environment/mode and owner signoff before any staging/prod rollout or live ad approval.

## Rollback

Disable new moderation using the feature flag and roll back UI/API only after owner approval. Retain verification and audit tables. Do not restore checkbox-only payment approval as a security workaround. Review existing placement expiry separately; do not rewrite or unpublish existing records during automated QA.
