# B2B database migrations

**Manual only. No production or staging SQL was applied by this work.** Never add `institute-foundation.sql` to `src/db/migrate.js`, Render build commands or startup.

## Foundation migration

Prerequisite: existing `users` and all `pilot_*` tables from `pilot-schema.sql`. `src/db/institute-foundation.sql` runs in one transaction with a migration advisory lock. It adds profile/legal name/timestamps, lifecycle widening, membership state/admin role, unique active owner, immutable-slug trigger, applications, invitations and audit logs. It does not update names, questions, attempts, plans, subscriptions or coaching JSON records. `IF NOT EXISTS` supports rerun; it does not reconcile an unknown divergent schema.

Review preflight, on the intended database, before obtaining approval:

```sql
SELECT current_database(), current_user;
SELECT to_regclass('public.pilot_institutes'), to_regclass('public.pilot_memberships');
SELECT institute_id,count(*) FROM pilot_memberships WHERE role='owner' GROUP BY institute_id HAVING count(*)>1;
SELECT conname,pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid IN ('pilot_institutes'::regclass,'pilot_memberships'::regclass);
```

Duplicate legacy owners must be reconciled by an explicit owner-reviewed plan; the unique index intentionally aborts rather than deleting memberships. Unknown check constraints require review. Acquire a verified backup and schedule DDL locks. Apply the file with `psql -v ON_ERROR_STOP=1 -f src/db/institute-foundation.sql` **only after approval for the named environment**. Do not use the general migrate command: it also seeds other content.

## Disposable verification

`test/institutes-postgres.integration.js` accepts only an explicit `INSTITUTE_TEST_DATABASE_URL`, loopback host and database named `institute_tests` (optional synthetic suffix). It applies base pilot + foundation SQL twice, then uses synthetic users/data. GitHub Actions provisions PostgreSQL 16 and destroys it with the job. There is no Neon connection or inherited DATABASE_URL fallback. Use a fresh disposable database for each run; the test intentionally does not delete pre-existing data.

## Delivery migration (manual, after foundation)

`src/db/institute-delivery.sql` adds nullable author/reviewer/fingerprint fields, question version history, teacher-batch mapping, exam definitions and immutable published snapshots, and per-attempt snapshots/deadlines/responses/revision/results. Existing question IDs and answer keys are not rewritten. Legacy pilot attempts and published exams without snapshots remain stored and are deliberately unavailable to the new runner; there is no automatic conversion or republication.

The original integer `pilot_attempts.score/total` fields retain their correct-answer/question-count interpretation. The new JSON `result` holds weighted and potentially negative marks. No existing student score is recomputed. Triggers reject edits to published snapshots, schedules and submitted results. Snapshot provenance is independent of subsequent bank edits or retirement.

Run `psql -v ON_ERROR_STOP=1 -f src/db/institute-delivery.sql` only after approval for a named environment and the foundation preflight/backup procedure above. It is not connected to startup or `db:migrate`. Enable `INSTITUTE_DELIVERY_ENABLED=true` only after all three schema files have been reviewed/applied to the authorized target. Leave it false for a foundation-only rollout.

Local disposable PostgreSQL 18: all three SQL files applied twice and 15 API/integrity scenarios passed. CI runs the same suite on PostgreSQL 16. No staging/production database connection was used. Future subscriptions still need configurable plans/usage and a payment ledger; none of these migrations grants paid access.

Rollback is feature disablement and code reversion, retaining additive tables and original data. A destructive down migration is intentionally not shipped.

### Reporting and unattended exam expiry (manual fourth institute migration)

After `pilot-schema.sql`, `institute-foundation.sql`, and `institute-delivery.sql`, review and apply `src/db/institute-reporting.sql` only to an approved target. It adds a partial index over pending snapshot attempts; it changes no questions, results, memberships, or plans. Disposable integration tests apply it twice. Leave automatic startup migration lists unchanged.

Set `INSTITUTE_EXPIRY_WORKER_ENABLED=true` only together with the institute and delivery flags after migration acceptance. It grades expired, already-started institute snapshot attempts from saved responses every 15 seconds in batches of 25. Concurrent processes use row locks and `SKIP LOCKED`. Expiry finalizes attempts even after membership revocation; it does not restore access. Legacy attempts with no immutable snapshot are excluded. Monitor oldest pending deadline and worker errors. Scale worker throughput before admitting cohorts that exceed tested capacity.

### Fifth manual migration: institute billing sandbox

`src/db/institute-billing.sql` adds configurable plan, immutable quote/order and receipt tables; extends `pilot_subscriptions` with an explicitly managed billing marker, mode, limits, period start and cancellation preference. Existing subscriptions retain `billing_managed=false` and remain outside the new path. There are no prices, seeds or grants. Apply twice to disposable PostgreSQL first; production/staging application requires explicit approval. Follow `EXAMPRO_INSTITUTE_BILLING_ACCEPTANCE.md` for prerequisites and rollback.
