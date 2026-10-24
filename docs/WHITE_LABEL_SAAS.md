# White-label SaaS implementation guide

## Domain setup
1. Purchase a domain and configure a wildcard DNS record (`*.yourdomain.in`) pointing to a hosting provider that supports wildcard certificates and routing.
2. Set `TENANT_BASE_DOMAIN=yourdomain.in` in the deployment configuration.
3. Resolve the hostname from the trusted web server request. Do not trust arbitrary forwarded-host headers from the public internet.
4. Match the subdomain against `institutes.slug` or a verified hostname in `institute_domains`. Never resolve an unverified custom domain.
5. Show tenant branding on the Next.js frontend, but authorize every API operation using authenticated institute membership in PostgreSQL.

## Database
Run `src/db/tenant-schema.sql` after `npm run db:migrate`. This schema is additive and is not yet wired to existing auth or exam controllers. Do not advertise full tenant isolation until those controllers are migrated and tested.

## Security
- Tenant IDs must come from verified membership and domain mapping, never directly from a browser-supplied tenant ID.
- Protect owner/admin billing and branding writes with role checks; audit changes.
- All institute-owned exams, batches, attempts and results require tenant-scoped queries and foreign keys.
- Never expose answer keys before result release; existing quiz submission endpoints accept client-supplied scores and must be redesigned before paid institute exams.
- Enforce subscription status and student limits server-side.
- Verify payment provider webhook signatures and handle repeated events idempotently.

## Suggested subscription model (illustrative)
Starter ₹999/month up to 100 students; Growth ₹2,499/month up to 500; Pro ₹4,999/month up to 2,000. Validate demand, gateway support, taxes, and unit economics before launch.
