'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/database');
const app = require('../src/app');

test('health returns 503 when PostgreSQL is unavailable', async () => {
  const original = db.isHealthy;
  db.isHealthy = async () => false;
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.success, false);
    assert.equal(body.data.database, 'unavailable');
  } finally {
    db.isHealthy = original;
    await new Promise((resolve) => server.close(resolve));
  }
});

test('health returns 200 when PostgreSQL is connected', async () => {
  const original = db.isHealthy;
  db.isHealthy = async () => true;
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.database, 'connected');
  } finally {
    db.isHealthy = original;
    await new Promise((resolve) => server.close(resolve));
  }
});
