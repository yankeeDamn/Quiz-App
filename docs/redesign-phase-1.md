# Phase 1 — shared design system

## Scope and approved decisions

New Courses and PDFs will have independent publishing in later phases. Existing ebook URLs, permissions, access policies and progress remain unchanged. The owner approved publishing the Phase 0 audit; it is draft PR #115. This phase changes presentation and adds a component preview; it does not implement a new publishing backend.

## Changes

- `exam-practice-pro/app/globals.css` centralizes the supplied black/cold-yellow palette, light palette, accessible text/status variants, semantic component aliases, border/radius/transition rules and reduced-motion behavior. Large surfaces are charcoal/off-white; primary controls use yellow with black lettering. Light-theme accent text uses dark olive to preserve contrast. Control boundaries and focus rings remain visible in both themes.
- Existing admin and student screens replace hard-coded brand/neutral colors with shared tokens. Existing result/status colors and tenant-provided branding remain meaningful. Charts use semantic tokens; print styles keep readable paper output.
- Root layout uses the existing `next/font` mechanism for Space Grotesk, Inter, JetBrains Mono and the existing Indic fonts. No new npm dependency. Initial theme is dark; the existing Light/Dark/System menu persists choice and System follows device changes.
- Existing button, card, form, switch, tabs and loading components are extended. Shared status pill, table, breadcrumbs, stepper, skeleton, empty state, toast/undo action slot, PDF file selector, markdown wrapper and keyboard command palette are added.
- `/admin/design-system` uses the same `/admin/me` authorization check, has no-index metadata, contains only synthetic examples and issues no content mutations. Its sample editor reuses the student markdown renderer. It demonstrates both themes, sorting, density, selection, file validation, dialogs/drawers and keyboard focus.
- No old screen or endpoint is removed. The design-system link appears in the existing admin-only navigation.

## Database, dependencies and flags

No migrations, schema changes, new application environment variables or new npm libraries. Next.js and eslint-config-next are patched together from 16.4.3 to 16.4.6 in a separate prerequisite commit, resolving the installed framework security interruption without changing architecture. No feature flag is needed for a token-only presentation change; later publishing/wizard/scheduling flags remain planned and disabled by absence. The browser test accepts optional local tool-path variables; these are not deployment configuration. No actual upload, schedule, publish, payment or access change occurs in the component gallery.

## Verification

- Existing backend tests plus new AA token-contrast/PDF-selection unit tests: 328 passed, 0 failed. Production build passes on Next.js 16.4.6; new/extended component targeted ESLint passes.
- `scripts/phase1-theme.browser.cjs` starts a local Next server, mocks auth/API requests with synthetic fixtures and blocks external browser requests. It checks dark default, persistence, OS preference, sorting, filtered selection, Undo, command search, modal focus, drawer close, file validation, reduced motion, mobile overflow, admin denial/sign-out and no backend mutations. All these fixture checks pass. Axe reports zero A/AA violations in all eight scans: desktop/mobile design system, admin and student home, each in both themes. This is frontend fixture coverage, not authenticated production acceptance.
- Full frontend lint still has pre-existing failures from the audited base. No lint rules have been disabled. The empty textarea interface was corrected; all new Phase 1 components must lint clean. Do not describe repository-wide lint as passing until baseline remediation is complete.
- The compatible Next.js patch is validated with the same build and browser checks. Reduced-motion entry effects use consistent server/client initial markup to avoid hydration errors.

## Manual check (local or approved staging)

1. Sign in as an authorized admin and open `/admin/design-system`; a regular or signed-out account must not see the component gallery.
2. Select Light, Dark and System; reload and change your OS appearance while System is selected. Check `/`, `/india-mocks`, a quiz/result, a study plan and an ebook reader.
3. Use only the keyboard: Tab through controls, open search with Ctrl/Cmd+K, close a dialog with Escape and verify focus returns to the opener.
4. Sort/select/filter the sample table, use Undo, try a valid PDF and an invalid/oversized file, and check the 390px layout. Gallery actions must not create content.
5. Repeat a real existing mock attempt, plan completion and authorized PDF download in approved staging; compare results/access with the previous release. No deployment or content publication is included here.

## Screen descriptions and rollback

Dark: black canvas, charcoal bordered cards, lemon-yellow primary controls, yellow metric emphasis, muted grey labels. Light: off-white canvas, white/soft-grey cards, black text, the same yellow controls and dark readable accent text. The component gallery has color/type samples, forms, status badges, navigation/progress, a selectable content table, PDF selection and markdown preview. Existing mocks/plans/ebooks retain their layouts in this phase; the new shell and builders belong to subsequent phases.

Rollback: revert the Phase 1 commit and rebuild the frontend. There is no database rollback and no stored content conversion. Existing light/dark/system preferences remain compatible. Production rollout and merge still require explicit approval.
