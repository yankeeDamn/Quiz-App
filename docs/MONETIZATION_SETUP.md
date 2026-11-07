# ExamPro monetization: staging setup and acceptance

This change prepares all six monetization surfaces. It does not enable billing, run a database migration, deploy a service, publish ads, or grant real users access. Both feature flags default off. Keep this PR in draft until staging acceptance is complete.

## What is implemented

| Stream | Entry point | Behaviour |
| --- | --- | --- |
| Micro-passes / Pro | `/pricing`, locked-mock dialog | ₹49 SSC CGL 2026 full-mock pass (30 days), ₹99 premium ebook / assessment pass (60 days), ₹199 Pro (30 days), ₹999 Pro (365 days); server-priced Cashfree orders and verified manual UPI grants |
| Direct ads | `/advertise`, admin monetization panel | Submission drafts survive browser refresh; server submissions enter pending review; owner approval, pause, renewal, deletion, expiry and session-based view/click counts |
| Coaching portals | `/c/[slug]`, `/exampro`, admin panel | Approved branding, published assigned tests, mentor contact, language selection, private anonymised batch leaderboard and member enrolment |
| Ebook freemium | `/certifications/learn/[slug]` | Original premium ebook previews are rendered server-side; server strips paid chapters and blocks assessments/PDFs for unentitled readers; owner can configure preview count |
| Live events | Homepage, mock catalogue, dashboard | Owner-configured dates/prize note/mock; actual registration counts; free or ₹19 event registration; ₹29 post-event percentile/report; real completed-attempt data |
| Affiliates / AdSense | Ebook reading, dashboard and completed result | Contextual affiliate URLs with disclosure and tracking; optional isolated AdSense placement, hidden for paid plans and active exams |

## Important product boundaries

- The ten bundled ebook editions and their question banks are already public. They stay free. Upload **new original premium content** through Ebook Studio for a meaningful paywall. Do not claim a pass makes previously public files confidential.
- The ebook pass covers gated ebook assessments. Existing public certification quizzes remain free. Purchase does not override `admin_only` or `invite_only` permissions.
- Public ebook lists and previews omit protected PDF URLs. Protected PDFs must be uploaded through Ebook Studio, not linked from a publicly accessible external URL.
- Existing mock answer review remains available after submission. The ₹29 product adds the **event report / participant percentile**, not exclusive ownership of explanations already provided by the existing runner. It is scoped to one event and can be bought only after completing that event.
- ₹19 is an event registration fee. The selected underlying Free mock remains free; this is not a new exclusive timed-event runner. Event ranking uses the first completed attempt per registered participant started inside the event window; ties share rank. It is an ExamPro participant ranking, not an official examination AIR.
- Institute membership permits private leaderboard viewing. It does **not** automatically grant paid exam access to everyone. Use existing User Plans & Manual Grants for Institute entitlements, or the new pass granter. Monthly retainer status is owner-managed; there is no recurring debit or automatic invoice collection.
- A UPI reference or a browser callback never grants access. The owner must independently verify payment. No two-minute activation guarantee is displayed.
- Local storage holds public ad cache (five minutes) and unsubmitted advertiser drafts only. A draft is never described as submitted when the API fails. Entitlements, grants, approvals and private data have no browser-authoritative fallback.
- Ad counts deduplicate browser sessions. They are indicative, not fraud-proof or audited reach. Deleting a browser session can create another counted session. Expired ads cannot render even from cache; a paused ad can remain in the bounded cache during an outage.
- AdSense is optional and disabled without client, slot and exact custom-domain settings. It uses an isolated frame so a script cannot remain in the parent app after entering a timed runner. Ad serving, merchant/domain approval, consent requirements and provider compatibility still need staging/provider validation; no revenue is guaranteed.

## Apply on staging only after review

1. Confirm the staging Render service and its **staging** Neon connection. Do not replace the production connection string. Back up / branch the staging database before applying the migration.
2. Apply only the additive migration to the intended staging database. Existing schema migrations must already have created `users`, `ebooks` and `exam_attempts_v2`:

   ```powershell
   # STAGING_DATABASE_URL must already be set privately in your terminal.
   psql "$env:STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f src/db/monetization.sql
   ```

   Bash equivalent:

   ```bash
   psql "$STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f src/db/monetization.sql
   ```

   No customer data is seeded. Tables are additive; existing attempts, questions and plan grants are preserved.
3. On the staging API set:

   ```dotenv
   MONETIZATION_ENABLED=true
   MONETIZATION_UPI_ID=<your verified merchant UPI ID, or leave unset>
   MONETIZATION_CASHFREE_MODE=sandbox
   MONETIZATION_CASHFREE_APP_ID=<sandbox app ID>
   MONETIZATION_CASHFREE_SECRET=<sandbox secret>
   MONETIZATION_FRONTEND_ORIGIN=https://exampro-staging-ui.vercel.app
   MONETIZATION_API_ORIGIN=<staging API HTTPS origin>
   MONETIZATION_LIVE_PAYMENTS_ENABLED=false
   ```

   The new Cashfree settings are separate from the existing sandbox implementation. Do not enter secrets into source files, browser variables, PR comments or chat. Existing `AUTH_SECRET`, `ADMIN_EMAILS`, `DATABASE_URL`, and CORS settings must still match staging.
