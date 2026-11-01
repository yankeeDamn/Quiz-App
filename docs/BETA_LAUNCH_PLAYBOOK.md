# ExamPro 10–20 learner beta (opt-in, 2026)

## Goal
After secure launch-readiness and a credible SSC CGL content set, recruit **10–20 consenting learners** from relevant communities. Do not auto-message groups, scrape phone numbers or promise official SSC affiliation.

## Outreach message
"Hi everyone — I'm testing ExamPro, a small independent SSC CGL mock-test platform. It has timed practice, question explanations and score history. I'm inviting 10–20 volunteers to try a free exam and give specific feedback on question quality, login and mobile experience. Please reply here or message me only if interested; I'll share the link and a short feedback form. This isn't an official SSC product."

Post only with admin permission and within group rules. Use one main production domain, not competing Vercel/Render URLs.

**Strict policy:** never scrape member lists or phone numbers, never send unsolicited bulk DMs, and invite only people who explicitly reply or opt in. If a group admin says no, do not post.

## Invitation and access flow (implemented)
- Admin creates a time-limited, email-bound invitation code per consenting learner (`POST /api/v1/admin/beta/invitations`, staging only, human admin account required). Codes are single-account, expiring (1–168 hours) and revocable; only SHA-256 hashes are stored and every create/redeem is audit-logged.
- Learners redeem at `/exampro/beta/mock-01` with the verified account the invitation was issued to, then take the draft Mock 01 through the invitation-scoped attempt routes.
- The in-app **BetaFeedback** panel (1-click category, impact, question/issue description) posts to `POST /api/v1/beta/feedback`; admins triage in Admin → Tests → Beta feedback. A subtle in-page banner reminds testers: *"ExamPro SSC CGL Beta · Found an issue or incorrect answer? Report it below."*

## Metrics to track manually first
- Consented invitations and active testers
- First sign-in/first mock start/first mock completion
- Share of users completing a test without technical problems
- Content quality flags (question ID, issue, source, owner, resolution)
- Return visits in 7 days
- Count of learners who intentionally request Pro, and **paid** conversions after checkout is tested

Use anonymous aggregate counts for public claims. Do not share individual results or email addresses with group members.

### 7-day tracking scorecard (fill in daily)
| Metric | Target | Day 1–7 actual |
| --- | --- | --- |
| Signup success rate (invited → signed in) | ≥ 80% | |
| Mock completion rate (started → submitted) | ≥ 60% | |
| Average sectional score (Reasoning / GA / Quant / English) | record only | |
| Bug reports per 100 questions attempted | < 5 | |
| 7-day retention (any return visit) | ≥ 40% | |
| Unresolved high-severity feedback | 0 before expansion | |

## Feedback questions
1. Could you find and complete a mock test on mobile?
2. Any incorrect/ambiguous questions? Share question IDs.
3. Was the timing, negative marking and result explanation clear?
4. Which exam/topic should be added next?
5. Would you voluntarily pay for deeper analytics and more reviewed mocks? What is missing before that decision?

## Release decision
Consider expanding only after ≥10 opt-in testers have used a complete mock, reported blockers are addressed, a reproducible content-QA procedure exists, and access/payment flows have been tested in the **Cashfree sandbox** (Razorpay is superseded per the 27 Oct 2026 decision; see `docs/PR64_CASHFREE_SANDBOX.md`) with manual admin plan grants verified as fallback. Keep institute dashboard on hold pending real individual demand.
