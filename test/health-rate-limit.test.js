'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { shouldSkipGeneralRateLimit } = require('../src/middleware/rate-limiter');

test('only exact health and existing admin routes bypass the general rate limiter', () => {
  const skipped = [
    '/api/v1/health',
    '/api/v1/health/',
    '/api/v1/health/ready',
    '/api/v1/health/ready?debug=1',
    '/api/v1/admin',
    '/api/v1/admin/me',
    '/api/v1/admin/topics/ssc26-m01-reasoning/questions',
  ];
  const throttled = [
    '/api/v1/healthcheck',
    '/api/v1/health/ready-extra',
    '/api/v1/health/ready/anything',
    '/api/v1/admin-public',
    '/api/v1/mocks',
    '/api/v1/mocks/stats',
    '/api/v1/exam-attempts/start',
    '/api/v1/quiz/attempts',
  ];
  for (const url of skipped) assert.equal(shouldSkipGeneralRateLimit({originalUrl:url}),true,url);
  for (const url of throttled) assert.equal(shouldSkipGeneralRateLimit({originalUrl:url}),false,url);
});

test('150 readiness requests never 429 while ordinary API requests remain rate limited', async t => {
  const app = require('../src/app');
  const server = await new Promise(resolve => {
    const instance = app.listen(0,'127.0.0.1',()=>resolve(instance));
  });
  t.after(()=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve())));
  const url='http://127.0.0.1:'+server.address().port;
  for(let i=0;i<150;i++){
    const res=await fetch(url+'/api/v1/health/ready');
    assert.notEqual(res.status,429,'health probe #'+(i+1)+' must never be blocked');
    await res.arrayBuffer();
  }
  for(let i=0;i<100;i++){
    const res=await fetch(url+'/api/v1/nonexistent-route-'+i);
    assert.equal(res.status,404,'ordinary request '+i+' should be below quota');
    await res.arrayBuffer();
  }
  const blocked=await fetch(url+'/api/v1/nonexistent-route-last');
  assert.equal(blocked.status,429,'101st ordinary request should be throttled');
  const payload=await blocked.json();
  assert.equal(payload.success,false);
});
