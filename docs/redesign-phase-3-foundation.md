# Phase 3 — lifecycle policy foundation

This draft introduces a pure, reusable transition policy and unit coverage. It deliberately does not change the live publication routes or create a second source of truth. Existing mock readiness and human editorial sign-off, immutable study-plan editions, and ebook access restrictions remain authoritative.

The policy supports draft, review, scheduled, published and archived, explicit timezone scheduling, cancellation and mandatory readiness. The readiness argument must come from a server-side adapter, never from a request body. No scheduling worker, write endpoints, migrations, flags or new dependencies are introduced in this increment.

Next steps: build transactional native adapters, durable scheduling with revision checks and idempotency, version snapshots and audit events in the same transaction, then enable admin-only preview/publish controls behind disabled-by-default flags. Independent PDF/course/certification models must exist before their adapters. Do not register a scheduler or expose this policy as an endpoint until these constraints are met.

Verification: run node --test test/publishing-lifecycle.test.js, then npm test, frontend lint/build, and existing student regressions. Rollback is reverting the commits; no data conversion.

## Study-plan integration update

Opt-in migration: run `node scripts/migrate-publishing-workflow.js` against a disposable or explicitly approved staging database. Set backend `PUBLISHING_WORKFLOW_ENABLED=true` and frontend `NEXT_PUBLIC_PUBLISHING_WORKFLOW_ENABLED=true` only after schema verification. The worker polls each minute; native publish rechecks revision, actor, schedule and readiness in its transaction. Blocked jobs remain queued for administrator cancellation/review; a large backlog of blocked jobs can delay later jobs. Existing published editions remain immutable. History lists snapshots but does not restore them. No live environment was modified.

Manual checks: schedule a reviewed draft in staging; verify it remains private before due time; edit a scheduled draft and verify publication blocks; cancel and verify no publish; schedule a ready unchanged draft and verify history. Test denied accounts and two concurrent workers. Disable both flags and stop/restart the worker before rollback; preserve new tables for audit retention. No destructive down migration is supplied.

Outstanding: mock and ebook adapters, independent PDF/course/certification models, bundle transaction, version restore/clone from snapshot, autosave, undo, bulk actions, complete audit coverage and integration/CI verification. This is not the completed Phase 3.
