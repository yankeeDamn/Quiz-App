# Free / Pro catalogue and admin command center

## Diagnosis against current main

Reviewed main `4ea9754a7d4df27379c2e8d495dc86111f1ec45d` (PR #79). At that revision, `GET /api/v1/mocks` already lists complete active Free and premium definitions without requiring a plan. The homepage renders a separate bundled practice list, so those cards cannot show live Pro mocks. Draft definitions, inactive source topics, missing positions, unpublished questions and paid/free overlap also affect catalogue visibility. There is no `mock_tests.status` column: `active` controls publication.

The homepage and `/india-mocks` now share the live catalogue component. The old homepage quizzes and starter certification routes remain. Local starter packs are explicitly practice-only and do not claim to be published scored exams. Pro / premium aliases normalize to the existing `premium` storage value.

## Behavior and safeguards

- All, Free Practice and Pro Mocks filters show computed counts within the current category/search. No invented tests or counts are seeded.
- Pro cards open a dialog for guests and Free accounts. Active Pro / Institute accounts get the full-exam link; the backend independently checks entitlement and expiry.
- Published, complete, reviewed Pro mocks offer the **same first five questions** (or all questions when fewer than five exist). No paging or caller-selected IDs can extend that sample. Initial preview responses omit keys; a validated preview submission reveals only sample solutions. These are unsaved, untimed practice results, excluded from rankings and student attempt totals.
- Unpublishing a mock or losing its source review immediately revokes new detail/preview requests. Existing scored attempt snapshots retain their original questions and timing.
- Paid mocks without recorded question review dates remain hidden. Original Free introductory practice keeps its review badge. Nothing is automatically reviewed, imported, activated or published.
- The dialog reads the current shared pricing configuration: **₹199/month and ₹1,990/year** at this revision. The proposed ₹299/₹1,499 prices were not introduced because existing checkout and database constraints use the current prices. Changing commercial pricing requires a separate coordinated billing change.
- No claims about official papers, video explanations or All-India Rank were added. Section timing appears only when the existing server eligibility policy validates the paper. Existing standard and compensatory timing policies remain in force.
- Catalogue updates are fetched on page focus, visibility change and every 30 seconds while visible. The current admin window also refreshes metrics after mock changes. There is no cross-tab push service.

## Admin workspace

`/admin` defaults to Mocks & Tests Manager. Five primary navigation sections cover mocks, question bank, plans/manual grants, Cashfree audit and staging beta/QA. The question bank retains the separate editable practice library; overview, jobs feed health and ebook management remain reachable.

Five KPI cards query actual bank totals, live Free/Pro catalogue counts, active/draft definitions, submitted student mock attempts with mean attempted-answer accuracy, and active paid accounts/manual grants. An active definition with content blockers is distinguished from a test actually visible in the catalogue. Sandbox payments are never reported as revenue.

The mock table supports search/category filters, confirmed tier changes, confirmed publication, source-question editing, private preview, definition duplication and guarded draft deletion. Duplication shares source question ranges; it is not a new independent paper. Bulk publishing first lists ready candidates/blockers, then confirms the exact candidates and calls the existing PUT endpoint for each. Every candidate is checked again against question publication and SSC editorial/Hindi gates; partial failures are reported.

Deletion requires a verified human admin, a hidden definition and no stored attempts. Pro definitions reserving shared free-tier questions cannot be deleted until the underlying question access is reviewed and made Pro. Source questions are never deleted by this action.

Cashfree audit remains staging/sandbox-only. “Refresh Sandbox Status” reads recorded database/webhook state; it does not call the provider, reconcile a payment, charge, refund or override paid status. Existing verified webhook processing remains responsible for grants. Beta codes retain email binding, expiry and revocation; the sign-in link can be copied separately from the private code.

## Staging setup after approval

No new migration, new dependency, new secret or data seed is needed for this PR. Existing baseline content-review, scored-attempt, plan-grant and optional staging beta/Cashfree tables must already exist. Missing tables should be diagnosed rather than replaced with made-up counts. No database migrations were run while preparing this change.

1. Review the draft PR and its checks. Use the existing isolated staging frontend/API/database; keep production environment variables unchanged.
2. If testing a local checkout in PowerShell:

   ```powershell
   git fetch origin feat/dual-tier-catalogue-command-center
   git switch --track origin/feat/dual-tier-catalogue-command-center
   npm ci
   npm test
   cd exam-practice-pro
   npm ci
   npm run build
   ```

   If that branch already exists locally, use `git switch feat/dual-tier-catalogue-command-center` instead of creating it again.
3. After approval, point the staging Render service and staging Vercel project at this branch/commit. Deploy the backend first, then the frontend. Do not repoint either production service. Ensure Vercel `NEXT_PUBLIC_API_URL` references the staging Render API, Render CORS includes the staging UI, both sides share `AUTH_SECRET`, and the verified reviewer email is in Render `ADMIN_EMAILS`. Existing Google/GitHub OAuth callbacks must match the staging UI.
4. Keep the existing opt-in staging flags for draft/beta and Cashfree tooling. Do not enable staging-only flags on production. No new flags are introduced here.
5. Use an already-reviewed staging Pro mock for the acceptance checks. If none exists, a Pro count of zero is correct. Review source questions and activate topics before explicitly publishing a mock; never mark a draft published just to fill a card.

## Acceptance checklist

| Check | Expected result |
| --- | --- |
| Signed out: `/` and `/india-mocks` | Same live catalogue; both tiers visible when published eligible tests exist; no protected question payload in catalogue responses |
| All / Free / Pro, category and search | Counts and cards update without navigation/reload; zero matches has a clear reset action |
| Free topic test | Start Free Test keeps the secure scored runner; Practice Mode uses the existing unscored explanations flow |
| `/india-mocks/topic-polity?mode=practice` | Existing database topic continues to work when active and published |
| `/india-mocks/az-900?mode=practice`, `/india-mocks/aws-cloud-practitioner?mode=practice` | Bundled introductory practice still works; no scored starter button is advertised |
| Guest / signed-in Free: click Pro | Dialog with actual paper metadata, current pricing and bounded free preview; full detail remains 401 / 403 |
| Preview: load, select choices, submit | At most five fixed questions, sample-only solutions and an unsaved score; no full attempt or leaderboard entry |
| Preview offset / count / ID manipulation | Cannot retrieve questions beyond the fixed sample; invalid submissions fail |
| Active / expired Pro | Active account can start; expired account is rejected by the server |
| Ordinary user, guest, API key | New command-center/preflight/delete operations deny access; a verified human owner is required |
| Admin: publish/unpublish and tier change | Confirmation; backend gates enforced; visible catalogue updates on focus/refresh or within 30 seconds |
| Publish unreviewed / incomplete mock | 409 with the existing review/content blocker; no automatic approval |
| Bulk reviewed drafts | Candidate report shows blockers, only ready candidates are offered, every save is revalidated |
| Duplicate / delete | Copy starts hidden and shares source ranges; tests with attempts or unsafe shared paid ranges cannot be deleted |
| Mobile, keyboard, light/dark | Review cards, scrollable admin table/navigation and modal focus/close behavior at 390px and desktop widths |
| Cashfree and beta QA | Clearly labelled sandbox/staging state; recorded status refresh and private code/link copy work |

## Validation recorded

- `npm test`: **241/241 passing**, including real HTTP/auth middleware tests for catalogue metadata, plan expiry, paid alias handling, draft exclusion, sample bounds, stale preview versions, admin access and deletion guards.
- Frontend production build and changed-file ESLint run locally; see the PR for final outcomes.
- Existing sectional timing/scoring, authorization, publication and content-exposure regression tests remain in the full backend suite.
- No browser binary is installed in this environment, so interactive viewport/keyboard/visual acceptance is still required on staging. No live payment, live exam submission, live data change or production deployment was performed.
