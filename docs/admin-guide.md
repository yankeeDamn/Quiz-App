# ExamPro modernization — admin guide (draft implementation)

This guide describes the stacked modernization branches, not a deployed release. Existing auth, pricing, mock score and ebook routes are retained. Do not enable new features on production until integration and acceptance checks pass.

## Admin shell and mocks
Open /admin, use the Overview, sidebar, Ctrl/Cmd+K and Create shortcuts. In Mocks, use the existing definition editor and publication checklist. In Question Bank, choose a topic, upload CSV/JSON, inspect parsed rows, validate, then import private draft questions. Review and publish only through existing approval controls. Direct XLSX, multi-answer grading, five-step wizard and deep-copy question bank are not implemented.

## Study plans
Open Study Plans, create an empty draft with a valid exam/syllabus and daily workload. Select eligible published resources and generate tasks; inspect weekly workload and empty or overloaded days. Existing readiness and student preview still apply. Scheduling is optional and requires explicit acknowledgement of the current revision. Use the history panel to cancel schedules. Published editions stay immutable.

## Independent draft library, courses, certification
Open /admin/content-pdfs, save a title/category, upload or replace one PDF (max 3 MiB), inspect the first-page preview. /admin/content-courses supports ordered modules and lesson drafts with text, links or content identifiers. /admin/content-certifications supports domain weight configuration and selection of existing independent PDF/course drafts. These are private draft workspaces only; student delivery, bulk publish, access entitlements, domain analytics and bundle publication are not implemented.

## Setup and rollback
Only on disposable or explicitly approved staging DB: apply scripts/migrate-publishing-workflow.js and scripts/migrate-independent-content.js from the final stacked branch. Flags PUBLISHING_WORKFLOW_ENABLED, NEXT_PUBLIC_PUBLISHING_WORKFLOW_ENABLED, INDEPENDENT_CONTENT_ENABLED, NEXT_PUBLIC_INDEPENDENT_CONTENT_ENABLED default off. No new dependencies. Disable flags and restart/rebuild to roll back; retain additive tables and audit history, then revert the relevant commits. Never drop existing content or new audit data.

## Acceptance gates
Run root npm test and frontend npm run lint, npm run build. Verify denied and switched accounts, authorizations, private draft isolation, schedule cancellation, competing worker instances, stale revisions, PDF invalid/encrypted uploads, module ordering and linked draft validation. Run accessibility scans in light/dark themes and mobile widths for each editor. Repeat existing mock attempts/results, study-plan progress and ebook permission/download workflows. No full end-to-end or accessibility pass has been recorded for these new PRs. Do not merge until required checks pass.
