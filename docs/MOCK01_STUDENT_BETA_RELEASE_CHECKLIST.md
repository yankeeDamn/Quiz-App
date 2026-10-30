# ExamPro Mock 01 — Student Beta and Final Release Checklist

This is a **manual signoff worksheet**. Completing automated checks or using Azure Hindi draft generation does not grant permission to publish or mark translations verified.

## Before beta

- [ ] Verify 100/100 academic reviews by qualified independent reviewers; check keys, source accuracy, explanations, duplicates and freshness.
- [ ] Verify 75/75 non-English-comprehension Hindi translations by a bilingual human reviewer. Azure drafts are suggestions, not approvals.
- [ ] Confirm publication-readiness report has no missing or stale records.
- [ ] Confirm all four draft source topics and Mock 01 remain **inactive/unpublished** during private QA.
- [ ] Confirm production database backup, least-privilege access and secret segregation; never copy staging credentials into production.

## Private staging beta (10–20 opt-in participants)

Use **only authorized staging accounts and a non-public test workflow**. The current unpublished Mock 01 runner is admin-only; do **not** send its private URL to ordinary students. Use an independently approved staging beta mechanism before involving non-admin accounts.

- [ ] Record participant consent and minimal feedback; avoid collecting exam answers, credentials or sensitive details in surveys.
- [ ] Test Android, desktop and narrow mobile widths including keyboard and screen-reader navigation.
- [ ] Switch EN → Hindi → Bangla and confirm text, four choices, English fallback and unchanged answer indices.
- [ ] Confirm first-time login, refresh/recovery, cross-device saved progress where supported, logout and unauthorized access behavior.
- [ ] Confirm four 15-minute section cutoffs, locked earlier sections and no edits to future sections.
- [ ] Separately verify server-approved 20-minute-per-section accommodation using a specifically authorized test account.
- [ ] Confirm final +2/-0.5 grading, 200 maximum, correct/incorrect/skipped counts, and explanations appearing only after submit.
- [ ] Capture crashes, timing drift, translation quality issues, broken navigation, accessibility blockers and beta feedback in private issue tracking.
- [ ] Retest every high-priority fix and run GitHub CI. Obtain written editorial, security/accessibility and owner signoffs.

## Publication gate

Publishing Mock 01 is a **separate future owner-authorized operation** after approvals and technical checks. This PR intentionally adds **no** beta-user provisioning, payment gateway, publishing action, topic activation, migration, or data mutation. No progress is inferred from this worksheet until a human actually records the evidence.
