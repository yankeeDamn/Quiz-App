# ExamPro 10–20 learner beta (opt-in, 2026)

## Goal
After secure launch-readiness and a credible SSC CGL content set, recruit **10–20 consenting learners** from relevant communities. Do not auto-message groups, scrape phone numbers or promise official SSC affiliation.

## Pre-release gates (all must pass first)
1. **Deployment:** canonical Vercel URL live with `/status` Ready; Google/GitHub sign-in, timed exam start, autosave and result storage verified on Android and desktop (issue #40).
2. **Content:** at least one full-length 100-question SSC CGL mock published after `scripts/audit-ssc-cgl.js` passes and independent human review approves all 100 answers/explanations; sectional timing (4 × 15 min) and scribe/compensatory-time accommodation verified in staging QA (issue #36).
3. **Payments:** Cashfree is the selected gateway (#39). Merchant onboarding and sandbox payment tests come later; do not claim Razorpay or Cashfree is already live. Manual admin plan grants remain the only working plan-activation path until sandbox passes.

## Outreach message
"Hi everyone — I'm testing ExamPro, a small independent SSC CGL mock-test platform. It has timed practice, question explanations and score history. I'm inviting 10–20 volunteers to try a free exam and give specific feedback on question quality, login and mobile experience. Please reply here or message me only if interested; I'll share the link and a short feedback form. This isn't an official SSC product."

Post only with admin permission and within group rules. Use one main production domain, not competing Vercel/Render URLs. For this production cohort, manually share the published mock link with consenting learners; no scraping or unsolicited bulk DMs. Individual invitation codes and the admin beta panel are only for separate isolated-staging QA, not production recruitment.

**Strict policy:** never scrape member lists or phone numbers, never send unsolicited bulk DMs, and invite only people who explicitly reply or opt in. If a group admin says no, do not post.

## Invitation and access flow (implemented)
- Admin creates a time-limited, email-bound invitation code per consenting learner (`POST /api/v1/admin/beta/invitations`, staging only, human admin account required). Codes are single-account, expiring (1–168 hours) and revocable; only SHA-256 hashes are stored and every create/redeem is audit-logged.
- Learners redeem at `/exampro/beta/mock-01` with the verified account the invitation was issued to, then take the draft Mock 01 through the invitation-scoped attempt routes.
- The in-app **BetaFeedback** panel (1-click category, impact, question/issue description) posts to `POST /api/v1/beta/feedback`; admins triage in Admin → Tests → Beta feedback. A subtle in-page banner reminds testers: *"ExamPro SSC CGL Beta · Found an issue or incorrect answer? Report it below."*

## Metrics to track manually first
- Consented invitations and active testers (anonymized signup success rate)
- First sign-in/first mock start/first mock completion (completion rate)
- Share of users completing a test without technical problems
- Content quality flags (question ID, issue, source, owner, resolution) and QA bug counts
- Return visits in 7 days (retention)
- Count of learners who voluntarily request Pro, and **paid** conversions only after checkout is tested

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

Collect in-app reports through the beta feedback form (`Report a beta issue` on the beta mock page, posting to `/api/v1/beta/feedback`) and triage them on the admin beta dashboard. Address urgent user feedback and accessibility issues before charging any customer.

## Release decision
Consider expanding only after ≥10 opt-in testers have used a complete mock, reported blockers are addressed, and a reproducible content-QA procedure exists. Verify invitation/access flows and manual admin plan grants, and test payment flows in the **Cashfree sandbox** (Razorpay is superseded; see `docs/PR64_CASHFREE_SANDBOX.md`). Keep institute dashboard on hold pending real individual demand; summarize findings before deciding whether a secure institute dashboard warrants priority.
