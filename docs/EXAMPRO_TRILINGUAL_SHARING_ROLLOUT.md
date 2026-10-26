# ExamPro language, share links, and competitive topic synchronization

## Deployment model (do not replace the existing architecture)

- **Vercel** hosts Next.js under `exam-practice-pro`.
- **Render** hosts the existing Express API (autoDeploy is disabled).
- **Neon** remains the sole source of `mock_topics`, `mock_questions`, `mock_tests` and scored attempts.
- New API routes are `GET /api/v1/exampro/competitive-topics` (public metadata only),
  `GET /api/v1/exampro/topic-accuracy` (authenticated, private aggregates only), and
  `POST /api/v1/exampro/translate` (optional paid Azure Translator proxy).
- No new database tables, schema migrations or destructive SQL.

## Release

1. Review PR and CI, including manually testing mobile/desktop navigation and the secure exam flow.
2. Verify a recent Neon backup before changes.
3. Merge with approval, deploy updated Render `main` **manually**, then confirm the API is live.
4. Deploy Vercel `main` and test `/exampro`, `/india-mocks`, `/india-mocks/{id}`.
5. Test one published topic with `?mode=practice`, an unpaid premium mock and a secure scored attempt. Verify original answers, scoring and result history are unchanged.
6. Test `/exampro?test=<PUBLISHED_TEST_ID>&lang=bn` and the Copy/WhatsApp actions. A link only resolves to a public catalogue ID, then opens the **test's start/confirmation page**. It does not bypass sign-in or start the server deadline.
7. Review the four competitive topic cards in both the Mock Tests grid and Custom Builder. Personal topic-accuracy bars are computed only from the signed-in user's completed **server-scored** attempts; no completed scored attempts means no percentage, rather than a fabricated 0%.
8. Review the four competitive topic cards. The three inactive topics are visible as *Coming soon*, **not selectable**, and their question/answer content is **not exposed**. Owner can later activate/publish them via `/admin` after reviewing quality.
9. For custom practice, select any available competitive topic(s), then start `/exampro/custom-practice?topics=...`. This intentionally uses the existing unscored `ExamEngine`; it is **not** a server-scored mock and its topic accuracy is shown in that session's results.

## Bengali / Hindi translation configuration

User-facing EN/हिं/বাং controls and basic UI labels work without additional cloud services. For actual AI-assisted dynamic translation of question text, options and explanations:

1. Provision **Azure AI Translator** in your own subscription and review the pricing/quotas.
2. Set `AZURE_TRANSLATOR_KEY` and `AZURE_TRANSLATOR_REGION` **only on the Render backend**, never in `NEXT_PUBLIC_*`, GitHub, HTML or a client bundle.
3. Manually deploy the backend after saving the environment variables.
4. Open a **published** practice test and change the language. Only the currently displayed question/options/explanation are translated. The browser caches successful translations in `localStorage`.
5. Translations are supplementary, may contain errors, and **never modify** canonical English questions, option indexes, correct answers, server scoring, or a saved attempt. Users must use the original English content when translations are ambiguous.
6. Without a configured provider, the exam shows the original English question content **with a clear warning**, not fabricated translations.
7. The API enforces small batches, a timeout and 30 requests / 15 minutes / IP in addition to general rate limiting; this prevents a surprise full 500-question batch charge. Check Azure Translator costs and quotas before enabling.

## Preserved constraints

- Refresh recovery for **scored** exams is managed by the existing `SecureExam` + Render/Neon attempts; this work does not replace it with browser-only scoring.
- A local portal builder preview still stores local branding in the browser. The new branded preview share link includes only institute name/tagline/colour/batches, **not** phone, WhatsApp group link or logo data, and does not create an institute account.
- Current production checkout is a **manual WhatsApp payment and admin confirmation** workflow. No verified instant UPI integration is present; this PR neither adds nor claims one. Payment confirmations must never be inferred from a UPI intent link.
- Truthful institute-preview/practice-only disclaimers remain. It is incorrect to strip factual limitations under the guise of a production polish.
- 500 imported competitive questions remain in Neon; existing draft/published statuses remain unchanged.

## QA focus

- Language query precedence (`?lang=bn`) and locale changes from header inside a shared deep link.
- WhatsApp/copy links on catalogue cards, `/exampro`, pre-test, exam header and result.
- Legacy test aliases like `ssc1` **are not mapped automatically** to unrelated Neon test IDs. Such links explain that the test is not published or the ID is invalid.
- Active/inactive topics and custom builder checkboxes reflect Neon after a refresh.
- Translation provider offline, rate limited, and invalid responses gracefully fall back to English.
- Accessible buttons, no horizontal mobile overflow, reduced motion preferences, no score/answer-key leaks.
