# ExamPro staging release readiness — controlled audit and runbook

**Audit date:** 2 November 2026  
**Scope:** GitHub main, Neon schema and counts (read-only), existing deployment/runbook/tests.  
**GitHub baseline:** main at 880f4883531fb962ba4e32355f200222f06446af, with successful CI run 41327940864.  
**Decision:** **HOLD** — neither the SSC full mocks, student recruitment, nor live Cashfree should be released by this change.

## Read-only evidence

Neon project: exampro-prod (project ID noisy-hat-74026044). The *Neon branch* exampro-staging (br-snowy-heart-b5wjnd9e) is separate from production (br-noisy-field-b5yp1zxj). Both were ready at inspection. **This does not independently prove which DATABASE_URL Render currently uses.**

| Check | Staging | Production |
| --- | --- | --- |
| Stored mock questions | 820 | 621 |
| Full Mock 01 / Mock 02 | Two inactive 60-minute drafts | Neither full draft present |
| Draft source sections | 8 inactive topics, exactly 25 questions each | Not present |
| Mock question review rows | 0 | 0 |
| Human academic approvals | 0 | 0 |
| Human-verified Hindi reviews | 0 | 0 |
| exam_beta_invitations | **MISSING** | Absent by design |
| exam_beta_feedback | **MISSING** | Absent by design |
| exam_beta_invitation_audit | **MISSING** | Absent by design |
| Cashfree sandbox order/webhook tables | Present | Absent by design |

**Neon expiration risk:** the staging branch currently reports expires_at = **2026-11-22T19:20:00Z** (23 November 2026, 00:50 IST). Extend the TTL if your plan supports it, or preserve an operator-verified recoverable backup before expiration. Neither operation was performed in this PR. The production branch is not scheduled to expire in this observation.

**GitHub CI baseline:** main's last inspected successful run includes backend test matrices, Next.js build, Docker check, and PostgreSQL ebook integration tests. CI success does **not** verify the running Vercel alias, Render staging SHA, Azure credentials, actual invitations, or browser-based exam persistence.

## Blocking findings and boundaries

1. **Beta DB migration absent.** The invitation, feedback and invitation audit tables are not present in staging, despite the corresponding code and tests being merged in PRs #57–58. The SQL files remain intentionally excluded from src/db/migrate.js.
2. **Academic release gate unmet.** Both 4 × 25-question full-length staging mocks are inactive. Neither has recorded independent 100/100 academic approvals or 75/75 human Hindi verifications. Do not label machine translation as verified or activate topics/mocks.
3. **TTL needs an operator decision.** Check the actual branch, remaining duration and backup/restore process in Neon Console. A branch can expire while GitHub tests remain green.
4. **Deployment boundary unverified.** This audit did not inspect live Render service configuration or Vercel domain mappings, OAuth secrets, CORS isolation, Azure Translator responses, or signed-in user sessions. Treat those as manual acceptance gates.
5. **Payments remain sandbox-only.** PR #71 adds user-scoped order-status polling; neither a passed sandbox test nor a closed GitHub issue enables production payments or fulfills refund/reconciliation requirements.

## Recommended safety-first operator sequence — no migrations have been run

### A. Preserve and identify the correct staging branch

