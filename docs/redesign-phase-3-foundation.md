# Phase 3 — lifecycle policy foundation

This draft introduces a pure, reusable transition policy and unit coverage. It deliberately does not change the live publication routes or create a second source of truth. Existing mock readiness and human editorial sign-off, immutable study-plan editions, and ebook access restrictions remain authoritative.

The policy supports draft, review, scheduled, published and archived, explicit timezone scheduling, cancellation and mandatory readiness. The readiness argument must come from a server-side adapter, never from a request body. No scheduling worker, write endpoints, migrations, flags or new dependencies are introduced in this increment.

Next steps: build transactional native adapters, durable scheduling with revision checks and idempotency, version snapshots and audit events in the same transaction, then enable admin-only preview/publish controls behind disabled-by-default flags. Independent PDF/course/certification models must exist before their adapters. Do not register a scheduler or expose this policy as an endpoint until these constraints are met.

Verification: run node --test test/publishing-lifecycle.test.js, then npm test, frontend lint/build, and existing student regressions. Rollback is reverting the commits; no data conversion.
