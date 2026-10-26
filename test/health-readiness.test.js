'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const database = require('../src/config/database');
const healthRouter = require('../src/routes/health');

test('readiness fails closed when AUTH_SECRET or DB is missing and never caches', async (t) => {
  const app = express();
  app.use('/api/v1/health', healthRouter);
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));

  const priorDatabaseUrl = process.env.DATABASE_URL;
  const priorAuthSecret = process.env.AUTH_SECRET;
  let connected = true;
  t.mock.method(database, 'isHealthy', async () => connected);
  t.after(() => {
    if (priorDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = priorDatabaseUrl;
    if (priorAuthSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = priorAuthSecret;
  });

  const ready = () => fetch(`http://127.0.0.1:${server.address().port}/api/v1/health/ready`);
  delete process.env.DATABASE_URL;
  process.env.AUTH_SECRET = 'configured';
  let response = await ready();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).data.database, 'not_configured');

  process.env.DATABASE_URL = 'postgresql://localhost/mock';
  delete process.env.AUTH_SECRET;
  response = await ready();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).data.authentication, 'not_configured');

  process.env.AUTH_SECRET = 'configured';
  connected = false;
  response = await ready();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).data.database, 'unavailable');

  connected = true;
  response = await ready();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data.status, 'ready');
  assert.equal(payload.data.database, 'connected');
});
