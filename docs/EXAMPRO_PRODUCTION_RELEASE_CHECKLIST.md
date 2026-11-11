# Production release checklist

**NOT READY. No release is recommended by this work.**

- [ ] All launch-critical inventory rows have passing automated and appropriate authenticated browser evidence.
- [ ] Draft PR dependencies reviewed; no unresolved critical/high security or data-loss findings.
- [ ] Complete tenant authoring, batches, immutable publication, assigned exam attempt/results journeys.
- [ ] Full two-institute API/DB/browser matrix passes, including question edits, exam starts, results/rankings and removed membership.
- [ ] Legacy client-computed quiz stats cannot be mistaken for authoritative institute assessment.
- [ ] Existing learner/auth/admin/Free-Pro/PDF/jobs workflows pass without altering historical data.
- [ ] Reviewed commercial plans/limits, signed provider reconciliation, idempotent billing ledger, renewals, failures, refund and cancellation operations.
- [ ] Advertising requires independent creative approval/payment verification and has audit/rejection/expiry coverage.
- [ ] Exact staging frontend/backend commit parity and environment-specific Neon/secret configuration verified.
- [ ] Additive migrations replay twice, preserve representative data, reject cross-tenant foreign keys and roll back failures on disposable PostgreSQL.
- [ ] Backup and restore drill, secret custody, least-privilege database access, dependency/security scanning and capacity limits accepted.
- [ ] Responsive/mobile/keyboard/dark-mode/error/loading acceptance and support ownership recorded.
- [ ] Owner explicitly approves named production migrations, deploy/config changes and any payment enablement separately.
- [ ] Rollback owner, previous SHA, monitoring window and incident criteria recorded.

The foundation flag stays off until its own review and controlled acceptance. A green Vercel preview/build is not release approval.

### Additional billing gates

- [ ] Institute Cashfree sandbox order, webhook, timeout, failure/retry, expiry and renewal accepted against the actual provider.
- [ ] Commercial plan terms, customer support, refunds/chargebacks and tax invoicing approved.
- [ ] Quota behavior/load tested against an approved staging database with accurate usage.
- [ ] Live institute billing implementation independently reviewed; current code deliberately rejects production mode.
- [ ] Open orders reconciled before any callback/config rollback.

Synthetic provider responses are not settlement evidence. Institute billing remains sandbox-only and commercial readiness remains **NOT READY**.
