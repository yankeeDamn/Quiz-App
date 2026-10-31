# Admin workspace and government jobs rollout

## Changes

Navigation labels on desktop and mobile now read **Home**, **Build your IT career**, and **Govt Mocks Exam**, with corresponding Hindi and Bengali labels. The footer uses the same English names. Destinations remain `/`, `/certifications`, and `/india-mocks`.

The owner dashboard at `/admin` now opens on an overview with protected question/topic/test counts, a draft publishing queue, workflow shortcuts, and public jobs-source diagnostics. Desktop uses a sidebar; smaller screens use a horizontally scrollable section menu. Question, mock-test, practice-library and plan/payment editing flows remain available. Shared admin fields, cards, table spacing and focus states have been updated. The overview makes read-only calls and does not publish anything.

Admin data is mounted only after `/api/v1/admin/me` authorizes the current account. Pending checks are cancelled on account changes; the previous account's authorization cannot keep the workspace visible for a new email. Existing server-side authorization and financial grant confirmations remain required.

## Observed live jobs failure (31 October 2026)

- The Vercel `/government-jobs` page is deployed.
- `GET https://quiz-app-regd.onrender.com/api/v1/government-jobs` returned **HTTP 404**, with `{"success":false,"error":{"message":"Resource not found"}}`.
- That route exists in merged `main` at `d4e6617a5b986e4702de4a0534a99a9b2dcdd3d6`. This indicates a deployment/configuration mismatch on the tested Render endpoint; a frontend deployment alone cannot add the backend route. The exact running Render commit was not inspected.
- The official Employment News table fetched successfully, but its current rows have expired deadlines (the latest observed deadline was 30 October). Those rows must not appear as open jobs.
- The issue-date column claims MM/DD/YYYY, but rows also contain day-first values such as `31/08/2026`. Ambiguous issue dates are now omitted instead of guessed; validated DD/MM deadlines decide whether an opening is still listed.
- Both the official UPSC calendar and homepage returned **HTTP 503** in direct checks. This is an upstream availability failure and may persist after deployment. Source access from Render must be checked independently.

## Feed behavior

- Healthy Employment News tables containing only expired rows are now a successful empty result, rather than a false source failure.
- Source status reports a safe failure reason, last attempt, and last successful check. The page distinguishes missing API routes, upstream failure, no verified open listings, and filtered-out results.
- UPSC extraction starts at the actual Forthcoming Examinations heading, so a matching navigation-menu label cannot divert parsing. A pinned official-homepage fallback is used if the calendar fails.
- Source requests are deduplicated, checked on visits after 30 minutes, and retried after a five-minute failure cooldown. A visible browser tab refreshes every 15 minutes. This is traffic-driven refresh; no scheduled background service was created.
- Stale data expires after six hours. Application deadlines are filtered again using India time on each API read. Redirects are validated before their destinations are contacted; page size and timeout limits remain enforced.
- Automatic indexing still covers Employment News and UPSC. SSC, Banking and Railways have official portal links, not complete automatic feeds. No opening, deadline or application URL is invented.

## Deployment and acceptance

1. Review the PR, required checks and staging UI before merging.
2. After approval/merge, deploy the merged `main` to **both** Vercel and the existing Render API. On Render use **Manual Deploy → Deploy latest commit** if automatic deployment did not run. Keep the existing API, Neon database and production configuration.
3. Verify `GET /api/v1/government-jobs` returns HTTP 200 with `success: true`, `data.sources`, `data.jobs` and `data.portals`. A source may still be unavailable even though the API works; inspect its message rather than assuming a new deployment can fix a government website.
4. Confirm Vercel's `NEXT_PUBLIC_API_URL` points to the intended existing API and redeploy Vercel if that value changed.
5. Visit `/admin` as the authorized owner. Check Overview, Question bank, Mock tests, Practice library and Plans & payments. Verify real counts, loading/error states, keyboard focus, table scrolling, dark mode and 390/1024/1536px layouts.
6. Verify an anonymous or unauthorized account cannot load protected content; account changes must remove the preceding account's admin view.
7. Visit `/government-jobs`, inspect both source statuses, test filters/reset and official links, and verify expired notices are hidden. If UPSC is still returning 503, the page must say so instead of showing invented notices.

## Validation performed

- All **182** backend tests passed locally, including existing admin authorization/payment/publication checks and new jobs cache, empty-feed, fallback, date, stale-data, concurrency, redirect and size-limit regressions.
- Next.js production build and TypeScript checks passed.
- `git diff --check` passed.
- Browser visual QA could not run: the managed preview launcher appended `--host ... --strictPort` to `next dev`, which Next.js rejects. No app startup script was changed to compensate. Manual staging review remains necessary.
- No migrations, production database writes, plan grants, mock publication, paid infrastructure changes or production deployments were performed.
