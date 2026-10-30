# PR #61: Separate exam banks, certifications and Mock 02 audit

## Overlap validation
PR #60 contains the 100-question Mock 02 candidate bank and is unmerged. A comparison against the repository's 620 bundled question stems found one duplicate, which was replaced in PR #60. The 36 additional Railway/Banking/UPSC questions have no identical normalized stems against the 620 bundled items or the 100 Mock 02 candidates.

**Mock 01's full bank lives in Neon rather than a committed 100-question JSON dataset.** Therefore, a zero-overlap claim between Mock 01 and Mock 02 is NOT verified. Before any import, run the existing PR #59 read-only staging content preview with Mock 02 JSON, which checks every existing Neon question including inactive Mock 01. Also perform human review for semantic duplicates and near-paraphrases.

## Separate original packs
- Railway RRB: 12 original candidate questions.
- Banking IBPS: 12 original candidate questions.
- UPSC General Studies: 12 original candidate questions.
These are free, independent, practice-only ExamPro catalogue entries. They do not change the existing 125 Banking and 125 Railway seeded questions or any publication flags.

## IT certification starter updates
- AZ-900: 16 questions.
- AWS Cloud Practitioner CLF-C02: 16 questions.
- CompTIA A+: 16 questions.
- Google Cloud Digital Leader: 8 questions (new).
Total: 56 IT starter questions. All retain needs_review status; no automatic human signoff.

## Rollout checklist
1. Review original content, correct answers, explanations and vendor exam objectives independently.
2. Verify Rails/Banking/UPSC filters and all four IT certification practices on staging.
3. Compare Mock 02 candidate questions against the **actual staging Neon Mock 01** bank through the read-only content preview and revise any matches.
4. Do not copy competitors' question text. These references guided coverage only: https://open-exam-prep.com/practice/exams/technology/aws and https://practicetestgeeks.com/banking/.
5. The provided https://www.rrbapply.gov.in/#/auth/landing could not be retrieved in this review; official RRB notices remain authoritative.
6. Do not publish or activate draft content, change production data, or merge without authorization.

This PR adds bundled practice material and tests only; no database migration or production write.
