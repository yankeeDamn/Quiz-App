# Draft testing errors, Pro publishing and the admin live catalogue

## What the reported screenshots show

- The publication request reports `every question must be reviewed and published first`. This is an enforced content-review gate, not a payment failure. A Pro tier change does not approve source questions.
- The private runner reports `Draft test requires four inactive source topics`. The old implementation actually rejected *any* active source topic, regardless of how many topics the draft used. That prevented general Banking / practice drafts from reusing existing active banks.
- The shown Bank PO mock has 24 configured positions and only 4 accessible questions. “Accessible” follows the public content filters; it is not proof that those four have recorded human review. The new checklist identifies the actual review and publication counts.
- The KPI shows 9 live catalogue entries, 9 Free and 0 Pro, while 5 mock definitions are active. Those are different totals: the live catalogue also contains generated topic tests, and active definitions can be hidden by missing/unreviewed content. This is screenshot evidence, not a fresh database audit.

## Fixes

1. Verified private staging QA now accepts unpublished mocks using active, inactive or mixed source topics. It validates the configuration, rejects missing/retired positions and duplicate ranges, and leaves all source flags unchanged. It works with a single source topic as well as four-section SSC mocks. Private attempts remain marked under review.
2. The same verified OAuth admin, allowlist, isolated staging flags/CORS checks, private attempt namespace and answer-key protections remain. No draft content is added to public endpoints. Missing source configuration has a specific error and retry / return-to-admin controls.
3. **Mocks & Tests Manager → Live Catalogue** lists exactly the current database catalogue, including generated topic tests and their Free/Pro status. Clicking the live catalogue KPI opens that view. Bundled introductory starter packs are deliberately excluded so counts match the database KPI.
4. **All mock definitions** and **Drafts / Hidden** remain available for authoring. Each definition has a **Publication checklist**. A failed publication request opens it automatically. The report is read-only and displays topic-by-topic missing/retired, review/publication and access counts without stems or keys.

## Publishing one Pro mock

1. Open its **Publication checklist** and use **Open questions** for each source topic.
2. Confirm the intended source question access (Free or Pro only) *before* reviewing. Changing access or editing question content returns that question to draft. Changing shared question access can affect other tests using it, so keep shared content assignments intentional.
3. Independently verify every configured question, answer and explanation. Use **Review & publish**, verify the displayed question and explicitly acknowledge the review. **Mark reviewed only** and the later **Publish reviewed question** action remain available. These actions require a verified human admin; private QA never substitutes for review.
4. Restore missing/retired source positions or correct the mock’s ranges. Activate source topics only when their public content is ready. Do not deactivate shared live topics to make Test Draft work.
5. Full SSC CGL mocks also retain their academic/Hindi approval and exam-pattern gates.
6. Return to the mock, set **PRO**, click **Publish mock**, and explicitly confirm publication. Reopen the checklist if the server rejects it. A successful flag change alone is not enough: verify **Published · Live** and its entry in **Live Catalogue**.

## Staging verification after review and approval

No migration, dependency, new environment variable, content import or data repair is required by this patch. Use the existing isolated staging API/database and frontend. Backend changes must be deployed as well as the frontend changes; deploy only after owner approval.

- A verified staging admin can open Test Draft for `comp-banking-set-1` when it has complete active question rows even if its source topic is already active. No need to change topic flags.
- Complete, inactive-source SSC drafts retain their 15-minute section policy (or existing approved compensatory policy), autosave and grading.
- Missing source topics / retired or missing question positions / duplicate ranges still refuse a draft start with an actionable message.
- Guests, ordinary users and API keys remain denied private attempts and the new admin reports. Production staging-gate failures still deny draft testing.
- Click the live KPI: compare all rows and counts with `GET /api/v1/mocks` from the same backend. Automatic `topic-...` tests must be included; hidden definitions excluded.
- Attempt to publish an unreviewed Pro mock: it must still be blocked, and the topic checklist must identify outstanding work. No automatic review or publish operation is introduced.
- Browser checks at desktop/mobile widths and keyboard focus remain required on staging; no browser binary is installed in the authoring environment.

Validation: `npm test` passes **251/251**. Frontend `npm run build` (including TypeScript) and ESLint on changed frontend files pass. Existing private draft authorization, section timing, grading and publication regression tests remain in the full suite. No staging/production record, review flag or publication flag was changed while preparing this patch.
