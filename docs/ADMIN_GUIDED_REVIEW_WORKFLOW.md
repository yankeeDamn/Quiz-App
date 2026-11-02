# Guided question review and mock publishing

This patch replaces the dense text-link actions shown in the owner's screenshot with an explicit review workflow. It changes the application code; it does not review or publish any existing questions or mocks by itself.

## Question Bank

- Select a topic to see readable question cards, separate option tiles, a marked correct answer and the explanation.
- Status filters and counts distinguish **Needs human review**, **Reviewed / ready to publish**, **Published & reviewed**, and **Retired**. A legacy published row with no recorded review is shown as needing review, not as approved.
- Use **Review & publish** to open a confirmation dialog containing the exact question, choices, correct answer and explanation. A fresh checkbox acknowledgement is required before approving the displayed version. **Mark reviewed only** preserves the separate review-then-publication option.
- **Publish & review next** saves the current question and opens the next pending question. The acknowledgement resets for every question; it never approves a batch automatically.
- Already-published, reviewed questions show a disabled **Published** indicator. Their edit/access/retirement actions remain available.
- Changing access opens a confirmation dialog. Cancel does not write. Confirm changes Free/Pro access and returns the question to draft with its review cleared. The warning explains that shared mocks can be affected.
- Editing saves as a draft and resets review. Retirement preserves question position and existing attempt snapshots. Restoration is explicit and explains that already-published content can become visible again.
- Success/error messages appear in the workspace and beside the affected card. Controls lock during saves to avoid duplicate requests. Topic switching remounts the workspace and ignores late responses for the previous topic.
- Pagination limits the list to ten question cards at a time. New-question and import tools open on demand. Existing CSV validation and pipe import remain available.
- A private topic can be activated after at least one reviewed question is published and no published question lacks review. Remaining unpublished drafts stay private. Source-topic activation still does not publish a mock.

## Returning to the mock

Opening questions from a mock or its checklist preserves the originating mock ID. **Back to this mock** / **Continue to mock publishing** returns to that mock's refreshed checklist.

Mock status badges are read-only labels. Each row has an explicit **Publish mock** or **Unpublish mock** action in its **More actions** menu. Publication still prompts for confirmation and rechecks the existing server gates. The checklist has a **Publish mock** action enabled only when its recorded checks pass. Full SSC academic/Hindi sign-off remains separate.

Private previews and publication checklists open in dialogs instead of appearing out of sight below a long table. New/edit mock forms scroll into view and receive focus.

## Mock manager actions and discovery

- The manager has two prominent actions per definition: **Check readiness** (or **View live test** for a live definition) and **Review questions**. A keyboard-accessible **More actions** menu contains settings, private preview, staging draft testing, duplication, publication, guarded deletion and the existing SSC release/academic tools. The menu uses a portal so table scrolling does not clip it.
- **Check readiness → Publish mock** remains the recommended release path. Direct publication in the menu uses the same server gates. Tier changes, publication, unpublishing and deletion show an in-app confirmation with the mock name and consequences. Cancel performs no mutation.
- Status tiles filter all definitions, live mocks, drafts or active-but-hidden definitions. Counts come from loaded definitions, not illustrative totals. The separate **Live Catalogue** view also includes generated topic tests and remains the exact database catalogue learners see.
- Combine search (name, ID or exam), category, tier and status filters. Sort by name, configured question count or duration. Clear filters restores the full view. Pagination offers 10, 20 or 50 definitions per page; changing filters returns to page one.
- Desktop supports list and card layouts. Narrow screens use cards with large touch targets, keeping actions reachable without sideways table scrolling. Light/dark styling follows the existing theme.
- The floating WhatsApp shortcut is suppressed on admin routes so it cannot cover actions. The existing footer support link remains; student pages retain their floating shortcut.
- **Export CSV** downloads metadata for all matching definitions, across pages. It excludes question text, options, answer keys and explanations, and neutralizes formula-like text cells. Export does not change the database.
- **Copy student link** is available only for live definitions. Preview and draft QA remain private and do not imply publication or question review.
- **Check ready drafts** opens a read-only candidate list. Its explicit publish action submits only candidates already reported ready; each is checked again by the backend. Blocked drafts are never automatically reviewed or approved.

## API and concurrency

`POST /api/v1/admin/questions/:qid/workflow` requires the existing verified human-admin middleware and rate limits. Supported commands are `review`, `review_publish`, `publish`, `draft`, `access`, `retire` and `restore`.

Admin question reads include an opaque `revision` derived from content, access, activity and review state. A workflow mutation locks the row and checks the displayed revision before writing. Stale windows receive 409 and cannot approve a newer question or overwrite a changed access state. Review/publish commands validate the source question. `review_publish` records the human approval and publication in one transaction, without a transient partially-saved review state.

`publish` requires an existing recorded review and retains its date/reviewer. `access` and `draft` clear review. API keys, guests and ordinary accounts cannot use the workflow endpoint. Existing legacy routes remain for compatibility. No migration, dependency, secret or content seed is introduced.

## Verification

- Full backend suite: **261 tests passing** locally (the former source-string confirmation check is now covered by browser interaction), including transaction/revision checks and HTTP denials for the new command route.
- Frontend TypeScript/build and changed-file ESLint are checked locally and in CI.
- The frontend CI job installs a pinned, isolated Playwright browser tool under runner temporary storage, starts the production frontend locally, and runs `scripts/admin-workflow.browser.cjs` with intercepted identity/API fixtures.
- Browser acceptance covers mock filters, sorting, pagination, CSV metadata export, action-menu links, preview, edit/duplicate forms, cancelled changes, confirmed tier changes, rejected publication and mobile cards. It also covers fresh acknowledgement per question, publish/next, cancel/confirm question access changes, already-published state, question pagination, topic-switch isolation, return-to-mock readiness and disabled premature publication. Synthetic desktop/mobile screenshots are retained as the `admin-workflow-ui` CI artifact for seven days. No external API, payment, OAuth provider or live database is contacted by that script.

## Staging acceptance after approval

1. Deploy the reviewed backend and frontend to the existing staging environment. Backend deployment is required for the new revision-aware endpoint; old APIs leave workflow controls disabled with a refresh/update hint. No database migration is needed.
2. Open a question from an unpublished mock. Confirm the correct option and explanation are readable and the button matches its current review state.
3. Review a single question. The confirmation checkbox must be required and reset for the next question. Verify the result beside the row.
4. Cancel an access change; nothing should change. Confirm an intended access change and verify review resets. Do not change shared live content merely to test the UI.
5. With two admin windows on an isolated test question, change one version and attempt to approve the stale version in the other. The stale operation must fail and require reloading/reviewing.
6. Return to the originating mock, review remaining blockers, and confirm only a ready mock enables publishing. Private Test draft remains separate.
7. Review desktop/mobile, light/dark and keyboard behavior. Do not publish an unreviewed live bank as part of acceptance.

No staging/production data, review state or publication flag was changed while authoring this patch. Merge and manual deployment remain owner decisions.
