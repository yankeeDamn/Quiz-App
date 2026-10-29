# ExamPro — Azure On-Demand Hindi & Bangla (EN · हिं · বাং)

**This feature adds live machine translation only. It does not certify or publish any exam content.**

## Existing architecture retained

- Next.js app on Vercel: existing EN/हिं/বাং tab is kept.
- Express API on Render: secrets stay backend-only; no key in Vercel or browser.
- Neon: canonical English questions, options, numeric answer indexes, exam attempt state and admin review records remain unchanged. **No translation database or migration is needed** for the new live tab.
- Verified Hindi, when available, overrides machine text for a specific question. Otherwise the tab displays Azure-translated text with an advisory warning and the EN tab remains available to check the original.
- Exam answer keys, scoring, randomization, durations, secure section boundaries and saved responses are never translated or changed.

## Azure setup — first staging, then separately approved production

1. Open [Azure Portal](https://portal.azure.com/) → **Create resource** → search **Translator** (Azure AI Translator / Foundry Tools Translator). Choose your own Azure subscription and verify eligibility of any startup credits.
2. Choose F0 if available under your subscription (Microsoft lists **2 million free standard-translated characters/month** for F0). Each resource and subscription may have constraints. If F0 is unavailable, review expected S1 spend.
3. Create the resource, then open **Keys and Endpoint**. Keep the key confidential.
4. Open Render **exampro-staging-api → Environment**, add:
   - `AZURE_TRANSLATOR_KEY`: secret key from Azure
   - `AZURE_TRANSLATOR_REGION`: region shown in Azure (mandatory for regional/multiservice resources, optional for global single-service)
   - `AZURE_TRANSLATOR_ENDPOINT`: optional; default `https://api.cognitive.microsofttranslator.com`; for approved custom Azure Translator endpoints supply the path from Keys and Endpoint.
   - `AZURE_TRANSLATOR_DAILY_CHARS=60000`: default *best-effort* per-instance throttle. Limit can be tuned on staging.
5. Do **not** put the key in `NEXT_PUBLIC_*`, GitHub, Vercel or screenshot. Do not alter production `DATABASE_URL` or production Render secrets.
6. After this PR is reviewed and merged, deploy the approved SHA to **staging Render and staging Vercel** (the latter only if not already current). Test via signed-in Staging Admin or Exam Hall.
7. Configure an **Azure Monitor / Cost Management budget and alerts**. The service's in-memory per-instance budget resets on restart and is **not** a hard subscription-wide spending ceiling.

## End-to-end checks

- **Staging Test Draft:** open secure Mock 01, choose EN, हिं, বাং. Verify only displayed question and four options change. Your selected answer is unchanged across languages and refresh.
- Review a submitted attempt: expand **Translate this review**; Azure translates selected answer labels and explanations on demand.
- **Admin → Mock tests → Review questions**: select a draft non-English-Comprehension question, press **Generate Hindi draft with Azure**. It fills question, four choices and explanation **without saving any DB record or marking verified**. Review and edit the six fields; only a genuine qualified human reviewer may save Verified. English Comprehension is exempt from SSC Hindi review.
- Switch off `AZURE_TRANSLATOR_KEY` in staging to test graceful English fallback and error messages; restore once verified.
- Check that guests cannot call `/api/v1/exampro/translate-exam` (401); public previews remain IP-limited at 30 requests / 15 min and signed-in exams are user-limited at 130 / 15 min. Service batches max 8 strings and 3600 total chars.
- Repeated source/question translations cache client-side by language and content hash. Private exams use **per-tab in-memory caching only**, so draft question text is not persisted in localStorage. Public preview pages may still use localStorage. The server uses a bounded cache (1500 entries, 7-day expiry). Caching on Render Free is ephemeral; starting a new instance may cause extra Azure requests.
- Confirm `npm test` and Next.js production build pass in GitHub Actions.

## Academic safety

Azure Translator can accelerate authoring and enable Hindi/Bangla **practice previews**. It can mistranslate math wording, constitutional/technical terms, negation and distractors.

A student clicking the tab **does not** mean SSC's bilingual equivalence requirements have been met. PR #51's server publish gate **continues to require 100/100 human academic approvals and 75/75 verified Hindi translations** for the official-pattern Mock 01. Do not auto-approve questions, remove that gate or advertise an AI-generated question set as official.

Production release requires separate approved staging-to-production content import, 15-/20-minute accessibility testing and 10–20 opt-in beta learners. Cashfree and a private multi-tenant coaching-institute admin are later milestones.

## API paths

- `POST /api/v1/exampro/translate`: public, IP-limited, existing landing-page preview; JSON `{language:"hi"|"bn",texts:string[]}`.
- `POST /api/v1/exampro/translate-exam`: verified Auth.js OAuth bearer required; larger per-user limit for active exams and reviewer drafts; same input/output.
- Responses: `{success:true,data:{texts:string[],provider:"azure",advisory:true,cached:number}}` or a bounded error. No Azure key is returned.

## Troubleshooting after a successful deployment

When the staging Render deployment says **Live**, this only proves the Node API
started; it does not prove the Azure service accepted a translation request.

1. Open `https://exampro-staging-ui.vercel.app/admin` while signed in with the
   approved Google account. Use **Mock tests → Review questions**, select one
   non-English-Comprehension question, then press **Generate Hindi draft with Azure**.
   Or start a secure private **Test Draft** and tap **हिं** or **বাং**. Switching
   languages on the Admin navigation alone does not translate every admin label.
2. If the request fails, open Chrome DevTools → **Network**, filter
   `translate-exam` and inspect the HTTP status and safe JSON error message.
   Do not copy your Authorization bearer header or Azure key into tickets.
3. **No translate-exam request**: check that you are in the secure exam or review
   UI, that you are signed in, and that staging Vercel's
   `NEXT_PUBLIC_API_URL` points to `https://exampro-staging-api.onrender.com`.
   Also confirm Vercel is deployed from the latest commit.
4. **401 from ExamPro**: check Auth.js sign-in and `AUTH_SECRET` alignment
   between staging Vercel and staging Render. This is not an Azure-key error.
5. **400**: input did not pass the batch validator; check question/choice/
   explanation presence and total payload size.
6. **429 from ExamPro**: proxy-based/global limit or per-user translation limit.
   On Render the backend now trusts the last platform proxy hop; the dedicated
   authenticated exam limit is 130 requests/15 minutes per user. Public
   translation preview remains 30 requests/15 minutes per IP.
7. **502 with Azure HTTP 401/403**: check Azure KEY 1, resource type and
   `AZURE_TRANSLATOR_REGION`. For a Global single-service Translator
   resource, an unnecessary `global` region header can be wrong; leave
   `AZURE_TRANSLATOR_REGION` unset if the resource uses Global and Azure
   documentation says no region is required.
8. **502 with Azure HTTP 404**: check `AZURE_TRANSLATOR_ENDPOINT`. The global
   default is `https://api.cognitive.microsofttranslator.com` (no /translate
   suffix needed in the environment variable).
9. **503 for quota**: check Azure F0 plan usage and
   `AZURE_TRANSLATOR_DAILY_CHARS`. This in-memory limit is per instance, so
   configure subscription-level budgets/alerts too.
10. **CORS or API_UNAVAILABLE**: check `CORS_ORIGINS` on staging Render contains
   `https://exampro-staging-ui.vercel.app` and the frontend uses the
   matching staging API URL. Do not point staging at the production API.

The rendered translated text is machine-generated and advisory. Approved SSC
bilingual content still requires independent human editorial sign-off.
