# ExamPro 10–20 learner beta (opt-in, 2026)

## Goal
After secure launch-readiness and a credible SSC CGL content set, recruit **10–20 consenting learners** from relevant communities. Do not auto-message groups, scrape phone numbers or promise official SSC affiliation.

## Pre-release gates (all must pass first)
1. **Deployment:** canonical Vercel URL live with `/status` Ready; Google/GitHub sign-in, timed exam start, autosave and result storage verified on Android and desktop (issue #40).
2. **Content:** at least one full-length 100-question SSC CGL mock published after `scripts/audit-ssc-cgl.js` passes and independent human review approves all 100 answers/explanations; sectional timing (4 × 15 min) and scribe/compensatory-time accommodation verified in staging QA (issue #36).
3. **Payments:** Cashfree is the selected gateway (#39). Merchant onboarding and sandbox payment tests come later; do not claim Razorpay or Cashfree is already live. Manual admin plan grants remain the only working plan-activation path until sandbox passes.

## Outreach message
"Hi everyone — I'm testing ExamPro, a small independent SSC CGL mock-test platform. It has timed practice, question explanations and score history. I'm inviting 10–20 volunteers to try a free exam and give specific feedback on question quality, login and mobile experience. Please reply here or message me only if interested; I'll share the link and a short feedback form. This isn't an official SSC product."

Post only with admin permission and within group rules. Use one main production domain, not competing Vercel/Render URLs. Invited testers redeem individual invitation codes (issued from the admin beta panel, staging only); no scraping or unsolicited bulk DMs.

## Metrics to track manually first
- Consented invitations and active testers (anonymized signup success rate)
- First sign-in/first mock start/first mock completion (completion rate)
- Share of users completing a test without technical problems
- Content quality flags (question ID, issue, source, owner, resolution) and QA bug counts
- Return visits in 7 days (retention)
- Count of learners who voluntarily request Pro, and **paid** conversions only after checkout is tested

Use anonymous aggregate counts for public claims. Do not share individual results or email addresses with group members.

## Feedback questions
1. Could you find and complete a mock test on mobile?
2. Any incorrect/ambiguous questions? Share question IDs.
3. Was the timing, negative marking and result explanation clear?
4. Which exam/topic should be added next?
5. Would you voluntarily pay for deeper analytics and more reviewed mocks? What is missing before that decision?

Collect in-app reports through the beta feedback form (`Report a beta issue` on the beta mock page, posting to `/api/v1/beta/feedback`) and triage them on the admin beta dashboard. Address urgent user feedback and accessibility issues before charging any customer.

## Release decision
Consider expanding only after ≥10 opt-in testers have used a complete mock, reported blockers are addressed, a reproducible content-QA procedure exists, and access/payment flows have been tested in Cashfree sandbox mode. Keep institute dashboard on hold pending real individual demand; summarize findings before deciding whether a secure institute dashboard warrants priority.
