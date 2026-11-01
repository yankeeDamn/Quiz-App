'use strict';

process.env.NODE_ENV = 'test';
process.env.AUTH_SECRET = 'tracker-test-auth-secret-minimum-32-bytes';
process.env.DATABASE_URL = 'postgresql://example.invalid/not-used';
process.env.GOVT_APPLICATION_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
// jose v6 uses the Web Crypto global; Node 18 CI needs a test-only polyfill.
globalThis.crypto ??= require('node:crypto').webcrypto;

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const db = require('../src/config/database');
const { errorHandler } = require('../src/middleware/error-handler');
const router = require('../src/routes/government-job-applications');
const tracker = require('../src/services/government-job-applications.service');

const originalQuery = db.query;
const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const rows = new Map();
const calls = [];
let server;
let origin;
function resetStore() { rows.clear(); calls.length = 0; }
function stubDatabase() {
  db.query = async (sql, params = []) => {
    calls.push({ sql, params });
    if (sql.includes('FROM users')) {
      const email = params[2];
      return { rowCount: 1, rows: [{
        id: email === 'one@example.test' ? U1 : U2, provider: 'google',
        provider_id: 'issuer-sub', email, name: 'Tester', image: null,
        role: 'user', plan: 'free', plan_expires_at: null, payment_status: 'unpaid',
      }] };
    }
    if (sql.startsWith('INSERT INTO public.govt_job_applications')) {
      const columns = sql.match(/\(([^)]+)\) VALUES \(/)[1].split(', ').map(s => s.trim());
      const row = {
        id: ID, notice_id: null, title: '', organisation: '', category: 'General',
        official_url: null, status: 'planning', application_date: null,
        deadline: null, reference_ciphertext: null, reference_suffix: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      columns.forEach((column, index) => { row[column] = params[index]; });
      rows.set(row.id, row);
      return { rowCount: 1, rows: [{ ...row }] };
    }
    if (sql.startsWith('SELECT id, notice_id')) {
      return { rowCount: rows.size, rows: [...rows.values()].filter(row => row.user_id === params[0]).map(row => ({ ...row })) };
    }
    if (sql.startsWith('SELECT reference_ciphertext')) {
      const row = rows.get(params[0]);
      return { rowCount: row && row.user_id === params[1] ? 1 : 0,
        rows: row && row.user_id === params[1] ? [{ reference_ciphertext: row.reference_ciphertext }] : [] };
    }
    if (sql.startsWith('UPDATE public.govt_job_applications')) {
      const row = rows.get(params[0]);
      if (!row || row.user_id !== params[1]) return { rowCount: 0, rows: [] };
      for (const assignment of sql.split(' SET ')[1].split(' WHERE ')[0].split(', ')) {
        const match = assignment.match(/^([a-z_]+)=\$(\d+)$/);
        if (match) row[match[1]] = params[Number(match[2]) - 1];
      }
      return { rowCount: 1, rows: [{ ...row }] };
    }
    if (sql.startsWith('DELETE FROM public.govt_job_applications')) {
      const row = rows.get(params[0]);
      if (!row || row.user_id !== params[1]) return { rowCount: 0, rows: [] };
      rows.delete(params[0]);
      return { rowCount: 1, rows: [] };
    }
    throw new Error('Unexpected SQL: ' + sql);
  };
}
async function token(email, verified = true) {
  const { SignJWT } = await import('jose');
  return new SignJWT({ email, emailVerified: verified, provider: 'google', name: 'Tester', image: null })
    .setProtectedHeader({ alg: 'HS256' }).setSubject('issuer-sub').setIssuedAt().setExpirationTime('30m')
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET));
}
async function call(path, options = {}) {
  const response = await fetch(origin + '/api/v1/government-job-applications' + path, {
    method: options.method || 'GET',
    headers: {
      ...(options.token ? { authorization: 'Bearer ' + options.token } : {}),
      'content-type': 'application/json',
    },
    ...(Object.prototype.hasOwnProperty.call(options, 'body') ? { body: JSON.stringify(options.body) } : {}),
  });
  return { status: response.status, headers: response.headers, data: await response.json() };
}

test.before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/government-job-applications', router);
  app.use(errorHandler);
  server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
  stubDatabase();
});
test.after(async () => {
  db.query = originalQuery;
  await new Promise(resolve => server.close(resolve));
});
test.beforeEach(resetStore);

