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

Future delivery migrations must add immutable snapshots, version/reviewer provenance, teacher-batch mapping, negative scoring/deadlines and result storage without editing existing attempts. Future subscriptions need configurable plans/usage and payment ledger; foundation does not grant a trial purchase entitlement.

Rollback is feature disablement and code reversion, retaining additive tables and original data. A destructive down migration is intentionally not shipped.
