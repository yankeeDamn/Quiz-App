'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { auditSources, formatReport } = require('../scripts/deployment-safety-audit');

// A minimal source set that passes every critical invariant.
function healthySources() {
  return {
    'src/db/migrate.js': [
      "const { seedStarterContent } = require('./seed-content');",
      'rejectUnauthorized: false',
    ].join('\n'),
    'src/app.js': [
      "app.use('/api/v1/cashfree/webhook', express.raw({ type: 'application/json' }));",
      "app.use(express.json({ limit: '10kb' }));",
    ].join('\n'),
    'src/services/draft-testing-gate.js': [
      "config.draftTesting.environment === 'staging'",
      '!origins.includes(PRODUCTION_ORIGIN)',
    ].join('\n'),
    '.gitignore': 'node_modules/\n.env\n',
    'render.yaml': [
      'services:',
      '  - type: web',
      '    name: quiz-app-regd',
      '    buildCommand: npm ci --omit=dev && npm run db:migrate',
    ].join('\n'),
    'exam-practice-pro/lib/api.ts': "const configuredApi = '';",
  };
}

function byId(findings, id) {
  return findings.filter(f => f.id === id);
}

test('healthy source tree reports no critical findings', () => {
  const findings = auditSources(healthySources());
  assert.equal(findings.filter(f => f.severity === 'critical').length, 0,
    formatReport(findings));
});

test('staging-manual SQL wired into auto-migrate is critical', () => {
  const files = healthySources();
  files['src/db/migrate.js'] += "\nawait client.query(fs.readFileSync(path.join(__dirname,'beta-invitations.sql'),'utf8'));";
  const hits = byId(auditSources(files), 'auto-migrate-manual-sql');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].severity, 'critical');
});

test('cashfree webhook mounted after express.json is critical', () => {
  const files = healthySources();
  files['src/app.js'] = [
    "app.use(express.json({ limit: '10kb' }));",
    "app.use('/api/v1/cashfree/webhook', express.raw({ type: 'application/json' }));",
  ].join('\n');
  assert.equal(byId(auditSources(files), 'webhook-raw-order')[0].severity, 'critical');
});

test('missing cashfree raw parser is critical', () => {
  const files = healthySources();
  files['src/app.js'] = "app.use(express.json({ limit: '10kb' }));";
  assert.equal(byId(auditSources(files), 'webhook-raw-missing')[0].severity, 'critical');
});

test('draft gate without staging-only guard is critical', () => {
  const files = healthySources();
  files['src/services/draft-testing-gate.js'] = 'return config.draftTesting.enabled === true;';
  const findings = auditSources(files);
  assert.ok(byId(findings, 'draft-gate-not-staging-only').length === 1);
  assert.ok(byId(findings, 'draft-gate-prod-origin').length === 1);
});

test('unignored .env is critical', () => {
  const files = healthySources();
  files['.gitignore'] = 'node_modules/\n';
  assert.equal(byId(auditSources(files), 'env-gitignore')[0].severity, 'critical');
});

test('committed postgres credentials are critical', () => {
  const files = healthySources();
  files['src/config/index.js'] = "const url = 'postgresql://user:secretpw@host.neon.tech/db';";
  assert.equal(byId(auditSources(files), 'hardcoded-connection-string')[0].severity, 'critical');
});

test('auto-migration and service-name mismatch are warnings, not criticals', () => {
  const files = healthySources();
  files['render.yaml'] = files['render.yaml'].replace('quiz-app-regd', 'exam-practice-pro-api');
  const findings = auditSources(files);
  assert.equal(byId(findings, 'render-auto-migrate')[0].severity, 'warning');
  assert.equal(byId(findings, 'render-service-name')[0].severity, 'warning');
  assert.equal(findings.filter(f => f.severity === 'critical').length, 0);
});

test('frontend production fallback is a warning', () => {
  const files = healthySources();
  files['exam-practice-pro/lib/api.ts'] = "const productionFallback = 'https://quiz-app-regd.onrender.com';";
  assert.equal(byId(auditSources(files), 'frontend-prod-fallback')[0].severity, 'warning');
});

test('report format lists severities and summary', () => {
  const report = formatReport(auditSources(healthySources()));
  assert.match(report, /critical, \d+ warning/);
});
