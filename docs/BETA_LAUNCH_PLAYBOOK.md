# ExamPro 10–20 learner beta (opt-in, 2026)

## Goal
After secure launch-readiness and a credible SSC CGL content set, recruit **10–20 consenting learners** from relevant communities. Do not auto-message groups, scrape phone numbers or promise official SSC affiliation.

## Outreach message
"Hi everyone — I'm testing ExamPro, a small independent SSC CGL mock-test platform. It has timed practice, question explanations and score history. I'm inviting 10–20 volunteers to try a free exam and give specific feedback on question quality, login and mobile experience. Please reply here or message me only if interested; I'll share the link and a short feedback form. This isn't an official SSC product."

Post only with admin permission and within group rules. Use one main production domain, not competing Vercel/Render URLs.

## Metrics to track manually first
- Consented invitations and active testers
- First sign-in/first mock start/first mock completion
- Share of users completing a test without technical problems
- Content quality flags (question ID, issue, source, owner, resolution)
- Return visits in 7 days
- Count of learners who intentionally request Pro, and **paid** conversions after checkout is tested

Use anonymous aggregate counts for public claims. Do not share individual results or email addresses with group members.

## Feedback questions
1. Could you find and complete a mock test on mobile?
2. Any incorrect/ambiguous questions? Share question IDs.
3. Was the timing, negative marking and result explanation clear?
4. Which exam/topic should be added next?
5. Would you voluntarily pay for deeper analytics and more reviewed mocks? What is missing before that decision?

## Release decision
Consider expanding only after ≥10 opt-in testers have used a complete mock, reported blockers are addressed, a reproducible content-QA procedure exists, and access/payment flows have been tested in Cashfree Payments sandbox mode (Razorpay is superseded per the 27 Oct 2026 decision; see docs/PR64_CASHFREE_SANDBOX.md). Keep institute dashboard on hold pending real individual demand.
