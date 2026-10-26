# ExamPro: verify the deployment users are actually seeing (27 October 2026)

## Verified observations
- GitHub PR #38 merged to main at `3742524`; Render needed a manual deploy because autoDeploy is disabled. The manual deploy of that SHA was reported live by Render.
- The EN/हिं/বাং interface, limited translation proxy, mock-test share buttons and competitive-topic builder already exist on main. Older PR #29 was closed without merge; it is **not** the source for the current implementation.
- Questions/options/explanations are translated only when Render has both `AZURE_TRANSLATOR_KEY` and `AZURE_TRANSLATOR_REGION` set. Without those settings the English text is intentionally displayed. A toggle alone cannot translate 621 questions.
- The existing portal builder was a local preview only. This PR adds a public link to an independent practice portal with **live published tests**, not a private institute account.

## If users see old pages after merge
1. Open `https://quiz-app-virid-zeta-41.vercel.app/status`; compare **Vercel Git commit** with the latest approved GitHub `main` commit. This is the check against stale aliases and cached browser builds.
2. In Vercel → Project → Settings → General, confirm the root directory is `exam-practice-pro` and the framework is Next.js.
3. In Vercel → Deployments, open the latest **Production** deployment, not an old Preview. Confirm its commit matches `main`. In Settings → Domains confirm `quiz-app-virid-zeta-41.vercel.app` aliases to that deployment. Promote/redeploy Production if necessary.
4. In Vercel Production environment variables, configure `NEXT_PUBLIC_API_URL=https://quiz-app-regd.onrender.com` (without trailing slash). Redeploy the frontend after changing `NEXT_PUBLIC_*` values; they're baked into build output. This PR also protects production from an unset/localhost URL.
5. On Render, confirm the latest approved main SHA is **Live**, not only build-successful. The API auto-deploy is off. Review migrations before manually deploying. Verify `https://quiz-app-regd.onrender.com/api/v1/health/ready` reports success and connected database.
6. Render `CORS_ORIGINS`, if set, must include exactly the deployed frontend origin `https://quiz-app-virid-zeta-41.vercel.app`, as a comma-separated allowlist without path or trailing slash. This PR adds that origin to the backend defaults if the setting is unset.
7. In Vercel and Render set the **same server-only** `AUTH_SECRET` (never a `NEXT_PUBLIC_` variable). Confirm approved admin emails in Render `ADMIN_EMAILS`.
8. Retest in Brave/Android private tab to rule out a cached build: navigate to `/status`, `/exampro`, `/india-mocks`, and `/exampro/portal?brand=%7B%22name%22%3A%22My%20Institute%22%7D`.
9. For translations, use the static exam UI language controls, then open an active question. Without approved Azure Translator credentials, expect an English fallback warning. Do **not** claim question content is translated.
10. Verify that the portal share URL includes only name/tagline/colour/batch labels. Public shared mock links must still require sign-in and/or paid access when applicable. Don't put private student data, institute credentials, or payment details in URL parameters.

## Release contract
No site deployment is complete merely because GitHub CI passed. The correct proof is:
- Vercel Production alias points to current main SHA;
- Render backend is Live at current approved backend SHA;
- `/status` reports Ready against the public API;
- user on phone can browse mock list, open valid shared links and a public portal;
- an owner can sign in with OAuth and view authorized admin tools;
- timed exam attempts and saved results work without answer-key leakage.

Cashfree payment integration is deferred to #39. Do not merge the old Razorpay PR or enable any gateway before merchant approval.