test('reference encryption is authenticated, randomized and decrypts correctly', () => {
  const a = tracker.encryptReference('SSC-REG-38462');
  const b = tracker.encryptReference('SSC-REG-38462');
  assert.notEqual(a, b);
  assert.ok(!a.includes('SSC-REG-38462'));
  assert.equal(tracker.decryptReference(a), 'SSC-REG-38462');
  const changed = Buffer.from(a, 'base64');
  changed[changed.length - 1] ^= 1;
  assert.throws(() => tracker.decryptReference(changed.toString('base64')));
});
test('validates strict input, private identity, official URL and date', () => {
  assert.throws(() => tracker.validatePayload({ title: 'ABC', organisation: 'SSC', userId: U2 }), /Unsupported/);
  assert.throws(() => tracker.validatePayload({ title: 'ABC', organisation: 'SSC', status: 'selected_by_government' }), /Invalid manually/);
  assert.throws(() => tracker.validatePayload({ title: 'ABC', organisation: 'SSC', officialUrl: 'http://ssc.gov.in/' }), /HTTPS/);
  assert.throws(() => tracker.validatePayload({ title: 'ABC', organisation: 'SSC', officialUrl: 'https://ssc.gov.in.evil.example/' }), /HTTPS/);
  assert.throws(() => tracker.validatePayload({ title: 'ABC', organisation: 'SSC', officialUrl: 'https://user:password@ssc.gov.in/' }), /HTTPS/);
  assert.throws(() => tracker.validatePayload({ title: 'ABC', organisation: 'SSC', deadline: '2027-02-31' }), /Invalid deadline/);
  assert.ok(tracker.validatePayload({ title: 'SSC CGL', organisation: 'SSC', officialUrl: 'https://ssc.gov.in/' }).officialUrl.startsWith('https://ssc.gov.in/'));
});
test('anonymous, unverified and invalid OAuth identities cannot access private endpoints', async () => {
  assert.equal((await call('/')).status, 401);
  assert.equal((await call('/', { token: 'not-valid' })).status, 401);
  assert.equal((await call('/', { token: await token('one@example.test', false) })).status, 403);
  assert.equal((await call('/', { method: 'POST', body: { title: 'SSC CGL', organisation: 'SSC' } })).status, 401);
  assert.equal(calls.filter(c => c.sql.includes('govt_job_applications')).length, 0);
});
test('create/list/reveal/update/delete enforce canonical user UUID, never return full reference in lists', async () => {
  const first = await token('one@example.test');
  const second = await token('two@example.test');
  const created = await call('/', {
    method: 'POST', token: first,
    body: { title: 'SSC CGL 2026', organisation: 'Staff Selection Commission',
      category: 'SSC', officialUrl: 'https://ssc.gov.in/', status: 'applied',
      reference: 'SSC-REG-38462', applicationDate: '2026-11-02' },
  });
  assert.equal(created.status, 201);
  assert.match(created.headers.get('cache-control') || '', /no-store/);
  assert.equal(created.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal(created.data.data.application.referenceMasked, '••••8462');
  assert.equal(JSON.stringify(created.data).includes('SSC-REG-38462'), false);
  assert.ok(!JSON.stringify(rows.get(ID)).includes('SSC-REG-38462'));
  const seen = await call('/', { token: first });
  assert.equal(seen.data.data.applications.length, 1);
  assert.equal(JSON.stringify(seen.data).includes('reference_ciphertext'), false);
  assert.equal(JSON.stringify(seen.data).includes('SSC-REG-38462'), false);
  const other = await call('/', { token: second });
  assert.equal(other.data.data.applications.length, 0);
  assert.equal((await call('/' + ID + '/reference', { token: second })).status, 404);
  assert.equal((await call('/' + ID, { token: second, method: 'PATCH', body: { status: 'applied' } })).status, 404);
  assert.equal((await call('/' + ID, { token: second, method: 'DELETE' })).status, 404);
  assert.equal((await call('/' + ID + '/reference', { token: first })).data.data.reference, 'SSC-REG-38462');
  const updated = await call('/' + ID, { token: first, method: 'PATCH', body: { status: 'exam_completed', reference: null } });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.data.application.status, 'exam_completed');
  assert.equal(updated.data.data.application.referenceMasked, null);
  assert.equal((await call('/' + ID + '/reference', { token: first })).data.data.reference, null);
  assert.equal((await call('/' + ID, { token: first, method: 'DELETE' })).status, 200);
  assert.equal((await call('/' + ID + '/reference', { token: first })).status, 404);
  assert.ok(calls.filter(c => c.sql.includes('public.govt_job_applications')).every(c => !c.sql.startsWith('INSERT') || c.params[0] === U1));
});
test('encryption-key misconfiguration fails closed without private DB queries', async () => {
  const previous = process.env.GOVT_APPLICATION_ENCRYPTION_KEY;
  const auth = await token('one@example.test');
  try {
    delete process.env.GOVT_APPLICATION_ENCRYPTION_KEY;
    const response = await call('/', { token: auth });
    assert.equal(response.status, 503);
    assert.match(response.data.error.message, /not configured/);
    assert.equal(calls.filter(c => c.sql.includes('public.govt_job_applications')).length, 0);
  } finally {
    process.env.GOVT_APPLICATION_ENCRYPTION_KEY = previous;
  }
});
test('rejects fabricated status, unsupported keys, malformed IDs and insecure links', async () => {
  const auth = await token('one@example.test');
  const bad = [
    { title: 'SSC CGL', organisation: 'SSC', status: 'selected' },
    { title: 'SSC CGL', organisation: 'SSC', officialUrl: 'https://evil.example/collect' },
    { title: 'SSC CGL', organisation: 'SSC', user_id: U2 },
    { title: 'SSC CGL', organisation: 'SSC', reference: 'https://malicious.test' },
  ];
  for (const body of bad) assert.equal((await call('/', { method: 'POST', token: auth, body })).status, 400);
  assert.equal((await call('/not-a-uuid', { method: 'DELETE', token: auth })).status, 404);
  assert.equal(rows.size, 0);
});
test('public recruitment route remains separate and accessible without a private identity', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '../src/routes/index.js'), 'utf8');
  const publicRoute = fs.readFileSync(path.join(__dirname, '../src/routes/government-jobs.js'), 'utf8');
  assert.match(source, /router\.use\('\/government-jobs', governmentJobsRoutes\)/);
  assert.match(source, /router\.use\('\/government-job-applications', governmentJobApplicationsRoutes\)/);
  assert.doesNotMatch(publicRoute, /authenticateNextAuth/);
});
