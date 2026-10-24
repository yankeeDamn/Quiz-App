# ExamPro: low-cost Neon PostgreSQL setup

## 1. Create a disposable development database
1. Open https://console.neon.tech and create a project in a region reasonably close to the backend deployment region.
2. Create a separate database named `exampro_dev`. Keep production separate.
3. Copy the **Postgres connection string** from Neon; select a **direct** (non-pooled) connection for migrations. It should contain `sslmode=require`.
4. Never paste the URL into GitHub, chat, screenshots or frontend `NEXT_PUBLIC_*` variables.

## 2. Run the migration from Windows PowerShell
```powershell
git clone https://github.com/yankeeDamn/Quiz-App.git
cd Quiz-App
git fetch origin
git switch feat/pilot-institute-data-foundation
npm ci
Copy-Item .env.example .env -ErrorAction SilentlyContinue
notepad .env
```
Set `DATABASE_URL=postgresql://...` in `.env` (no quotation marks unless required by the parser). For the migration smoke test, in **the same PowerShell session**:
```powershell
$env:ALLOW_PILOT_MIGRATION_TEST = "yes"
node scripts/test-pilot-migration.js
Remove-Item Env:ALLOW_PILOT_MIGRATION_TEST
```
The test runs the migration **twice** and checks that tables and foreign keys exist. Run only against a **disposable development database**. Review the SQL first.

## 3. Confirm data exists
Use Neon's SQL editor to run:
```sql
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'pilot_%'
ORDER BY tablename;
```
Expected: institutes, memberships, banks, questions, batches, assignments, exams, attempts and subscriptions.

## 4. Important security and hosting notes
- Your existing Vercel deployment is a **Next.js frontend**; it does not deploy the root Express API automatically.
- Do not set `DATABASE_URL` in a public `NEXT_PUBLIC_*` environment variable.
- Before a public admin dashboard, deploy the Express backend with `DATABASE_URL`, `JWT_SECRET`, strict CORS and rate limits.
- Existing NextAuth includes a **guest credentials provider**. A guest session is **not** proof of institute ownership. Do not authorize question imports using a guest session or a client-supplied institute ID.
- Neon plan allowances and limits can change. Check current quotas and choose a free or low-cost plan with spending alerts. Backups and connection limits must be verified before production use.
- Payment integration is deliberately out of scope until secure tenant auth, grading and audit logs work.
