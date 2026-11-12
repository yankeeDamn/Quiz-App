# Rollback plan

No production or staging change was made, so no live rollback is presently needed.

For an owner-approved future rollout:

1. Disable `INSTITUTES_ENABLED` on the affected API using the approved configuration/deployment process. This stops new B2B operations; it does not change consumer plans or content. Coordinate active attempts before disabling delivery once that feature exists.
2. Restore the last owner-approved frontend/API SHA, with an explicit API origin. Keep staging pointed only at staging. Do not reintroduce an implicit production fallback as a configuration workaround.
3. Retain new tables, audit rows, memberships, invitations and attempts. Never run DROP/TRUNCATE or reset subscriptions as application rollback. The existing application ignores additive columns/tables.
4. If any migration fails before commit, its SQL transaction rolls back. Record the failure and preflight facts; do not modify unrelated constraints to force it through.
5. Recovery from data corruption requires a separately approved restore to a separate database/branch, record-level comparison and controlled cutover. Preserve encryption/signing-key versions in secret management. A backup without a tested restore is insufficient.
6. Recheck public readiness/catalogue, login, history and protected PDF access. Record rollback revision/time and support communications. Payment incidents need provider reconciliation; code rollback does not refund or reverse money.

Irreversible actions, live payment changes and publication changes remain owner-gated. Never run a destructive down migration just to make schema match older code.

### Reporting and expiry rollback

Disable `INSTITUTE_EXPIRY_WORKER_ENABLED` and roll back the application revision after owner approval. Keep the additive index and all finalized results/audit rows. Submitted results remain immutable; do not undo grading by rewriting rows. Existing request-triggered grading still applies when a learner returns. Never drop institute tables to roll back a feature.
