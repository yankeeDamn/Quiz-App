# PR #66 — Government Jobs & Upcoming Exams

## Goal
Add an accessible public **Govt Jobs** tab to ExamPro desktop/mobile navigation, using official Indian recruitment websites rather than republished social posts. New page: `/government-jobs`. Read-only API: `GET /api/v1/government-jobs`.

## Current source coverage
- **Employment News, Ministry of Information & Broadcasting:** `https://employmentnews.gov.in/newemp/AllJobs.aspx?k=All`. Read organisation, post title, appointment type, issue date and last date from the official table. Only records with validated dates and an **unexpired** deadline are displayed.
- **UPSC Forthcoming Examinations:** `https://cms.upsc.gov.in/examination-calendar/`. Clearly labels these entries `upcoming`, with **no deadline** until the issuing authority announces one.
- **Official recruitment directory:** SSC, UPSC, National Career Service, IBPS, Railway Recruitment Boards and Employment News. These are direct authority links, not automatically indexed open applications.
- Official source references: https://employmentnews.gov.in/newemp/AllJobs.aspx?k=All ; https://cms.upsc.gov.in/examination-calendar/ ; https://ssc.gov.in/ ; https://www.ibps.in/ ; https://www.rrbcdg.gov.in/employment-notices.php ; https://ncs.gov.in/

## Automatic refresh, accuracy and reliability
- On a visit, the backend checks sources when the per-source cache is older than **30 minutes**. A page left open checks again every **15 minutes** and when it becomes visible.
- Each upstream request is **HTTPS**, pinned to an official domain, limited to 1 MiB and 8 seconds. No user-controlled target URLs, no API keys, no scrape-from-Google or third-party job posts.
- Source failures are throttled for five minutes. Old results are shown only up to six hours and explicitly marked **stale**; after that, unverified notices disappear and the official-directory links remain.
- Current India time is used to exclude closed deadlines every time the API is called (including when cached entries are read). Unsupported/malformed/ambiguous dates are **not** guessed.
- Display a source's last successful check timestamp, not a fictitious publication timestamp. Source empty or parsing failures are not represented as 'no jobs exist'.
- Only official SOURCE links are displayed, not a fabricated employer application URL. Users must confirm full notification, fees, location, official application page and final deadlines before applying.
- API is public and free to read; there is no sign-in requirement or Pro paywall.

## Explicit limitations
No aggregator can guarantee instant or complete government job coverage. Government publishers can update notices later than the configured refresh interval, block automation, alter HTML, revise deadlines or withdraw postings. Do **not** market this as 'every government job' or an official application service. This PR introduces a best-effort live index with honest source health, not automated subscriptions, email alerts, privileged scraping, or calendar guarantees. Employment News may list only closed vacancies on a given day; in that case the open jobs list will be empty and official source links still work.

## Staging verification
1. Deploy branch to staging Render + Vercel. Confirm `/api/v1/government-jobs` returns valid `sources`, `jobs`, `portals` and `updatedAt`.
2. Visit `/government-jobs` on mobile and desktop; verify nav, filters, search and external official links.
3. Check Employment News rows against published official posts and deadline dates. Verify no expired posting is shown and that `Apply` is not falsely claimed for source-index links.
4. Check UPSC forthcoming entries; dates should remain "not announced" unless the authoritative source itself publishes them.
5. Temporarily simulate upstream failure / blocked page. Verify stale label or unavailable notice is visible, no fake jobs are fabricated and official directory remains usable.
6. Check source status again after refresh TTL; verify Render logs contain no user secrets.
7. Review source terms and rate limits before further expansion. No DB migration or modifications to cashfree, plan entitlements, exam marks or unpublished mocks.

## Future enhancement
Add more agency-specific parsers only after reviewing the agency's documented data usage rules and real HTML, plus automated source-change detection in CI. Opt-in job alerts require separate consent and subscriber preferences; out of scope here.
