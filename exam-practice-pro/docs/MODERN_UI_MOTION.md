# ExamPro modern UI & motion — Phase 1

This is a **frontend-only** visual enhancement. The Render Express API, Neon database, Auth.js OAuth, routes, exam timers, score calculations, server-scored attempts and local Studio preview storage are unchanged.

## Where the visuals live
- `app/globals.css` — reusable `ep-*` visual utility classes, hover/focus styling, and reduced-motion fallback.
- `components/motion/reveal.tsx` — light Framer Motion section reveals on public, non-critical content.
- `app/page.tsx` — homepage hero, exam-category cards, and content hierarchy.
- `app/exampro/page.tsx` — Studio landing visuals, sample OMR styling, and static information cards.
- `app/india-mocks/page.tsx` — catalogue card and filter presentation.
- `components/layout/header.tsx`, `components/layout/footer.tsx` — responsive navigation and consistent branding.
- `components/quiz/quiz-card.tsx`, `components/quiz/provider-card.tsx` — presentation and motion preferences only.

## Manual UI regression checklist
1. Open `/`, `/exampro`, `/india-mocks`, `/certifications`, `/dashboard`, `/admin`, `/institutes`, `/pricing`.
2. Test mobile widths 320, 375, 430px; tablet; desktop. Header items must remain accessible without horizontal scrolling.
3. Check light/dark themes and keyboard focus across all navigation and cards.
4. Set OS reduced motion: reveals and movement should disappear; no hidden content.
5. Test homepage search, subject/difficulty filters, provider selection and card links.
6. Check Studio OMR choose/try again; role tabs; filter published mocks; portal preset, logo, colours and fields; refresh to confirm the **same** localStorage preview.
7. Verify Google/GitHub login and owner/admin permissions on deployed preview with configured OAuth.
8. Test a timed student mock: select answers, autosave, refresh/resume, submit, review saved result; verify no server-side grading or deadline behavior changes.

## Build
```sh
cd exam-practice-pro
npm ci
npm run lint
npm run build
cd ..
npm test
```

Build and unit tests cannot verify real OAuth credentials, Render connectivity or production persistence. Do a preview deployment and authenticated smoke test before merge. No production secrets or configuration should be changed in this PR.
