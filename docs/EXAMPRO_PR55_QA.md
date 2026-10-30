# PR #55 — Translation and SSC CGL Mock 01 regression evidence

Source and test changes only. All new automated tests use in-memory/fake records: no Azure, Neon, Render or Vercel resources are called.

## Automated checks

From repository root run: npm ci && npm test
From exam-practice-pro run: npm ci && npm run build
GitHub CI tests backend on Node 18, 20, 22 and builds frontend on Node 22.

- Hindi and Bangla routes authenticate with a verified signed-in token; guests are denied.
- Repeated Hindi translation requests are cached, while Bangla uses a different cache key.
- Partially malformed Azure responses do not leak cache entries from failed batches.
- Source exam questions, keys and scoring are independent of machine-translated display strings.
- The 100-question Mock 01 fixture has 4 ordered sections, 25 questions each, and 15-minute section timing.
- Private staging admin can start, resume, save and submit a draft. Anonymous and non-admin access fails.
- Draft answer keys and explanations stay hidden until submission; future and expired sections are locked.
- Late answers cannot change the saved, server-graded result. Public attempt routes cannot expose drafts.
- Existing suites separately verify 20-minute authorized accommodations, content approvals and publication gates.

## Staging-only manual acceptance (NOT performed in this PR)

1. Privately check Azure Translator key, endpoint and matching region in staging Render. Never commit secrets.
2. Switch between questions during Hindi draft generation: a late response must not overwrite the newly selected question.
3. Confirm six Hindi draft fields populate, without marking Hindi as verified or saving approvals.
4. During a private Mock 01 attempt switch EN/Hindi/Bangla; confirm text, choices, fallback warning, and preserved timers/responses.
5. Refresh, resume answers, check section locks and independently authorized 20-minute timing.
6. Submit and verify a 200-mark result; verify draft remains private.
7. Confirm Mock 01 and all four source topics are still unpublished/inactive.

## Publication hold

Do not publish until 100/100 academic reviews, 75/75 human-verified Hindi reviews, independent security/accessibility QA and explicit owner signoff. No database migration, deployment, payment integration or publication action is authorized by PR #55.
