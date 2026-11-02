# Recovery pages, analytics and optional error monitoring

## What is implemented

The Next.js App Router now supplies `not-found.tsx`, `error.tsx`, `global-error.tsx` and `loading.tsx`. The shared recovery screen uses the existing cards/buttons, gradients, language storage/switcher and footer. Its small recovery header works without auth/theme contexts, so the global boundary can recover a root-layout/provider crash. English, Hindi and Bangla copy, persisted/system dark mode, keyboard links, a loading status and reduced-motion styling are supported. Error screens render only a bounded Next.js digest, never the error message or stack. Both error boundaries offer Try again and Home, India mocks and Contact links.

Only three direct production packages are added: `@vercel/analytics`, `@sentry/nextjs` and `@sentry/node`. Sentry uses the current 10.x line to preserve the backend's supported Node 18 runtime (11.x requires newer Node). There are no new databases, paid plan changes, session-replay/profiling packages, cookies for analytics identity, source-map upload credentials or deployment changes.

## Configuration

| Variable                 | Where                          | Behavior                                                                                                                                        |
| ------------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SENTRY_DSN` | Frontend `.env.local` / Vercel | Optional public project DSN. Enables browser, server-component and edge monitoring. Blank disables initialization and the Sentry build wrapper. |
| `SENTRY_DSN`             | API `.env` / Render            | Optional API project DSN. Blank keeps startup and the existing error responses independent of Sentry.                                           |

Use a dedicated test project when verifying an actual Sentry account. DSNs route events and do not grant account administration; do not substitute a Sentry auth token. No auth token or source-map upload is required by this change. Minified production frame locations are available, but readable uploaded source maps are not configured.

Sentry initialization uses `tracesSampleRate: 0.1`, `sendDefaultPii: false`, and disables user/body collection. `beforeSend`, `beforeSendTransaction` and span filtering remove request bodies, cookies, headers, account identity, breadcrumb content, arbitrary app context and free-form error messages. Error types, limited stack-frame locations, SDK/version metadata and sanitized route-shaped timing data remain. Request URLs lose all parameters, credentials and fragments. Full exception details still follow the API's existing server logging behavior; this change filters Sentry transport and does not claim that infrastructure logs have been rewritten.

The existing Express error handler reports server failures (5xx), while its established status/body behavior remains intact. Next.js uses client/server/edge initialization and `onRequestError`; boundary effects report client/root errors. Monitoring initialization failures emit a generic console warning and leave the application usable; delivery/capture failures must not prevent an API response or a recovery action.

## Analytics and events

Enable Web Analytics for the intended Vercel project. The root layout mounts the automatic page-view component only in production, with debug logging disabled. Query strings/fragments are removed, private account/auth/admin/API pages are excluded and dynamic/unmatched paths are generalized. Custom events originating on an auth page retain only a generic activity URL, so successful sign-ins are not inadvertently dropped by page-view exclusions.

`lib/track.ts` is a no-op on the server and outside `NODE_ENV=production`. All producers go through a shared runtime policy, which rejects unknown event names and any property beyond the three flat catalogue keys. Unknown properties reject the entire event, including `email`, `name`, `question`, nested payloads, getters, non-enumerable keys and email/text values disguised as IDs. Delivery failures do not interrupt the user action.

| Event                    | Trigger                                                                                                                                                                                                                                                        | Allowed properties used |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `sign_in`                | Successful Auth.js callback lands on `/auth/complete`, authenticated session confirmed, then returns to the original safe same-origin destination. Guest sign-ins are included. Provider clicks, failed sign-in and ordinary session hydration do not emit it. | None                    |
| `mock_started`           | Scored/beta attempt creation confirmed by the server's additive `newlyCreated` flag; built-in practice mount/retake. Admin draft testing excluded.                                                                                                             | `test_id`               |
| `mock_completed`         | Successful scored/beta submission response or built-in practice completion. Retries/recovered attempts deduplicated within the browser tab.                                                                                                                    | `test_id`               |
| `pricing_viewed`         | Pricing page mounts; React effect replay guarded.                                                                                                                                                                                                              | None                    |
| `pro_requested_whatsapp` | Actual plan-selection WhatsApp link clicked, including Pro/institute plans.                                                                                                                                                                                    | `plan_name`             |

The additional permitted `exam_slug` key is available for catalogue producers. Names, emails, attempt IDs, user IDs, invitation codes, question text/answers, application references, WhatsApp message contents and payment details are not analytics properties. The existing WhatsApp message intentionally still contains the account details chosen by the user; the analytics hook records only the plan identifier.

Vercel's current custom-event reporting is Pro/Enterprise-only: <https://vercel.com/docs/analytics/custom-events>. This implementation does not purchase that entitlement. The backend's `NODE_ENV=production` is independent of Vercel's Preview/Production deployment labels; production-built previews can emit analytics when Web Analytics is enabled for that environment. Inspect the project's environment filter before interpreting beta traffic.

These are approximate aggregate activity counters, not unique-account first-time metrics, verified sales or an account-level seven-day retention cohort. A WhatsApp click is a request, not payment confirmation. Practice and scored attempts can be separated by test ID. Browser blocking, tab-local deduplication and network failures affect delivery. Keep the consented manual beta scorecard for individual first activity and seven-day follow-up; do not add an identity property to these events.

## Local and staging acceptance

1. With both DSNs blank, run `npm ci` and `npm test` at the repository root. Then run `npm ci` and `npm run build` inside `exam-practice-pro`. No migration is needed for this change.
2. Start the production frontend with a local-only `AUTH_SECRET`. Visit `/does-not-exist`. Expect the custom 404 and navigation links. Toggle EN/Hindi/Bangla and dark mode, check keyboard focus, and open Home/India mocks/Contact. Also check a narrow viewport. Development error overlays intentionally differ from production recovery UI.
3. In a disposable local checkout only, copy `test/fixtures/observability/client-page.tsx.fixture` to `exam-practice-pro/app/local-observability-test/page.tsx`. Copy the server fixture to `app/local-server-error-test/page.tsx`. Build/start locally. Click Force test crash on the client fixture; expect the friendly error screen, no sentinel text/email/cookie, and Try again returning to the fixture. The server fixture exercises a real Next.js digest and server-component capture. Remove both temporary app directories before deployment/rebuilding. Fixtures themselves are outside the app and cannot become public routes in this PR.
4. Set the frontend and API DSNs to a dedicated test project's DSNs locally. Rebuild the frontend because the public DSN is bundled. Trigger one local client crash and one server/API exception. Confirm receipt in the intended Sentry project; inspect raw event JSON for absent `user`, request `data`/cookies/headers, breadcrumbs and sensitive free text. Technical type/stack location should remain. Traces are sampled, so not every test request creates a transaction.
5. Run `node --test test/sentry-envelope.test.js` to verify the real Node SDK/error-handler path against a local Sentry-envelope collector. It asserts exactly one exception and no test email, cookie, body or question text. This automated collector is not evidence that a real Sentry organization has received an event.
6. After review/deployment and enabling Vercel Web Analytics, complete a sign-in, create/submit a mock, visit pricing and click a plan link. Verify only the five allowed names and catalogue properties. Recover an existing attempt and confirm it does not create another start. Confirm an admin draft does not contribute. Verify failed sign-in/submission does not report success.

## Privacy review

`app/privacy/page.tsx` now discloses aggregate page/activity analytics and optional error/performance monitoring, filtering, providers, measurement limits and absence of replay/advertising profiles. **The wording still needs legal review before public rollout**, including applicable notice/consent requirements, provider processing/retention and actual enabled environments. This PR supplies technical disclosures, not legal approval.

## Verification recorded for this implementation

- Root suite passes with DSNs blank: 221 tests, including no-DSN startup, event/property rejection, safe URLs, new-versus-recovered attempt metadata and real SDK envelope scrubbing.
- Frontend production build and targeted ESLint pass with no DSN. A separate production build with a local test DSN also passed.
- The real Next.js server-component path sent exactly one scrubbed exception to a local collector; the streamed response did not expose the test email, cookie or sentinel message.
- Browser preview verified the custom 404, English/Hindi/Bangla copy, dark mode, the client crash fallback, functional Try again recovery, and a digest-only server crash page. The test app routes and preview-only launcher/configuration were removed afterward.
- Receipt in a real Sentry organization and production Vercel custom-event reporting still require the owner's DSNs/project settings and current Vercel entitlement. Mobile viewport, root-provider-crash and real OAuth smoke checks remain staging acceptance checks; they are not claimed by the desktop browser checks above.
