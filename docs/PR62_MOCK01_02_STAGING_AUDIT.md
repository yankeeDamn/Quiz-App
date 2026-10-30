# PR #62 — Staging Mock 01 vs Mock 02 Audit

This report is **read-only** and operates only behind the existing isolated staging feature gate plus a verified human Admin account. The endpoint is GET `/api/v1/admin/mock01-02/audit`; the panel is in Admin → Tests.

## Audit evidence
- Reads both mocks' configured questions and saved academic/Hindi review statuses from staging Neon.
- Compares normalized stems for exact duplicates, and flags token-Jaccard similarity >= 0.72 for possible near-duplicates. This is a heuristic, **not semantic embedding similarity**; paraphrases can be missed and unrelated questions can be flagged. A human reviewer must inspect the flagged pairs and the remaining bank.
- Reports question totals, missing or too-short explanations, invalid answer indices/options, stale human reviews, academic approvals and human-verified Hindi counts.
- Verifies four ordered sections with 25 questions each, 60-minute duration and +2/-0.5 marking, then reuses the existing publication readiness rules.
- Report never authorizes publication, modifies reviews, activates topics or imports content. The API reveals only question IDs for matches, not stems or answer keys.

## Staging acceptance
1. Deploy audited code to isolated staging only. Confirm Render points to **staging Neon** and CORS allows only the staging Vercel origin.
2. Sign in with an allowlisted Google/GitHub Admin account; open Admin → Tests → Mock 01 vs Mock 02 QA audit.
3. Mock 02 must first exist as an **inactive** staging draft or the report returns an unavailable/mock missing error; the source JSON merged in PR #60 does not import itself.
4. Review all exact and possible near-duplicate flags; compare against actual question content through the authenticated review screen. Correct duplicates in a separate authorized content change, then repeat audit.
5. Record 100/100 independent academic approvals and 75/75 human Hindi verifications per mock; review stale source changes.
6. Confirm official exam structure, 60-minute standard timing, 80-minute authorized accommodations, answer persistence and scoring via separate private exam regression/manual QA.
7. Confirm no one grants publication authority from a green report. Approval and publication remain separate owner-controlled procedures.

**Not performed:** No live staging Neon query has been executed, no human source accuracy review has been completed, and neither mock has been published as a result of this PR.
