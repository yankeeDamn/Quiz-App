# SSC CGL 2026 Tier-I: section timer implementation and QA

**Scope:** backend/API and scored exam UI support only. This change does **not** create 10 original 100-question mocks, publish content, alter existing attempts, or approve scribe accommodations.

The official 2026 SSC notice §13.8 introduces four 15-minute sections for standard candidates. Each section contains 25 questions, with +2 for correct and -0.5 for wrong answers. For candidates eligible for a scribe the notice specifies 20 minutes per section; an explicit accommodation flow, securely administered and represented in the immutable attempt snapshot, remains a **separate pre-launch requirement**. Do not use standard-only mocks as a substitute for officially accommodated sessions.

## Feature gate

A mock gains `sectionTimingMinutes:15` at server-side attempt creation **only** if:

- It is an SSC CGL full mock, not a topic quiz or mini-mock.
- It has exactly 100 unique questions, 4 named sections in the official sequence, each with 25 questions and matching question section indices.
- It has exactly 60 minutes and the correct +2/-0.5 marking.
- The attempt snapshot is produced by the backend (never by a browser query parameter).

All current incomplete SSC CGL mini-mocks, IT certification tests, other exams and previously created attempts preserve their original single overall timer behavior. No DB migration or data backfill.

## Security invariants

- Server starts timed sessions from PostgreSQL `started_at` and uses server wall clock for deterministic 15-minute section boundaries; the cutoff at exactly 15:00 closes section 1.
- Saving responses may add/change/delete choices in the **currently open section only**. Previously saved choices in expired sections are immutable; any attempted edits are rejected with HTTP 409; future section answers are rejected. Missing locked answers in a stale tab do not erase saved answers.
- After 60 minutes only previously persisted answers are graded, not answers supplied after expiry. Idempotent subsequent submission returns the original result.
- UI reflects active section, restricts navigation and shows the 15-minute remaining clock. UI restrictions do not replace API validation.
- Because network latency can race the boundary, students should ensure the saved indicator appears before the last second. Timed submitted answers are authoritative only after backend acknowledges receipt.
- Existing user entitlements, billing, admin authorization and answer-key protections are unchanged.

## Release steps

1. Run `npm test` on Node 18, 20 and 22. Run `cd exam-practice-pro && npm ci && npm run build`.
2. Verify tests for exact time boundaries, malicious past-section edits, future-section edits, reload recovery and skipped/incorrect scoring.
3. Create one **original, independently reviewed** full mock through owner admin as **draft**. Check whether section eligibility activates before publishing. Keep other drafts inactive.
4. Use a test account and an isolated staging database to exercise a 60-minute session (or controlled fake clocks). Do not manipulate production attempt timestamps.
5. Verify accessible section transitions and a dedicated scribe/accommodation experience before calling it an accurate official SSC mock.
6. Merge only with owner review; manually deploy backend to Render, verify Vercel Production main SHA, and test actual browser workflow. CI passing is not production confirmation.

Release stays blocked until ten original mocks are reviewed/published and the accommodated timing path is considered.
