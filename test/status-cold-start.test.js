'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('deployment status no longer makes an 8-second server-side network request', () => {
  const page = fs.readFileSync(path.join(root, 'exam-practice-pro/app/status/page.tsx'), 'utf8');
  assert.match(page, /ApiReadiness/);
  assert.doesNotMatch(page, /AbortSignal\.timeout\(8000\)/);
  assert.doesNotMatch(page, /fetch\(backend\s*\+/);
  assert.match(page, /VERCEL_GIT_COMMIT_SHA/);
  assert.match(page, /export const metadata/);
});

test('readiness widget shows waiting, ready, HTTP not-ready and network failure separately', () => {
  const widget = fs.readFileSync(path.join(root, 'exam-practice-pro/components/status/api-readiness.tsx'), 'utf8');
  assert.match(widget, /TIMEOUT_MS\s*=\s*90_000/);
  assert.match(widget, /\/api\/v1\/health\/ready/);
  assert.match(widget, /data\?\.database === 'connected'/);
  assert.match(widget, /data\?\.authentication === 'configured'/);
  assert.match(widget, /response\.ok && payload\?\.success === true/);
  assert.match(widget, /'not-ready'/);
  assert.match(widget, /'unreachable'/);
  assert.match(widget, /'timeout'/);
  assert.match(widget, /Check again/);
  assert.match(widget, /Open API readiness response/);
  assert.match(widget, /controller\.abort\(\)/);
});
