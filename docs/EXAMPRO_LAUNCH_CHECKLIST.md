# ExamPro launch-readiness checklist (26 October 2026)

## Included in this PR
- Privacy, Terms, Refund/Cancellation and Contact pages with footer links. **These are initial policy drafts requiring India-specific professional legal review, especially before payments.**
- No public Owner Admin navigation. The existing /admin route continues using backend allowlisted Google/GitHub verification. Do not treat a hidden link as authorization.
- Admin API response cache-control is no-store/private, with noindex headers and unauthorized read/write test coverage.
- ExamPro brand copy, clearer homepage counts (bank includes drafts, "published tests" includes short topic quizzes).
- Per-route SEO titles, canonical metadata, OpenGraph metadata, robots.txt and sitemap.xml.

## Release checks
1. Confirm Vercel AUTH_SECRET matches Render AUTH_SECRET and ADMIN_EMAILS in Render has only authorized verified account emails. Never put ADMIN_API_KEY in a NEXT_PUBLIC_* variable.
2. CI: node --test test/*.test.js from repository root, npm run lint and npm run build in exam-practice-pro.
3. Vercel: configure NEXT_PUBLIC_SITE_URL with your real canonical production origin; review /privacy, /terms, /refunds, /contact, /robots.txt and /sitemap.xml.
4. Confirm /api/v1/admin/me returns 401 without credentials, 403 for a nonadmin OAuth account, and 200 for a configured owner; no browser links should expose /admin publicly.
5. Render autoDeploy is **off**: after approved merge, manually deploy the matching main commit and verify /api/v1/health/ready, then test an exam, translation and sharing.
6. Have a legal/compliance professional verify company identity, legal contact/merchant disclosures, payment practices and statutory obligations before enabling a live Cashfree Payments checkout.

## Subsequent gated milestones
- Cashfree Payments (replaces the superseded Razorpay plan): merchant credentials (server only), server-created orders, HMAC validation, webhook event idempotency, transactionally safe purchase and entitlement records, never client-trusted Pro unlock.
- SSC CGL: ten high-quality full-length, distinct, syllabus- and pattern-reviewed mock exams. Existing 25-question draft practice sets are not full mocks. Validate each before activation.
- Pro analytics: private server-side per-topic and per-section post-exam report, protected by active Pro entitlement; keep basic review freely available.
- Beta: manually recruit opt-in learners within group rules and measure first exam completion, repeat usage and paid conversion. No unsolicited bulk messages.
