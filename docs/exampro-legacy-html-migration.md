# ExamPro legacy HTML migration — Phase 1

Source: user-supplied \`Exampro.html\` (standalone browser application).

## What this PR adds

- \`/exampro\` is now a native Next.js **ExamPro Studio** page instead of redirecting to \`/india-mocks\`.
- Restores the original “A little practice. A stronger attempt.” landing flow and OMR bubble sample with a worked explanation.
- Role-based getting-started walkthrough for students, owner/teacher and coaching institutes.
- Live mock catalogue loaded from the existing Render API; cards link to native secured practice routes, **not** a second HTML grading engine.
- Portal Builder preview: preset templates (SSC academy, Bank exam academy, School foundation); institute name/tagline; colour picker; PNG/JPG/WebP logo (maximum 500 KB); batches; counselor WhatsApp and validated discussion-group URL; responsive preview.
- Portal settings are restricted to browser \`localStorage\`. No student records, passwords, payments or private tenant data are written to a server.
- WhatsApp enquiry links; progress, certifications, questions, owner admin and institute preview links.
- Navigation updates and refreshed \`/institutes\` overview.

## Not in this PR (avoid false claims)

The provided HTML explicitly says that shared institute portals and student management are **planned**. This PR does **not** create organization accounts, tenant-scoped data, private batch student lists, institute-specific domains, signed certificates or subscriptions.

The source HTML also references a separate \`public-quizzes.js\` asset that was not included in the uploaded HTML file. Do not assume its teacher-publishing/public guest-resume implementation is portable from that single file. ExamPro's existing owner-only publishing and server-scored attempts remain the source of truth.

The existing Google OAuth \`401 invalid_client\` is a Google Cloud / Vercel credentials issue and this PR does not silently work around it.

## Verification after PR checks

1. Run \`cd exam-practice-pro && npm ci && npm run build\`.
2. Open \`/exampro\`; try OMR answers and “Try again”.
3. Change the role tab and inspect each walkthrough.
4. Verify the catalogue loads when Render API is healthy; open an actual mock and return.
5. Try each portal preset, rename the institute, change branding, upload a valid <=500 KB image, add batches.
6. Refresh: settings should still be present on that browser. Reset should clear preview data. Open another device/browser: no shared settings should appear.
7. Try malformed group invite links: the join button must not appear. For a valid \`https://chat.whatsapp.com/...\` invite, the link should open in a new tab.
8. Test a 501 KB logo (rejected), a nonimage file (rejected), and a normal JPG (previewed). Test on mobile and dark mode.
9. Verify \`/india-mocks\`, \`/admin\`, \`/dashboard\` and \`/institutes\` still load.
10. Confirm public portal demo does **not** imply it can manage real students or bypass owner permissions.

## Next recommended PRs

- **Institute core**: PostgreSQL organizations, verified-membership and isolated roles, organization-scoped question banks/exams/attempts, invite and batch workflows; migration and API authorization tests.
- **Published tenant portal**: logo storage, domain/slug ownership, tenant brand/theme applied to student routes and signed result/certificate delivery.
- **Student tools**: custom topic practice, daily/streak views, reliable cross-device bookmark/review flows.
- **Commercial**: audited institute subscriptions and payment webhooks with verified payment state.
