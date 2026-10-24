'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/database');
const app = require('../src/app');

// The readiness contract must distinguish a running process from a usable database.
test('readiness responds 503 when PostgreSQL is unavailable and 200 when available', async () => {
  const original = db.isHealthy;
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/api/v1/health/ready`;
    db.isHealthy = async () => false;
    let response = await fetch(url);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      success: false,
      data: { status: 'not_ready', database: 'unavailable' },
    });

    db.isHealthy = async () => true;
    response = await fetch(url);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      success: true,
      data: { status: 'ready', database: 'connected' },
    });
  } finally {
    db.isHealthy = original;
    await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
});