4. Configure the Cashfree sandbox payment-success webhook to `<staging API>/api/v1/payments/webhook`. It receives the raw body, verifies HMAC, independently checks provider order state/amount/currency/customer, and grants in a transaction with unique payment references.
5. On the staging frontend set `NEXT_PUBLIC_MONETIZATION_ENABLED=true`, retain the staging `NEXT_PUBLIC_API_URL`, and rebuild. A build-time flag change requires a new frontend build. Leave AdSense variables unset during ordinary QA.
6. Sign in as an existing owner listed in `ADMIN_EMAILS`. Open `/admin?section=monetization`.

## Acceptance checklist

Use synthetic identities and sandbox payments. Never enter actual card/payment details into a sandbox.

- Guest: existing Free tests and preview routes work. Expired or wrong-scope passes cannot open premium mock details or start scored attempts.
- Payments: buy a ₹49 sandbox pass; verify the server amount is ₹49. Complete payment and use the return-page status check. Deliver the same signed webhook twice: access must extend only once. Tampered signatures, another account's order ID, amount mismatches and customer mismatches must not grant access. Confirm ₹49 cannot unlock Banking or ebook content; ₹99 cannot unlock SSC mocks. Confirm SSC pass analytics work on completed eligible mocks.
- UPI/manual: sign in once as a synthetic learner, independently verify a test reference, enter it in the owner granter, and repeat the same reference. No duplicate extension is allowed; reuse for another product/account is rejected.
- Ads: submit a synthetic ad on `/advertise`; verify pending state and admin contact/reference visibility. Approve only after creative/payment review. Refresh the relevant placement page as Free/guest, view the card in the viewport, click, and review counts. Repeat in the same session and confirm deduplication. Pause and refresh, renew with reviewed payment, expire, delete. Pro/Institute members must see no placement or ad script.
- Exams: enter an active timed mock and a timed ebook assessment; no sponsor/AdSense DOM may be mounted. Only a server-submitted result may mount the post-result placement. Verify answer autosave, refresh recovery, section timing and draft testing still work.
- Ebooks: create a new original public ebook, upload its PDF via Studio, and enable freemium in the new admin panel. In a signed-out browser inspect HTML and API responses: only the first two chapters, no paid PDF URL and no final question keys. Direct PDF, practice and assessment calls must reject a free reader. A ₹99 pass opens the content; revoked invite-only permissions still reject it. The existing ten public editions stay readable.
- Coaching: create a profile with a real logo URL, assigned published mock IDs and a fee ₹3,500–₹10,000. Enable the profile, copy its portal link, enrol a synthetic learner, and compare member/nonmember leaderboard responses. No student emails or full names are public. `/c/demo-academy` is explicitly labelled a demonstration, not a live paid partner.
- Events: schedule a published Free mock using ISO timestamps with `+05:30` for IST. Register accounts, submit attempts inside and outside the window, and compare the rank cohort. Before the end there is no report. After the end, wrong-event passes are rejected; the matching pass unlocks the report. Prize text must state an offer the owner can actually fulfil.
- Affiliates: configure a topic/title/HTTPS URL, complete a matching test and inspect the disclosure and tracked click. Verify paid users see neither affiliate nor advertising placement.
- Mobile and accessibility: test `/advertise`, checkout dialog, all four admin panels, `/c/[slug]`, catalogue and ebook reader at 390px and desktop; keyboard navigation, dialog closing, long URLs and failed requests.

## Verification performed in this change

- `npm test`: 276 passing tests, including 15 new monetization/security tests.
- TypeScript check and production build; repeat with `NEXT_PUBLIC_MONETIZATION_ENABLED=true` before merging.
- No remote database migration, payment transaction, ad publication or production/staging mutation was performed.
- Browser QA could not run: managed preview invokes `next dev --host ... --strictPort`, which this Next.js CLI rejects. Do not interpret compilation as visual/browser acceptance.
- PostgreSQL migration and provider end-to-end settlement still require the staging checks above; automated settlement tests use isolated mocked provider/database adapters.

## Rollback and release

Set API `MONETIZATION_ENABLED=false` and frontend `NEXT_PUBLIC_MONETIZATION_ENABLED=false` (rebuild). Keep the additive tables for audit; do not drop payment/grant records. Already granted Pro plans remain honoured. Pass checks require the feature to remain enabled, so account for existing paid pass holders before disabling it.

Do not activate live payments until staging settlement, refund/support handling, merchant activation and public pricing have been reviewed. Live mode requires **both** `MONETIZATION_CASHFREE_MODE=production` and `MONETIZATION_LIVE_PAYMENTS_ENABLED=true`, production credentials, and the correct approved production origins. The application does not automatically switch from sandbox to live. Fulfilled refund revocation is not automated in this change and must be handled operationally before broad launch.

Cashfree reference: https://www.cashfree.com/devstudio/preview/pg/web/checkout and https://www.cashfree.com/devstudio/preview/pg/tools/webhookVerification
