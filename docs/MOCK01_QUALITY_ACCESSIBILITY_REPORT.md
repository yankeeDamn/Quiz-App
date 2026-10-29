# SSC CGL 2026 Mock 01 — Human Quality, Hindi and Accessibility Release Report

**Status: HOLD — NOT AUTHORISED TO PUBLISH.**

This report accompanies the review tooling PR. It is **not** a record of human question sign-off. The last verified staging inventory had **100 original questions in four inactive topics** and an **unpublished 60-minute Mock 01**. The repository includes an AI desk audit (`content/ssc-cgl-2026/mock-01/QUALITY_AUDIT.md`), not independent teacher approval.

## Authoritative format

SSC Combined Graduate Level Examination 2026 official notice, [§13.8 and §13.8.1](https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_cgl_2026.pdf), page 25, states:

- **Four sections × 25 questions**, **50 marks each**, with **−0.50** per wrong answer.
- **Standard candidates:** 15 minutes per section (60 minutes).
- **Candidates eligible for compensatory time:** 20 minutes per section (80 minutes); eligibility is governed by §§7.1–7.3 and 7.9–7.10 of the notice, not by a user's self-selection.
- Questions are to be set in **English and Hindi except English Comprehension** (75 questions in Mock 01 require Hindi review).

This platform is an independent practice app; it must not imply SSC endorsement, official accessibility certification or clinically verified disability eligibility.

## Review workflow added in this PR

1. **Admin → Mock tests → Review questions** lists every configured question in its canonical order, answer option, explanation and per-item approval state.
2. For each question, a signed-in human reviewer in `ADMIN_EMAILS` may record **Pending / Changes required / Approved**, their reviewer identity and supporting notes. API keys alone **cannot** record approval.
3. Reasoning, General Awareness and Quantitative Aptitude also require entered, proofread Hindi question/options/explanation and a separate **Verified** state. English Comprehension is exempt.
4. An immutable **SHA-256 hash** of English source text/options/key/explanation/difficulty invalidates approvals if the canonical content changes.
5. Only verified, still-matching Hindi text is eligible to appear in newly started scored attempts. Unverified machine translations remain explicitly advisory and are **not** a substitute for signed Hindi quality review.
6. Full SSC CGL mock publication is blocked by the backend until all selected questions are academically approved and all required Hindi translations verified, in addition to the existing public-active bank and complete-section gates.

### Actual approval status at PR creation

| Criterion | Verified status |
| --- | --- |
| Original 100-question English draft | Exists in staging |
| AI desk audit | Complete but not independent human review |
| Human academic approvals | **0/100 initially** (new table is empty after migration) |
| Human-verified Hindi translations | **0/75 initially** |
| English comprehension Hindi exemption | 25 questions |
| Standard 15-minute timer | Observed working |
| Approved 20-minute timer | Added in code with automated boundary tests; **manual accessibility QA pending** |
| Keyboard, focus and timer ARIA | Added in code; **screen reader and keyboard manual QA pending** |
| Publication approval | **NOT GRANTED** |

## Accommodation safety

- An administrator must independently verify eligibility and then approve an **existing signed-in user's email** in the review panel. Eligibility documents/medical evidence are **not uploaded** or stored.
- Approved users receive a frozen **20-minute × 4** server-side snapshot and **80-minute** deadline on **new** SSC CGL qualifying attempts. The user cannot choose the mode in the request body or URL.
- Unapproved users remain at **15-minute × 4 / 60 minutes**. The existing attempt's saved snapshot is authoritative: later grants/revocations never retroactively change a running attempt.
- Server-side section locks guard against changing past answers and answering future sections at the 20/40/60/80-minute boundaries.
- Grant/withdraw endpoints are staging-only and require verified OAuth admin status, not the `ADMIN_API_KEY`.
- A real assisted-technology and eligible-user usability review remains mandatory.

## Stage rollout, only after PR review and owner approval

1. Merge PR only after Node 18/20/22 backend tests and Next.js build are green.
2. On **staging Neon only**, after reviewing DB backup/branch selection, run the repo's **idempotent** `npm run db:migrate` using the staging `DATABASE_URL`. It creates only additive `mock_question_reviews` and `exam_time_accommodations` tables. Do **not** run against production without a separately approved deployment plan.
3. Deploy new main SHA to **staging Render** and staging Vercel; keep `EXAMPRO_ENV=staging`, `ENABLE_ADMIN_DRAFT_TESTS=true`, staging-only CORS and separate OAuth secrets.
4. Verify a reviewer can record a test review (or changes requested), without marking any real question approved merely to test functionality; test a harmless dummy on isolated database if needed.
5. Verify a normal user gets 15-minute sections; grant authorized 20-minute profile only after offline eligibility confirmation. Start new QA attempt and confirm 20-minute display, 80-minute stored deadline and section locks.
6. Verify keyboard-only navigation, heading focus, skip link, screen reader sections and low-vision contrast with real assistive technology; fix failures before release.
7. Independent SSC reviewers work through **100 academic checks** and **75 Hindi checks** (including grammar, key, full options and explanations). Reviewer names must be verifiable and any independence/conflict-of-interest issues resolved outside the app.
8. Only then consider a separately approved production import / publication. Retain a backup and rollback path.

## Known limitations and deferred work

- User-facing non-English translations use an optional external translator for **unverified** questions; these are not quality-assured exam equivalents. Author-approved Hindi is preferred when available. A live candidate should not be offered an unreviewed Hindi official-pattern exam.
- Admin review allows authorized reviewer signoff but does **not** cryptographically prove independent authorship or provide legal/accommodation eligibility certification; document reviewer accountability separately.
- A new academic edit requires review again; review annotations do not automatically correct question content.
- Mobile/keyboard/screen-reader manual testing remains required; automated tests do not equal WCAG certification.
- The existing AI desk audit notes syllabus-coverage gaps (non-verbal figures, 2026 current affairs, graph DI, longer English passages).
- The staged release checklist `docs/MOCK01_PRODUCTION_RELEASE_CHECKLIST.md` still applies.

## Rollback

Turn off `ENABLE_ADMIN_DRAFT_TESTS` on staging Render to disable private draft attempts. Keep Mock 01 and all topics inactive. Do not delete review or accommodation tables without a separately reviewed migration; they contain audit state but **no medical evidence**.
