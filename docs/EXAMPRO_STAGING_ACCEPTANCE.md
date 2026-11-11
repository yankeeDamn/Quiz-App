# Staging acceptance runbook

This document is a proposed procedure, not permission to deploy or migrate. **No staging mutation has been performed.**

1. Record owner-approved PR/commit, backup/restore evidence and target Neon branch fingerprint. Verify frontend -> staging Render -> staging Neon; no secrets in screenshots or logs. Current observed frontend `2dd5989` differs from Render/main `4afbeac`.
2. Require green unit, frontend build, synthetic browser and real PostgreSQL jobs on the exact reviewed commits. Review all remaining gaps in the test matrix.
3. After explicit schema approval, apply only the reviewed B2B SQL in one transaction to the verified staging branch. Do not run seed-bearing general migration as a substitute.
4. After explicit deployment/configuration approval, set staging frontend `NEXT_PUBLIC_API_URL=https://exampro-staging-api.onrender.com`, `NEXT_PUBLIC_APP_ENV=staging`; API `INSTITUTES_ENABLED=true`, independent `INSTITUTE_INVITATION_SECRET` from secret management. Preserve the existing OAuth secrets and consumer content.
5. Use synthetic staging accounts and clearly labelled institutes. Review application, confirm owner identity, configure branding, invite staff/students, test wrong-email acceptance, expiry, revoke/replay, dual membership and suspension.
6. Repeat the two-institute matrix with URL/body ID swapping. A teacher must not enumerate all students or change settings. A student must not see other students' records. Restore/transfer owners only through implemented reviewed workflows.
7. Execute existing consumer catalogue/Pro, draft privacy, timings/autosave, admin CRUD, ebook/PDF and jobs tracker acceptance. Do not change existing published content for test convenience.
8. Verify billing sandbox independently; no live credentials, charges or entitlements. Keep ads separate from tenant access and suppress them in active exams/ad-free plans.
9. Record screenshots using synthetic data only, test results, deployed revision, migration checksum, known failures and owner acceptance. Stop release on any critical unverified behavior.

Foundation alone does not implement exam delivery/billing and cannot satisfy steps 6–8 in full.

### Reporting / expiry acceptance (requires approved deployment and migration)

1. Apply the fourth manual institute migration on the approved isolated staging DB. Start with all flags disabled, then explicitly enable foundation/delivery and `INSTITUTE_EXPIRY_WORKER_ENABLED`.
2. With synthetic data, start a short scheduled exam, save one answer and close the browser. After deadline + 30 seconds, verify one immutable graded result and one `attempt.expired_automatically` audit event. Confirm a duplicate submit cannot change it.
3. Open authorized batch analytics. Compare eligible student–exam assignments, completion, average percentage and topic/section counts with synthetic fixtures. Removing a student from a batch/membership changes the current-cohort report; preserved attempts are not deleted.
4. Export a report. Check CSV quoting and formula-neutralization, and follow the next-page control for more than 500 results. Cross-tenant IDs, unassigned teachers and student requests must fail.
5. Stop the expiry worker and observe backlog monitoring. Re-enable and verify recovery. This capacity/operations exercise remains a release gate; small synthetic correctness tests are not a load benchmark.

### Institute billing sandbox

Follow `EXAMPRO_INSTITUTE_BILLING_ACCEPTANCE.md` after separately approving the fifth manual migration and exact staging revision. No real-provider sandbox settlement has been verified by the synthetic test suite. Keep live payments disabled. Verify the existing consumer Free/Pro plans and advertising remain independent of an institute purchase.
