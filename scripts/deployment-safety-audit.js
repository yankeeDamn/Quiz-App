'use strict';

/**
 * Read-only static deployment-safety audit.
 *
 * Complements scripts/staging-release-preflight.js (which audits the live
 * staging database). This script audits the *source tree* only: it never
 * opens a database connection, never calls a network endpoint and never
 * writes files. Critical findings exit non-zero so CI can fail closed on
 * safety invariants; warnings are reported for operator review.
 *
 * Usage: node scripts/deployment-safety-audit.js
 *    or: npm run audit:deployment
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

// Staging-manual-only schema. These files must never be wired into the
// automatic Render build migration (render.yaml -> npm run db:migrate).
const STAGING_MANUAL_SQL = Object.freeze([
  'beta-invitations.sql',
  'beta-feedback-audit.sql',
  'cashfree-sandbox.sql',
]);

const AUDITED_FILES = Object.freeze([
  'render.yaml',
  'src/app.js',
  'src/db/migrate.js',
  'src/services/draft-testing-gate.js',
  '.gitignore',
  'exam-practice-pro/lib/api.ts',
  'exam-practice-pro/app/status/page.tsx',
]);

// Tracked source directories scanned for accidentally committed credentials.
const SECRET_SCAN_FILES = Object.freeze([
  'src/app.js',
  'src/config/index.js',
  'src/db/migrate.js',
  'exam-practice-pro/lib/api.ts',
]);

function finding(severity, id, file, message) {
  return { severity, id, file, message };
}

function auditSources(files) {
  const findings = [];
  const get = name => (typeof files[name] === 'string' ? files[name] : null);

  // 1. Staging-manual SQL must stay out of the automatic migration.
  const migrate = get('src/db/migrate.js');
  if (migrate === null) {
    findings.push(finding('critical', 'migrate-missing', 'src/db/migrate.js',
      'Migration script is missing; Render build command cannot be verified.'));
  } else {
    for (const sql of STAGING_MANUAL_SQL) {
      if (migrate.includes(sql)) {
        findings.push(finding('critical', 'auto-migrate-manual-sql', 'src/db/migrate.js',
          `Automatic migration references staging-manual-only file ${sql}. Apply it manually on staging only.`));
      }
    }
    if (/seed(Starter|Competitive)Content|seedEbooks/.test(migrate)) {
      findings.push(finding('warning', 'migrate-seeds-content', 'src/db/migrate.js',
        'db:migrate also seeds content on every Render deploy. Confirm seeds stay idempotent and never activate draft mocks.'));
    }
    if (migrate.includes('rejectUnauthorized: false')) {
      findings.push(finding('warning', 'ssl-reject-unauthorized', 'src/db/migrate.js',
        'Production migration disables TLS certificate verification for the database connection.'));
    }
  }

  // 2. Cashfree webhook raw body must be mounted before express.json.
  const app = get('src/app.js');
  if (app === null) {
    findings.push(finding('critical', 'app-missing', 'src/app.js', 'Express app source missing.'));
  } else {
    const webhookIdx = app.indexOf("/api/v1/cashfree/webhook");
    const rawIdx = app.indexOf('express.raw');
    const jsonIdx = app.indexOf('app.use(express.json');
    if (webhookIdx === -1 || rawIdx === -1) {
      findings.push(finding('critical', 'webhook-raw-missing', 'src/app.js',
        'Cashfree webhook is not mounted with express.raw; HMAC signature verification would break.'));
    } else if (jsonIdx !== -1 && jsonIdx < webhookIdx) {
      findings.push(finding('critical', 'webhook-raw-order', 'src/app.js',
        'General express.json is mounted before the Cashfree raw webhook parser; signature verification would fail.'));
    }
  }

  // 3. Draft/beta features must stay fail-closed to staging.
  const gate = get('src/services/draft-testing-gate.js');
  if (gate === null) {
    findings.push(finding('critical', 'draft-gate-missing', 'src/services/draft-testing-gate.js',
      'Draft-testing gate is missing; beta/draft features could run unguarded.'));
  } else {
    if (!gate.includes("environment === 'staging'")) {
      findings.push(finding('critical', 'draft-gate-not-staging-only', 'src/services/draft-testing-gate.js',
        'Draft-testing gate no longer requires the staging environment.'));
    }
    if (!/!\s*origins\.includes\(PRODUCTION_ORIGIN\)/.test(gate)) {
      findings.push(finding('critical', 'draft-gate-prod-origin', 'src/services/draft-testing-gate.js',
        'Draft-testing gate no longer excludes the production frontend origin.'));
    }
  }

  // 4. .env must stay untracked.
  const gitignore = get('.gitignore');
  if (gitignore === null || !/^\.env\s*$/m.test(gitignore)) {
    findings.push(finding('critical', 'env-gitignore', '.gitignore',
      '.env is not ignored; database credentials and secrets could be committed.'));
  }

  // 5. No committed PostgreSQL credentials in scanned sources.
  for (const name of SECRET_SCAN_FILES) {
    const content = get(name);
    if (content && /postgres(?:ql)?:\/\/[^\s/'"]+:[^\s@/'"]+@/.test(content)) {
      findings.push(finding('critical', 'hardcoded-connection-string', name,
        'A PostgreSQL connection string with embedded credentials appears to be committed.'));
    }
  }

  // 6. render.yaml review items (warnings only; this file cannot prove how the
  //    actual Render service was created).
  const render = get('render.yaml');
  if (render === null) {
    findings.push(finding('warning', 'render-yaml-missing', 'render.yaml',
      'render.yaml missing; cannot review Render blueprint for migration safety.'));
  } else {
    const build = /buildCommand:\s*(.+)/.exec(render);
    if (build && build[1].includes('db:migrate')) {
      findings.push(finding('warning', 'render-auto-migrate', 'render.yaml',
        'Render buildCommand runs npm run db:migrate on every deploy. Prefer an explicit migration step so schema/content changes are never accidental.'));
    }
    const name = /name:\s*(\S+)/.exec(render);
    if (name && name[1] !== 'quiz-app-regd') {
      findings.push(finding('warning', 'render-service-name', 'render.yaml',
        `Blueprint service name '${name[1]}' differs from the documented production host quiz-app-regd.onrender.com. Verify which service render.yaml actually controls before relying on it.`));
    }
  }

  // 7. Frontend production-API fallback can silently point a staging build at
  //    the production API when NEXT_PUBLIC_API_URL is unset.
  const api = get('exam-practice-pro/lib/api.ts');
  if (api !== null && api.includes("productionFallback = 'https://quiz-app-regd.onrender.com'")) {
    findings.push(finding('warning', 'frontend-prod-fallback', 'exam-practice-pro/lib/api.ts',
      'Production builds silently fall back to the production API when NEXT_PUBLIC_API_URL is unset. A staging Vercel deployment missing that variable would call production.'));
  }

  return findings;
}

function readAuditedFiles(root) {
  const files = {};
  for (const name of AUDITED_FILES) {
    const full = path.join(root, name);
    try {
      files[name] = fs.readFileSync(full, 'utf8');
    } catch {
      files[name] = null;
    }
  }
  return files;
}

function formatReport(findings) {
  const order = { critical: 0, warning: 1, info: 2 };
  const sorted = [...findings].sort((a, b) => order[a.severity] - order[b.severity]);
  const lines = ['ExamPro deployment-safety audit (source tree only, read-only)', ''];
  if (sorted.length === 0) {
    lines.push('PASS: no critical or warning findings.');
    return lines.join('\n');
  }
  for (const f of sorted) {
    lines.push(`[${f.severity.toUpperCase()}] ${f.id} (${f.file})`);
    lines.push(`  ${f.message}`);
  }
  const criticals = sorted.filter(f => f.severity === 'critical').length;
  const warnings = sorted.filter(f => f.severity === 'warning').length;
  lines.push('');
  lines.push(`${criticals} critical, ${warnings} warning finding(s).`);
  return lines.join('\n');
}

function main() {
  const findings = auditSources(readAuditedFiles(REPO_ROOT));
  console.log(formatReport(findings));
  const criticals = findings.filter(f => f.severity === 'critical').length;
  process.exit(criticals > 0 ? 1 : 0);
}

if (require.main === module) {
  main();
}

module.exports = { auditSources, formatReport, STAGING_MANUAL_SQL, AUDITED_FILES };
