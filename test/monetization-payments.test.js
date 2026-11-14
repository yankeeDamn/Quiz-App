'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict'),
  crypto = require('node:crypto');
const pay = require('../src/services/monetization-payments.service'),
  db = require('../src/config/database');
const env = { ...process.env },
  originalFetch = global.fetch,
  originalQuery = db.query;
function config() {
  Object.assign(process.env, {
    APP_ENV: 'test',
    MONETIZATION_ENABLED: 'true',
    MONETIZATION_CHECKOUT_ENABLED: 'true',
    MONETIZATION_CASHFREE_MODE: 'sandbox',
    MONETIZATION_CASHFREE_APP_ID: 'synthetic',
    MONETIZATION_CASHFREE_SECRET: 'synthetic',
    MONETIZATION_FRONTEND_ORIGIN: 'https://ui.example.test',
    MONETIZATION_API_ORIGIN: 'https://api.example.test',
  });
}
test.afterEach(() => {
  global.fetch = originalFetch;
  db.query = originalQuery;
  for (const key of Object.keys(process.env))
    if (!(key in env)) delete process.env[key];
  Object.assign(process.env, env);
});
test('sales availability fails closed without schema, live approval or isolated sandbox', async () => {
  config();
  db.query = async () => {
    throw Error('missing schema');
  };
  assert.equal(await pay.availability(), null);
  db.query = async () => ({ rows: [] });
  assert.equal(await pay.availability(), 'sandbox');
  process.env.MONETIZATION_CHECKOUT_ENABLED = 'false';
  assert.equal(await pay.availability(), null);
  // Institute billing and advertising share the provider helper, but keep
  // their existing switches independent of learner checkout availability.
  assert.equal(pay.settings().mode, 'sandbox');
  assert.throws(() => pay.checkoutSettings(), /temporarily unavailable/);
  assert.equal(pay.providerSettings().mode, 'sandbox');
  config();
  process.env.APP_ENV = 'production';
  assert.throws(pay.settings, /isolated/);
  config();
  process.env.MONETIZATION_CASHFREE_MODE = 'production';
  process.env.MONETIZATION_LIVE_PAYMENTS_ENABLED = 'false';
  assert.throws(pay.settings, /disabled/);
  process.env.MONETIZATION_LIVE_PAYMENTS_ENABLED = 'true';
  assert.equal(await pay.availability(), 'production');
});
test('raw-body signature rejects whitespace tampering, parsed JSON and malformed headers; sales switch does not block delayed webhooks', () => {
  config();
  process.env.MONETIZATION_ENABLED = 'false';
  process.env.MONETIZATION_CHECKOUT_ENABLED = 'false';
  const raw = Buffer.from('{ "amount": 49.00 }'),
    timestamp = '1793454000000';
  const signature = crypto
    .createHmac('sha256', 'synthetic')
    .update(timestamp)
    .update(raw)
    .digest('base64');
  assert.doesNotThrow(() => pay.verify(raw, signature, timestamp));
  for (const [bytes, sig, ts] of [
    [Buffer.from('{"amount":49}'), signature, timestamp],
    [raw, signature, timestamp + '1'],
    [raw, 'x', timestamp],
    [raw, signature, 'bad'],
    [JSON.parse(raw), signature, timestamp],
  ])
    assert.throws(() => pay.verify(bytes, sig, ts), /signature/);
});
test('Cashfree create uses a stable valid UUID idempotency header and server credentials', async () => {
  config();
  const seen = new Map();
  global.fetch = async (url, options) => {
    assert.match(url, /sandbox.cashfree.com/);
    assert.equal(options.headers['x-client-secret'], 'synthetic');
    assert.match(options.headers['x-idempotency-key'], /^[a-f0-9-]{36}$/);
    const id = JSON.parse(options.body).order_id;
    if (seen.has(id))
      assert.equal(seen.get(id), options.headers['x-idempotency-key']);
    seen.set(id, options.headers['x-idempotency-key']);
    return { ok: true, json: async () => ({}) };
  };
  const body = { order_id: 'ep_' + crypto.randomUUID().replaceAll('-', '') };
  await pay.gateway('POST', '/orders', body);
  await pay.gateway('POST', '/orders', body);
  const instituteId = crypto.randomUUID();
  await pay.gateway('POST', '/orders', { order_id: instituteId });
  assert.equal(seen.get(instituteId), instituteId);
});
test('invalid and cross-account orders are rejected before provider calls', async () => {
  config();
  db.query = async (sql, params) => {
    assert.match(sql, /user_id=\$2/);
    assert.equal(params[1], 'other');
    return { rows: [] };
  };
  global.fetch = async () => {
    throw Error('provider must not be called');
  };
  await assert.rejects(
    pay.reconcile('ep_' + 'a'.repeat(32), 'other'),
    (e) => e.statusCode === 404,
  );
  await assert.rejects(
    pay.ownOrder('../orders', 'other'),
    (e) => e.statusCode === 404,
  );
  await assert.rejects(pay.history('other', {}), /Invalid history cursor/);
});