1. Open [Neon Console](https://console.neon.tech/) → project exampro-prod → Branches → **exampro-staging**. Verify project/branch name and ID, the expiry shown above, and the staging connection string's branch-specific endpoint. Save an approved recoverable snapshot/backup and address TTL **before** any migrations. Do not reset, rename or delete either branch.
2. Confirm Vercel staging uses NEXT_PUBLIC_API_URL pointing at the **staging** Render API (not quiz-app-regd.onrender.com). On staging Render, check DATABASE_URL points to this staging Neon branch, EXAMPRO_ENV=staging, ENABLE_ADMIN_DRAFT_TESTS=true, CORS_ORIGINS only allows the staging Vercel origin, and staging AUTH_SECRET matches the staging frontend but not production. Do not print or paste any secrets into tickets.
3. In the **Neon SQL Editor with the staging branch selected**, use only SELECT statements below. Note: current_database() is usually the same on different Neon branches and does **not** prove branch identity.

~~~sql
SELECT current_database() AS database_name;
SELECT x.name AS required_table, to_regclass('public.' || x.name) IS NOT NULL AS exists_now
FROM (VALUES ('exam_beta_invitations'), ('exam_beta_feedback'), ('exam_beta_invitation_audit')) AS x(name)
ORDER BY x.name;
SELECT id, active, minutes FROM public.mock_tests
WHERE id IN ('ssc-cgl-2026-mock-01', 'ssc-cgl-2026-mock-02') ORDER BY id;
~~~

### B. Request approval for staging-only migrations (not part of this PR)

After branch identity, TTL and recovery are independently verified, the authorized owner can explicitly approve a separate staging-only migration operation:

1. Review [src/db/beta-invitations.sql](../src/db/beta-invitations.sql). Apply this file **first** in Neon SQL Editor with exampro-staging selected. It creates exam_beta_invitations and its index, relying on existing public.mock_tests and public.users.
2. Review [src/db/beta-feedback-audit.sql](../src/db/beta-feedback-audit.sql). Apply this file **second** on the same staging branch. It creates exam_beta_feedback, exam_beta_invitation_audit and their indexes. The latter has a foreign key to exam_beta_invitations, so order matters.
3. Verify all three tables, columns, indexes and foreign keys exist; inspect errors before proceeding. These files use CREATE TABLE IF NOT EXISTS, which does not fix a pre-existing incompatible table shape: stop and review if any partial schema already exists.
4. **Do not use npm run db:migrate for these two manual staging-only migrations.** That general command also runs other migrations and content seeding. Never execute beta or Cashfree sandbox SQL on production.
5. No student invitations or database inserts should be created until content, security and accessibility reviews are approved.

### C. Repeat read-only preflight

From a local clone of this **draft branch**, first run npm ci in repository root. Obtain the dedicated staging DATABASE_URL securely (do not commit it, paste it into an issue, or place it in a command saved to shell history). In Windows PowerShell with the staging connection in the current process environment:

~~~powershell
$env:EXAMPRO_ENV = 'staging'
$env:STAGING_PREFLIGHT_BRANCH = 'exampro-staging'
# DATABASE_URL must already be supplied securely for the verified Neon staging branch.
npm run readiness:staging
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:STAGING_PREFLIGHT_BRANCH -ErrorAction SilentlyContinue
Remove-Item Env:EXAMPRO_ENV -ErrorAction SilentlyContinue
~~~

The script starts a PostgreSQL **REPEATABLE READ, READ ONLY** transaction; uses SELECT only; returns table presence and column checks, mock active flags, section counts and academic/Hindi approval counts. It never fetches student email addresses, invitation codes, answer keys or full question text. Results are safe-to-share aggregates, but review the output before publishing it. EXAMPRO_ENV and STAGING_PREFLIGHT_BRANCH are **operator acknowledgements only**; they do not cryptographically verify which Neon branch the connection targets. The human must verify the endpoint in Neon Console.

Exit codes: 0 = no automated blockers, still requires manual signoff; 1 = blockers present, intended while quality review is pending; 2 = invalid operator acknowledgement, connection or preflight failure. **A zero exit code never authorizes publication, paid activation, production migration or recruitment.**

### D. Manual staging acceptance after approved migration

- Confirm all three beta tables exist and complete access/expiry/revoke/feedback tests using staging test identities, with no leaked invitation tokens.
- Confirm anonymous/non-admin users cannot access draft answer keys; authorized beta access is email-bound; expired/revoked access is denied on every request.
- Review Mock 01 in Admin → Tests: independent academic 100/100 and human Hindi 75/75; test the exact official 2026 pattern, 15-/20-minute permitted timers, mobile/keyboard access, safe answer persistence and post-submit review.
- Confirm private draft data never appears in the public mock catalogue, student history or share links.
- Confirm staging/production isolation by inspecting **both** Vercel build SHAs, **both** Render Live SHAs, API health endpoints, OAuth and CORS settings. A successful GitHub CI is not proof of live deploy.
- Confirm live payments stay disabled. Cashfree sandbox testing is a separate, owner-approved staging step.

**Release criteria:** explicit owner + independent editorial/security/accessibility approval, reviewed content and real staging QA. The report and this PR **cannot publish** either mock.

## Automated checks

~~~bash
npm ci
node --test test/staging-release-preflight.test.js
npm test
cd exam-practice-pro
npm ci
npm run build
~~~

Main CI baseline is green, but new branch checks must pass before a reviewer promotes the draft. The preflight uses fake clients in unit tests; CI must not connect to Neon or execute these migrations.

**Audit limitations:** no runtime Render/Vercel inspection, no real signed-in browser testing, no migration execution, no Neon backup/snapshot, no editing of production or staging records. Evidence is point-in-time and must be refreshed before release.
