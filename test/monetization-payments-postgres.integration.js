'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict'),
  crypto = require('node:crypto');
const fixture = require('./helpers/payment-fixture');
fixture.configure();
const db = require('../src/config/database'),
  m = require('../src/services/monetization.service'),
  pay = require('../src/services/monetization-payments.service');
let provider, server, base;
async function user(plan = 'free', expiry = null) {
  return (
    await db.query(
      'INSERT INTO users(email,plan,plan_expires_at) VALUES($1,$2,$3) RETURNING *',
      ['synthetic-' + crypto.randomUUID() + '@example.test', plan, expiry],
    )
  ).rows[0];
}
function input(code = 'SSC_PACK_49', extra = {}) {
  return {
    code,
    phone: '9986418638',
    checkoutKey: crypto.randomUUID(),
    ...extra,
  };
}
async function count(id) {
  return (
    await db.query(
      'SELECT count(*)::int n FROM monetization_grants WHERE reference=$1',
      ['cashfree:' + id],
    )
  ).rows[0].n;
}
function signature(raw) {
  const timestamp = '1793454000000';
  return {
    'Content-Type': 'application/json',
    'x-webhook-timestamp': timestamp,
    'x-webhook-signature': crypto
      .createHmac('sha256', process.env.MONETIZATION_CASHFREE_SECRET)
      .update(timestamp)
      .update(raw)
      .digest('base64'),
  };
}
function token(u) {
  return require('jsonwebtoken').sign(
    { sub: u.email, email: u.email, provider: 'google', emailVerified: true },
    process.env.AUTH_SECRET,
    { expiresIn: '1h' },
  );
}
async function call(path, u, method = 'GET', body, headers = {}) {
  const r = await fetch(base + '/api/v1' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(u ? { Authorization: 'Bearer ' + token(u) } : {}),
      ...headers,
    },
    ...(body === undefined
      ? {}
      : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
  });
  return { status: r.status, headers: r.headers, json: await r.json() };
}
test.before(async () => {
  await fixture.schema();
  provider = fixture.provider();
  server = fixture.app().listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  base = 'http://127.0.0.1:' + server.address().port;
});
test.after(async () => {
  provider?.restore();
  if (server) {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
  await db.end();
});
test('all four fixed-price products activate only on verified success with exact UTC expiry', async () => {
  for (const code of [
    'SSC_PACK_49',
    'IT_EBOOK_PACK_99',
    'PRO_MONTHLY',
    'PRO_ANNUAL',
  ]) {
    const u = await user(),
      p = m.product(code),
      raw = input(code, {
        amount: 1,
        userId: crypto.randomUUID(),
        status: 'paid',
      }),
      order = await pay.create(u, raw);
    assert.equal(order.amountInr, p.amount);
    assert.equal(order.validityDays, p.days);
    assert.equal(order.automaticRenewal, false);
    assert.equal(await count(order.orderId), 0);
    provider.settle(order.orderId);
    const receipt = await pay.reconcile(order.orderId, u.id);
    assert.equal(receipt.status, 'paid');
    assert.equal(
      +new Date(receipt.accessExpiresAt) - +new Date(receipt.paidAt),
      p.days * 86400000,
    );
    assert.equal(await m.entitlement(u, code), true);
    if (code === 'SSC_PACK_49') {
      assert.equal(await m.mockAccess(u, { id: 'ssc-cgl-2026-mock-01' }), true);
      assert.equal(await m.mockAccess(u, { id: 'bank-po-mock-01' }), false);
      assert.equal(await m.entitlement(u, 'IT_EBOOK_PACK_99'), false);
    }
    if (code === 'IT_EBOOK_PACK_99') {
      assert.equal(
        await m.mockAccess(u, { id: 'ssc-cgl-2026-mock-01' }),
        false,
      );
      assert.equal(
        (await m.ebookPolicy('premium', u, { accessLevel: 'pro' })).locked,
        false,
      );
    }
    if (code.startsWith('PRO_')) {
      assert.equal(await m.mockAccess(u, { id: 'bank-po-mock-01' }), true);
      assert.equal(
        (await m.ebookPolicy('premium', u, { accessLevel: 'pro' })).locked,
        false,
      );
    }
  }
});
test('concurrent clicks and different browser retry keys share one payable order; aliases remain idempotent after settlement', async () => {
  const u = await user(),
    attempts = Array.from({ length: 8 }, () => input());
  const orders = await Promise.all(attempts.map((raw) => pay.create(u, raw)));
  const id = orders[0].orderId;
  assert.equal(new Set(orders.map((o) => o.orderId)).size, 1);
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int n FROM monetization_orders WHERE user_id=$1',
        [u.id],
      )
    ).rows[0].n,
    1,
  );
  assert.equal(provider.orders.has(id), true);
  provider.settle(id);
  await pay.reconcile(id, u.id);
  for (const raw of attempts) {
    const retry = await pay.create(u, raw);
    assert.equal(retry.orderId, id);
    assert.equal(retry.status, 'paid');
    assert.equal(retry.paymentSessionId, undefined);
  }
  assert.equal(await count(id), 1);
  await assert.rejects(
    pay.create(u, { ...attempts[0], code: 'PRO_ANNUAL' }),
    (e) => e.statusCode === 409,
  );
});
test('timeout after Cashfree acceptance resumes the saved intent with identical body and provider key', async () => {
  const u = await user(),
    raw = input();
  provider.timeoutNext();
  await assert.rejects(pay.create(u, raw), /Synthetic timeout/);
  const order = await pay.create(u, { ...raw, phone: '9888888888' });
  assert.equal(
    provider.orders.get(order.orderId).customer_details.customer_phone,
    raw.phone,
  );
  assert.equal(
    (
      await db.query(
        'SELECT count(*)::int n FROM monetization_orders WHERE user_id=$1',
        [u.id],
      )
    ).rows[0].n,
    1,
  );
  const posts = provider.calls.filter(
    (c) =>
      c.options.method === 'POST' &&
      JSON.parse(c.options.body).order_id === order.orderId,
  );
  assert.equal(posts.length, 1);
});
test('concurrent signed webhook deliveries and status requests grant once; raw tampering fails', async () => {
  const u = await user(),
    o = await pay.create(u, input());
  provider.settle(o.orderId);
  const raw = JSON.stringify({
      type: 'PAYMENT_SUCCESS_WEBHOOK',
      data: {
        order: { order_id: o.orderId },
        payment: { payment_status: 'SUCCESS' },
      },
    }),
    headers = signature(raw);
  const results = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      i % 2
        ? call('/payments/webhook', null, 'POST', raw, headers)
        : call('/payments/orders/' + o.orderId, u),
    ),
  );
  assert.ok(
    results.every((r) => r.status === 200),
    JSON.stringify(results),
  );
  assert.equal(await count(o.orderId), 1);
  const first = await pay.ownOrder(o.orderId, u.id);
  await call('/payments/webhook', null, 'POST', raw, headers);
  assert.equal(
    (await pay.ownOrder(o.orderId, u.id)).accessExpiresAt.toISOString(),
    first.accessExpiresAt.toISOString(),
  );
  assert.equal(
    (await call('/payments/webhook', null, 'POST', raw + ' ', headers)).status,
    401,
  );
});
test('pending, failed and cancelled attempts grant nothing; retries resume the same order and can settle later', async () => {
  const u = await user(),
    o = await pay.create(u, input());
  assert.equal((await pay.reconcile(o.orderId, u.id)).status, 'pending');
  for (const [remote, status] of [
    ['PENDING', 'pending'],
    ['FAILED', 'failed'],
    ['USER_DROPPED', 'cancelled'],
    ['CANCELLED', 'cancelled'],
  ]) {
    provider.settle(o.orderId, remote);
    assert.equal((await pay.reconcile(o.orderId, u.id)).status, status);
    assert.equal(await count(o.orderId), 0);
    assert.equal((await pay.create(u, input())).orderId, o.orderId);
  }
  provider.settle(o.orderId);
  assert.equal((await pay.reconcile(o.orderId, u.id)).status, 'paid');
  assert.equal(await count(o.orderId), 1);
});
test('only provider-confirmed closed orders allow a new purchase', async () => {
  const u = await user(),
    raw = input(),
    o = await pay.create(u, raw);
  provider.orders.get(o.orderId).order_status = 'EXPIRED';
  assert.equal((await pay.reconcile(o.orderId, u.id)).status, 'expired');
  assert.equal((await pay.create(u, raw)).status, 'expired');
  assert.notEqual((await pay.create(u, input())).orderId, o.orderId);
});
test('provider ID, amount, currency, customer and successful payment fields all fail closed', async () => {
  const u = await user(),
    o = await pay.create(u, input()),
    remote = provider.orders.get(o.orderId);
  provider.settle(o.orderId);
  for (const [field, value] of [
    ['order_id', 'other'],
    ['order_amount', 1],
    ['order_currency', 'USD'],
    ['customer_details', { customer_id: crypto.randomUUID() }],
  ]) {
    const saved = remote[field];
    remote[field] = value;
    await assert.rejects(
      pay.reconcile(o.orderId, u.id),
      (e) => e.statusCode === 409,
    );
    remote[field] = saved;
    assert.equal(await count(o.orderId), 0);
  }
  for (const override of [
    { payment_amount: 1 },
    { payment_currency: 'USD' },
    { order_id: 'other' },
    { payment_status: 'PENDING' },
    { payment_status: 'FAILED' },
    { cf_payment_id: null },
  ]) {
    provider.settle(o.orderId, 'SUCCESS', override);
    await assert.rejects(
      pay.reconcile(o.orderId, u.id),
      (e) => e.statusCode === 409,
    );
    assert.equal(await count(o.orderId), 0);
  }
  provider.settle(o.orderId);
  assert.equal((await pay.reconcile(o.orderId, u.id)).status, 'paid');
});
test('renewals preserve legacy Pro/institute validity; monthly and annual extend one shared balance', async () => {
  const future = new Date(Date.now() + 10 * 86400000),
    u = await user('institute', future);
  let expected = +future;
  for (const code of ['PRO_MONTHLY', 'PRO_ANNUAL', 'PRO_MONTHLY']) {
    const o = await pay.create(u, input(code));
    provider.settle(o.orderId);
    const r = await pay.reconcile(o.orderId, u.id);
    expected += m.product(code).days * 86400000;
    assert.equal(+new Date(r.accessExpiresAt), expected);
    const stored = (
      await db.query('SELECT plan,plan_expires_at FROM users WHERE id=$1', [
        u.id,
      ])
    ).rows[0];
    assert.equal(stored.plan, 'institute');
    assert.equal(+stored.plan_expires_at, expected);
  }
  const focused = await user();
  let prior;
  for (let i = 0; i < 2; i++) {
    const o = await pay.create(focused, input('IT_EBOOK_PACK_99'));
    provider.settle(o.orderId);
    const r = await pay.reconcile(o.orderId, focused.id);
    if (prior)
      assert.equal(+new Date(r.accessExpiresAt) - prior, 60 * 86400000);
    prior = +new Date(r.accessExpiresAt);
  }
  // A pass is scoped: remaining ebook days do not extend an SSC pass.
  const s = await pay.create(focused, input());
  provider.settle(s.orderId);
  const r = await pay.reconcile(s.orderId, focused.id);
  assert.equal(
    +new Date(r.accessExpiresAt) - +new Date(r.paidAt),
    30 * 86400000,
  );
  const expired = await user('pro', '2000-01-01');
  const o = await pay.create(expired, input('PRO_MONTHLY'));
  provider.settle(o.orderId);
  const fresh = await pay.reconcile(o.orderId, expired.id);
  assert.equal(
    +new Date(fresh.accessExpiresAt) - +new Date(fresh.paidAt),
    30 * 86400000,
  );
});
test('settlement, history and previously paid access survive both sales switches being off', async () => {
  const u = await user(),
    o = await pay.create(u, input());
  provider.settle(o.orderId);
  process.env.MONETIZATION_ENABLED = 'false';
  process.env.MONETIZATION_CHECKOUT_ENABLED = 'false';
  try {
    assert.equal(
      (await call('/payments/orders/' + o.orderId, u)).json.data.status,
      'paid',
    );
    assert.equal((await call('/payments/orders', u)).status, 200);
    assert.equal((await call('/monetization/config')).json.data.checkout, null);
    assert.equal(await m.mockAccess(u, { id: 'ssc-cgl-2026-mock-01' }), true);
    await assert.rejects(
      pay.create(u, input('PRO_ANNUAL')),
      (e) => e.statusCode === 503,
    );
  } finally {
    process.env.MONETIZATION_ENABLED = 'true';
    process.env.MONETIZATION_CHECKOUT_ENABLED = 'true';
  }
});
test('real authentication and ownership protect status, receipts and history from ID substitution', async () => {
  const a = await user(),
    b = await user(),
    o = await pay.create(a, input());
  for (const path of [
    '/payments/orders',
    '/payments/orders/' + o.orderId,
    '/payments/orders/' + o.orderId + '/receipt',
  ])
    assert.equal((await call(path)).status, 401);
  for (const path of [
    '/payments/orders/' + o.orderId,
    '/payments/orders/' + o.orderId + '/receipt',
  ])
    assert.equal((await call(path, b)).status, 404);
  const own = await call('/payments/orders', a),
    other = await call('/payments/orders', b);
  assert.equal(own.headers.get('cache-control'), 'private, no-store');
  assert.equal(own.json.data.orders.length, 1);
  assert.equal(other.json.data.orders.length, 0);
  assert.doesNotMatch(
    JSON.stringify(own.json),
    /customer_phone|checkout_key|payment_session|synthetic-secret/,
  );
  const raw = JSON.stringify({
    type: 'PAYMENT_SUCCESS_WEBHOOK',
    data: {
      order: { order_id: o.orderId },
      payment: { payment_status: 'SUCCESS' },
    },
  });
  await call('/payments/webhook', null, 'POST', raw, signature(raw));
  assert.equal(
    await count(o.orderId),
    0,
    'even signed success events cannot override pending PG status',
  );
});
test('grant and paid status roll back together if payment ID uniqueness fails', async () => {
  const a = await user(),
    b = await user(),
    first = await pay.create(a, input()),
    second = await pay.create(b, input());
  const paymentId = crypto.randomUUID();
  provider.settle(first.orderId, 'SUCCESS', { cf_payment_id: paymentId });
  await pay.reconcile(first.orderId, a.id);
  provider.settle(second.orderId, 'SUCCESS', { cf_payment_id: paymentId });
  await assert.rejects(
    pay.reconcile(second.orderId, b.id),
    (e) => e.code === '23505',
  );
  assert.equal(await count(second.orderId), 0);
  assert.equal((await pay.ownOrder(second.orderId, b.id)).status, 'pending');
  assert.equal(await m.entitlement(b, 'SSC_PACK_49'), false);
});
test('history pagination never skips equal-timestamp orders and never includes another account', async () => {
  const u = await user();
  await db.query(
    "INSERT INTO monetization_orders(id,user_id,code,amount_inr,mode,created_at) SELECT 'ep_'||md5($1::text||n::text),$1::uuid,'SSC_PACK_49',49,'sandbox','2026-01-01T00:00:00.123456Z' FROM generate_series(1,55) n",
    [u.id],
  );
  const first = await pay.history(u.id),
    second = await pay.history(u.id, first.next);
  assert.equal(first.orders.length, 50);
  assert.equal(second.orders.length, 5);
  assert.equal(second.next, null);
  assert.equal(
    new Set([...first.orders, ...second.orders].map((o) => o.orderId)).size,
    55,
  );
});
