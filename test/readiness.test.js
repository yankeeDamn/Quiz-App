'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/database');
const app = require('../src/app');

// A running process is not ready until both the database and NextAuth signing
// secret are configured and usable. This test intentionally mocks connectivity.
test('readiness responds 503 when PostgreSQL is unavailable and 200 when available', async () => {
  const original = db.isHealthy;
  const priorDatabaseUrl = process.env.DATABASE_URL;
  const priorAuthSecret = process.env.AUTH_SECRET;
  process.env.DATABASE_URL = 'postgresql://localhost/test-only';
  process.env.AUTH_SECRET = 'test-only-shared-auth-secret';
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/api/v1/health/ready`;
    db.isHealthy = async () => false;
    let response = await fetch(url);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      success: false,
      data: { status: 'not_ready', database: 'unavailable', authentication: 'configured' },
    });

    db.isHealthy = async () => true;
    response = await fetch(url);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      data: { status: 'ready', database: 'connected', authentication: 'configured' },
    });
  } finally {
    db.isHealthy = original;
    if (priorDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = priorDatabaseUrl;
    if (priorAuthSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = priorAuthSecret;
    await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
});
