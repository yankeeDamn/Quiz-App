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
