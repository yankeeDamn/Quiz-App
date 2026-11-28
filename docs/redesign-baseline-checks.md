# Modernization baseline repair

This prerequisite is separate from the theme and new publishing features. The audited frontend failed lint with 42 errors; after Phase 1 there were 41. These errors are now resolved without disabling rules or changing API/DB contracts.

## Changes

- Browser-only bookmark, dashboard, question-note, draft-form, streak and flashcard state initializes after hydration instead of synchronous effect writes. User-specific controls wait for the storage prefix and reset on account changes. Storage key formats are unchanged.
- Quiz option shuffling initializes once per attempt; existing question order, scoring, persisted session and timer pause/resume semantics are retained. Review filters reset their index in the selection event. Resume availability is derived from the existing session.
- Institute and application-tracker data resets before a changed account/resource renders. Existing permission checks, cancelled requests and revision requirements remain in place. Review form inputs reset when their source changes.
- Network completion callbacks own fetched state. Translation still uses the existing endpoints; private exam translations remain in memory only. Ad expiration is sampled by a clock outside rendering.
- Corrected JSX apostrophes and two immutable variable declarations. No eslint rules disabled, new libraries, environment variables, migrations or production changes.

## Checks

- `npm test` at repository root: 328 passed, 0 failed.
- `npm run lint` in `exam-practice-pro`: exit 0, 0 errors, 32 existing warnings.
- Frontend production build and TypeScript pass on Next.js 16.4.6.
- `THEME_TEST_BASELINE=1 node scripts/phase1-theme.browser.cjs` (with optional local tool paths described in the script): passes all theme/axe checks and additional local fixture regression for account-separated bookmarks, dashboard hydration, quiz start, timer pause/resume, advancing questions, flashcard answer/rating and advertisement draft form. Eight accessibility scans have zero A/AA violations. No real service writes occur.
- These local fixtures do not replace authenticated staging acceptance for private institute billing, reviewer sign-off, translations or live student accounts. Existing backend regression tests remain green.

## Manual checks

1. In local/approved staging, open bookmarks and dashboard, switch accounts, and verify the previous account's local records do not appear.
2. Start a practice quiz with shuffled answers, pause/resume the timer, advance a question, and confirm scoring/results match the previous release.
3. Open a question note then switch questions; the previous question's note must not appear in an empty note editor. Check flashcards and daily challenge resume.
4. As an authorized institute user, switch institute and section; confirm private records clear while the new scope loads. As owner, change a mock review entry and check its form values.
5. Run build, lint and unit tests. Rollback is reverting this prerequisite commit; no data migration or stored-key conversion is needed.
