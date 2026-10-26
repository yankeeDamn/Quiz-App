# ExamPro live features: language, share links, four-topic builder

This release updates the **current Next.js /exampro + /india-mocks**, Render Express API and Neon **read-only** topic discovery. It does **not** replace or embed the old independent browser-only `exampro/index.html` demo.

## Existing production facts (Oct 26, 2026)

- Four competitive groups have 125 questions each in `mock_topics` / `mock_questions`.
- Only SSC CGL is currently active. The other three groups and twenty 25-question mock sets remain unreviewed/inactive; this change **does not** activate them.
- Exam attempts/deadlines and grade logic remain in Render + Neon, using the existing `exam_attempts_v2` records.

## Release

1. Review GitHub PR, confirm backend Node 18/20/22 tests and frontend Next.js build pass. **Do not merge without owner approval.**
2. Merge. Render service `quiz-app-regd` has **auto-deploy OFF**: manually deploy latest **main** from Dashboard; the existing build command `npm ci --omit=dev && npm run db:migrate` is retained. No new migration is added by this release.
3. Confirm Vercel has deployed the same `main` frontend commit.
4. Visit `/api/v1/mocks/competitive-topics`, `/exampro#build-topics` and `/india-mocks`; verify four topics, three inactive, and no leaked draft answers.
5. Click “Copy link” or “Share on WhatsApp” on a published test, then open `/exampro?test=topic-comp-ssc-cgl-2026&lang=bn` in another browser. Only **published** IDs redirect to the original test page. The scored-test sign-in and start prompt still apply. Unknown/draft IDs must not start an exam.
6. Practice a live topic from the builder; only active topics are selectable. Custom combinations are **unscored browser practice**, distinct from `SecureExam`; no server grades are generated from them.
7. Sign into a verified account and submit a scored topic attempt to populate real accuracy bars; unavailable or never-attempted categories do not display invented scores.
8. Check on a phone (360px and larger), English/Hindi/Bangla, dark and light themes, WhatsApp share, Copy link and browser refresh during a scored exam.

## Azure Translator (optional)

Translation requires a separately provisioned **Azure AI Translator** resource and these **Render server-side** environment variables:
- `AZURE_TRANSLATOR_KEY` (keep secret; never expose as `NEXT_PUBLIC_*`)
- `AZURE_TRANSLATOR_REGION`
- `AZURE_TRANSLATOR_ENDPOINT` (optional; defaults to `https://api.cognitive.microsofttranslator.com`)

The API endpoint `POST /api/v1/translate` accepts **1–6 English strings**, up to 1000 characters each, destination `hi` or `bn`; rejects other locales and unknown endpoints; 20 calls / IP / 15 minutes. The browser requests translations for **the currently visible question**, not the full bank, and caches successfully translated fragments in localStorage to reduce spending. Azure request failures and missing configuration show **original English text** with a message. The UI chrome has curated Hindi/Bangla strings even without Azure.

**Important:** This PR does not guarantee fully accurate machine translations or instant conversion of all 620/621 questions; math notation and exam terminology require manual review. Set an Azure spending limit/quota before enabling translation. Do not count requests made by attackers as authorized purchases.

## Payments and legacy fixes

- Existing scored exam resume uses server-side snapshots and deadlines, not a user-supplied browser timer.
- The branded portal preview link shares **name, tagline, accent color, batch labels** only, without logo or contact data. It does not create a persistent institute account.
- **There is no verified instant UPI payment-gateway integration in the current Next.js pricing code.** The current flow uses WhatsApp coordination followed by owner approval. Do not advertise payments as instant/automated until an authenticated provider checkout, webhook signature verification, idempotency, and reconciliation are implemented.
- The `exampro/index.html` old-browser demo is unchanged. Screenshots from the old engine are not evidence that features exist in the deployed React version.
