# ExamPro portal copy and real share link — 27 October 2026

## Why the text did not change after earlier merges

`exampro/index.html` is a historical standalone HTML artifact. Vercel serves
`exam-practice-pro/app/exampro/page.tsx` at `/exampro`. Updating the
historical source alone **does not change** the production website.

A failed **Preview** deployment of feature branch `2c60f5...` from PR #41 is
also not the same as a failed **Production** build of main. GitHub CI passed
PR #41 before it merged into `781f001`. The Vercel status for that merged
commit linked to a build-rate-limit page, which must be handled in Vercel's
production deployment settings.

## This change

1. Replaces the five obsolete demo/browser-only headline and notice strings in
   historical `exampro/index.html`, plus other text that wrongly implied
   fully operating multi-tenant institute accounts.
2. Replaces fictitious `<slug>.exampro.example` in the old builder with a
   **clickable real ExamPro URL**:
   `https://quiz-app-virid-zeta-41.vercel.app/exampro?institute=<slug>&brand=<public-json>`.
   It encodes only name, tagline, colour and batch labels; never phone, logos,
   invite links, student data or login tokens.
3. Makes the same `?institute=<slug>` URL in the Next.js `/exampro`
   application redirect to `/exampro/portal?institute=<slug>`, preserving the
   optional public branding payload. The portal uses the slug as a readable
   name when no brand object is provided, and loads published mock links from
   the live Render/Neon catalogue.
4. Updates the **actual Next.js portal builder** address bar to display
   `quiz-app-virid-zeta-41.vercel.app/exampro?institute=<slug>` with a link
   to the full functioning share URL.
5. Improves editor feedback so 'Saved only in this browser' is not shown after
   each keypress. The browser still stores editor preferences on the local
   device; this work **does not** create a private institute, student account,
   persistent branding record or a new sign-in method.

## Verification after merge

- Ensure Vercel **Production** deployment built the latest main SHA and is
  Ready. Preview branch deployments do not update the public domain.
- Check Vercel Settings → General root directory is `exam-practice-pro`,
  Next.js framework, `NEXT_PUBLIC_API_URL` points at the live Render API, and
  Production Domains points to the new Ready deployment.
- Visit `/status` and confirm the deployed commit and API readiness.
- Open `/exampro`, type institute name 'Example Academy', click 'Open public
  portal', copy the link, and open it in a private mobile tab. It should land
  on `/exampro/portal?institute=example-academy&brand=...` with the entered
  colour, tagline and batches and **live, published mock links**.
- Test `/exampro?institute=example-academy` without a brand argument. It
  should display 'Example Academy' with default styling; this does not verify
  an institute or grant access.
- Confirm private/mock Pro content still requires the existing sign-in and
  entitlement checks. Unpublished drafts must never be exposed.
- Test Android Chrome/Brave Copy and WhatsApp buttons.

## Still pending

Real private institute accounts, memberships, batch-specific student reports,
database-saved branding and custom domains require a separate backend
milestone. Cashfree is deferred until merchant onboarding is ready.
Translation of question text still requires configured Azure AI Translator;
localised UI labels alone do not translate the source question bank.
