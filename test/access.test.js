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

// Exercise real HTTP/auth middleware against nonsensitive server-side fixtures.
const mocks=require('../src/services/mocks.service');
const bank=mocks.fromJson(require('./fixtures/content').starter());
// This route fixture represents already-reviewed published content.
bank.topics.forEach(t=>t.questions.forEach(q=>{q.reviewedAt='2026-01-01T00:00:00Z';}));
// Separate free and paid ranges for this route test; overlap isolation is tested separately.
bank.mocks=bank.mocks.filter(m=>m.id==='ssc1'||m.id==='ssc2');
bank.mocks[1].sections=[{name:'Paid fixture',parts:[{topic:'computer',from:0,to:2}]}];
const list=()=>mocks.listFromBank(bank);
mocks.listMocks=async()=>list();
mocks.findMock=async id=>{
 const def=mocks.allDefinitions(bank).find(d=>d.id===id);
 const summary=list().find(t=>t.id===id);
 return def&&summary?{tier:def.tier,summary,build:()=>mocks.build(bank,def)}:null;
};

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
  assert.ok(body.data.tests.length>2);
  assert.doesNotMatch(JSON.stringify(body), /"(?:question|options|answer|correctAnswer|explanation)"/);
});

test('a free scored mock opens for a guest but hides correct answers', async () => {
  const { status, body } = await get('/api/v1/mocks/ssc1');
  assert.equal(status, 200);
  assert.ok(body.data.test.questions.length > 0);
  assert.equal('answer' in body.data.test.questions[0], false);
  assert.equal('explanation' in body.data.test.questions[0], false);
});

test('unscored practice deliberately includes answers', async () => {
  const { status, body } = await get('/api/v1/mocks/topic-reason/practice');
  assert.equal(status, 200);
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

test('API enforces signed-in sessions for stored scored attempts',async()=>{
  assert.equal((await get('/api/v1/exam-attempts')).status,401);
});

test('owner key works but invalid admin access fails',async()=>{
  const allowed=await get('/api/v1/admin/me',{'x-admin-key':'a-long-admin-key-for-tests-0123456789'});
  assert.equal(allowed.status,200);
  assert.equal(allowed.body.data.via,'key');
});

test('old payment routes are gone', async () => {
  assert.equal((await get('/api/v1/payments/config')).status, 404);
});

test('admin endpoints never cache data and refuse anonymous writes', async () => {
  for (const path of ['/api/v1/admin/me','/api/v1/admin/topics','/api/v1/admin/tests','/api/v1/admin/users','/api/v1/admin/grants']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 401, path);
    assert.match(response.headers.get('cache-control') || '', /no-store/);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  }
  const response = await fetch(base + '/api/v1/admin/topics', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:'unauthorized',name:'Not allowed'})});
  assert.equal(response.status,401);
});
