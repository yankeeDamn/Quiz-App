'use strict';
const fs = require('node:fs');
let db;
const nativeFetch = global.fetch;
function configure() {
  const raw = process.env.PAYMENT_TEST_DATABASE_URL;
  if (!raw)
    throw Error(
      'PAYMENT_TEST_DATABASE_URL required (disposable local database)',
    );
  const target = new URL(raw);
  if (
    !['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) ||
    !/^\/payment_tests(?:_[a-z0-9]+)?$/.test(target.pathname)
  )
    throw Error('Only loopback payment_tests databases permitted');
  Object.assign(process.env, {
    DATABASE_URL: raw,
    NODE_ENV: 'test',
    APP_ENV: 'test',
    MONETIZATION_ENABLED: 'true',
    MONETIZATION_CHECKOUT_ENABLED: 'true',
    MONETIZATION_CASHFREE_MODE: 'sandbox',
    MONETIZATION_CASHFREE_APP_ID: 'synthetic-app',
    MONETIZATION_CASHFREE_SECRET: 'synthetic-secret',
    MONETIZATION_FRONTEND_ORIGIN: 'https://frontend.example.test',
    MONETIZATION_API_ORIGIN: 'https://api.example.test',
    AUTH_SECRET: 'payment-test-auth-only',
  });
  db = require('../../src/config/database');
}
async function schema() {
  const source = fs.readFileSync('src/db/migrate.js', 'utf8'),
    start = source.indexOf('CREATE TABLE IF NOT EXISTS users ('),
    end = source.indexOf('\n);', start);
  await db.query(source.slice(start, end + 3));
  for (let i = 0; i < 2; i++)
    for (const file of ['monetization.sql', 'cashfree-checkout.sql'])
      await db.query(fs.readFileSync('src/db/' + file, 'utf8'));
}
function provider() {
  const orders = new Map(),
    calls = [];
  let timeoutAfterCreate = false;
  global.fetch = async (url, options = {}) => {
    if (!String(url).startsWith('https://sandbox.cashfree.com/pg/')) {
      if (String(url).startsWith('https://api.cashfree.com/'))
        throw Error('Tests must never call live Cashfree');
      return nativeFetch(url, options);
    }
    calls.push({ url, options });
    const path = new URL(url).pathname.slice(3),
      id = path.split('/')[2];
    const reply = (data, status = 200) => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => structuredClone(data),
    });
    if (options.method === 'POST') {
      const body = JSON.parse(options.body);
      if (!orders.has(body.order_id))
        orders.set(body.order_id, {
          ...body,
          order_status: 'ACTIVE',
          payment_session_id: 'session-' + body.order_id,
          payments: [],
        });
      if (timeoutAfterCreate) {
        timeoutAfterCreate = false;
        throw Error('Synthetic timeout after provider accepted order');
      }
      return reply(orders.get(body.order_id));
    }
    const remote = orders.get(id);
    if (!remote) return reply({}, 404);
    return reply(path.endsWith('/payments') ? remote.payments : remote);
  };
  function settle(id, status = 'SUCCESS', overrides = {}) {
    const r = orders.get(id);
    if (!r) throw Error('Unknown synthetic order ' + id);
    r.order_status = status === 'SUCCESS' ? 'PAID' : 'ACTIVE';
    r.payments = [
      {
        order_id: id,
        cf_payment_id: 'pay-' + id,
        payment_amount: r.order_amount,
        payment_currency: 'INR',
        payment_status: status,
        payment_time: new Date().toISOString(),
        ...overrides,
      },
    ];
  }
  return {
    orders,
    calls,
    settle,
    timeoutNext() {
      timeoutAfterCreate = true;
    },
    restore() {
      global.fetch = nativeFetch;
    },
  };
}
function app() {
  const express = require('express'),
    app = express();
  app.use(
    '/api/v1/payments/webhook',
    express.raw({ type: 'application/json', limit: '64kb' }),
  );
  app.use(express.json());
  app.use(require('cors')({ origin: true }));
  app.use('/api/v1', require('../../src/routes/monetization').createRouter());
  app.use((e, _q, r, _n) =>
    r
      .status(e.statusCode || 500)
      .json({ success: false, error: { message: e.message } }),
  );
  return app;
}
module.exports = { configure, schema, provider, app };
