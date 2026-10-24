'use strict';

// Starts the API on a random port and checks who may open premium mocks and the admin endpoints.
process.env.NODE_ENV = 'test';
process.env.AUTH_SECRET = 'test-auth-secret-test-auth-secret';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.ADMIN_API_KEY = 'a-long-admin-key-for-tests-0123456789';
process.env.ADMIN_EMAILS = 'owner@example.com';
delete process.env.DATABASE_URL;

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../src/app');

let server;
let base;

test.before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());

async function get(path, headers = {}) {
  const res = await fetch(base + path, { headers });
  return { status: res.status, body: await res.json() };
}

test('catalogue is public', async () => {
  const { status, body } = await get('/api/v1/mocks');
  assert.equal(status, 200);
  assert.equal(body.data.tests.length, 21);
});

test('a free mock opens for a guest and includes answers', async () => {
  const { status, body } = await get('/api/v1/mocks/ssc1');
  assert.equal(status, 200);
  assert.ok(body.data.test.questions.length > 0);
  assert.ok('answer' in body.data.test.questions[0]);
});

test('a premium mock does not open for a guest and leaks no questions', async () => {
  const { status, body } = await get('/api/v1/mocks/ssc2');
  assert.equal(status, 401);
  assert.equal(body.error.code, 'SIGN_IN_REQUIRED');
  assert.equal(JSON.stringify(body).includes('explanation'), false);
});

test('an unknown mock is a 404', async () => {
  const { status } = await get('/api/v1/mocks/nope');
  assert.equal(status, 404);
});

test('admin endpoints reject a missing or wrong key', async () => {
  assert.equal((await get('/api/v1/admin/user?email=a@b.com')).status, 401);
  assert.equal((await get('/api/v1/admin/user?email=a@b.com', { 'x-admin-key': 'wrong' })).status, 401);
});

test('admin content routes reject guests and bad keys', async () => {
  assert.equal((await get('/api/v1/admin/topics')).status, 401);
  assert.equal((await get('/api/v1/admin/tests', { 'x-admin-key': 'wrong' })).status, 401);
  assert.equal((await get('/api/v1/admin/me', { authorization: 'Bearer not-a-token' })).status, 401);
});

test('old payment routes are gone', async () => {
  assert.equal((await get('/api/v1/payments/config')).status, 404);
});
