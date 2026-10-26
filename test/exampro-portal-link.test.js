'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const project = join(__dirname, '..');

const read = file => readFileSync(join(project, file), 'utf8');

test('historic HTML no longer advertises fake institute domain or demo-only captions', () => {
  const original = read('exampro/index.html');
  for (const phrase of [
    '.exampro.example',
    'Saved only in this browser. Nothing is uploaded.',
    'This demo has everything unlocked',
    'Does this demo save my data?',
    'Demo data runs in your browser.',
    'This demo keeps them in this browser only.',
  ]) {
    assert.equal(original.includes(phrase), false, phrase);
  }
  assert.match(original, /id="livePortalLink"/);
  assert.match(original, /var publicPortalURL=/);
  assert.match(original, /\/exampro\?institute=/);
  assert.match(original, /'&brand='/);
  assert.match(original, /encodeURIComponent\(JSON\.stringify\(/);
});

test('live ExamPro editor uses real public branded link, not a fictitious tenant URL', () => {
  const page = read('exam-practice-pro/app/exampro/page.tsx');
  const publicPortal = read('exam-practice-pro/app/exampro/portal/page.tsx');
  assert.match(page, /const publicPortalPath = '\/exampro\?institute='/);
  assert.match(page, /window\.location\.replace\(next\.pathname \+ next\.search\)/);
  assert.match(page, /new URL\('\/exampro\/portal'/);
  assert.match(page, /quiz-app-virid-zeta-41\.vercel\.app\/exampro\?institute=/);
  assert.match(publicPortal, /fallbackForSlug\(slug:string\|null\)/);
  assert.match(publicPortal, /decodeBrand\(params\.get\('brand'\),params\.get\('institute'\)\)/);
  assert.match(publicPortal, /fetchCatalog\(\)/);
  // No client-provided institute slug may grant privileges or imply tenancy.
  assert.match(publicPortal, /This is not a private coaching-institute account/);
});
