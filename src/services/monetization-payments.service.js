'use strict';
const crypto = require('node:crypto');
const db = require('../config/database');
const m = require('./monetization.service');
const UUID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const ORDER = /^ep_[a-f0-9]{32}$/;

// Stopping new sales must never stop settlement of money already received.
function providerSettings() {
  const mode = process.env.MONETIZATION_CASHFREE_MODE;
  if (
    !['sandbox', 'production'].includes(mode) ||
    !process.env.MONETIZATION_CASHFREE_APP_ID ||
    !process.env.MONETIZATION_CASHFREE_SECRET
  ) {
    throw m.fail(
      'Online checkout is unavailable. Please contact support.',
      503,
    );
  }
  if (
    mode === 'sandbox' &&
    !['test', 'local', 'staging'].includes(process.env.APP_ENV)
  ) {
    throw m.fail('Sandbox payments require an isolated test environment', 503);
  }
  return {
    mode,
    base:
      mode === 'production'
        ? 'https://api.cashfree.com/pg'
        : 'https://sandbox.cashfree.com/pg',
  };
}
function settings() {
  const s = providerSettings();
  if (!m.enabled() || process.env.MONETIZATION_CHECKOUT_ENABLED !== 'true')
    throw m.fail('New purchases are temporarily unavailable', 503);
  if (
    s.mode === 'production' &&
    process.env.MONETIZATION_LIVE_PAYMENTS_ENABLED !== 'true'
  )
    throw m.fail('Live payments are disabled', 503);
  return {
    ...s,
    frontend: new URL(m.url(process.env.MONETIZATION_FRONTEND_ORIGIN)).origin,
    backend: new URL(m.url(process.env.MONETIZATION_API_ORIGIN)).origin,
  };
}
async function availability() {
  try {
    const s = settings();
    await db.query(
      'SELECT checkout_key,checkout_retry_keys,customer_phone,provider_payment_id FROM monetization_orders LIMIT 0',
    );
    return s.mode;
  } catch {
    return null;
  }
}
async function gateway(method, path, body) {
  const s = providerSettings();
  // Cashfree requires a UUID, stable for every retry of this provider order.
  const hex = body?.order_id?.slice(3);
  const key =
    hex &&
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  const r = await fetch(s.base + path, {
    method,
    signal: AbortSignal.timeout(12000),
    headers: {
      'Content-Type': 'application/json',
      'x-api-version': '2025-01-01',
      'x-client-id': process.env.MONETIZATION_CASHFREE_APP_ID,
      'x-client-secret': process.env.MONETIZATION_CASHFREE_SECRET,
      ...(body ? { 'x-idempotency-key': key } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!r.ok)
    throw m.fail(
      'Payment provider unavailable. Check this order before paying again.',
      r.status === 404 ? 404 : 502,
    );
  return r.json();
}
function receipt(row) {
  const p = m.product(row.code);
  return {
    orderId: row.id,
    code: row.code,
    plan: p.title,
    amountInr: row.amount_inr,
    currency: 'INR',
    validityDays: p.days,
    automaticRenewal: false,
    mode: row.mode,
    status: row.status,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    accessExpiresAt: row.access_expires_at || null,
  };
}
const RECEIPT_SQL = `SELECT o.*,o.created_at::text AS cursor_created_at,g.expires_at AS access_expires_at FROM monetization_orders o
 LEFT JOIN monetization_grants g ON g.reference='cashfree:'||o.id AND g.user_id=o.user_id`;
async function ownOrder(id, userId) {
  if (!ORDER.test(id) || !userId) throw m.fail('Unknown order', 404);
  const row = (
    await db.query(RECEIPT_SQL + ' WHERE o.id=$1 AND o.user_id=$2', [
      id,
      userId,
    ])
  ).rows[0];
  if (!row) throw m.fail('Unknown order', 404);
  return receipt(row);
}
async function history(userId, before) {
  if (!userId) throw m.fail('Sign in before viewing payments', 401);
  let cursor;
  if (before) {
    if (typeof before !== 'string' || before.length > 200)
      throw m.fail('Invalid history cursor');
    cursor = before.split('|');
    if (
      cursor.length !== 2 ||
      !Number.isFinite(Date.parse(cursor[0])) ||
      !ORDER.test(cursor[1])
    )
      throw m.fail('Invalid history cursor');
  }
  const rows = (
    await db.query(
      RECEIPT_SQL +
        ' WHERE o.user_id=$1' +
        (cursor ? ' AND (o.created_at,o.id)<($2::timestamptz,$3::text)' : '') +
        ' ORDER BY o.created_at DESC,o.id DESC LIMIT 51',
      cursor ? [userId, ...cursor] : [userId],
    )
  ).rows;
  return {
    orders: rows.slice(0, 50).map(receipt),
    next:
      rows.length > 50 ? rows[49].cursor_created_at + '|' + rows[49].id : null,
  };
}
function validateOrder(remote, local) {
  if (
    remote.order_id !== local.id ||
    remote.order_currency !== 'INR' ||
    Number(remote.order_amount) !== local.amount_inr ||
    remote.customer_details?.customer_id !== local.user_id
  ) {
    throw m.fail(
      'Payment details could not be verified. Contact support with your order ID.',
      409,
    );
  }
  if (m.product(local.code).amount !== local.amount_inr)
    throw m.fail('Order price mismatch', 409);
}
async function create(user, raw = {}) {
  const s = settings(),
    p = m.product(raw.code),
    resource = raw.resourceId || '';
  if (!user?.id || !user.email || user.id === 'guest')
    throw m.fail('Sign in before paying', 401);
  if (!UUID.test(raw.checkoutKey || ''))
    throw m.fail('A checkout retry key is required');
  if (!/^[6-9]\d{9}$/.test(raw.phone || ''))
    throw m.fail('Enter a valid Indian mobile number');
  await m.validateResource(user, raw.code, resource);
  // Commit the intent BEFORE contacting Cashfree. A crash can only resume it.
  const local = await m.transaction(async (c) => {
    await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      'checkout:' + user.id,
    ]);
    const keyed = (
      await c.query(
        'SELECT * FROM monetization_orders WHERE user_id=$1 AND (checkout_key=$2 OR $2::uuid=ANY(checkout_retry_keys))',
        [user.id, raw.checkoutKey],
      )
    ).rows[0];
    if (keyed) {
      if (
        keyed.code !== raw.code ||
        keyed.resource_id !== resource ||
        keyed.mode !== s.mode
      )
        throw m.fail('Checkout key already used for another purchase', 409);
      return keyed;
    }
    // Declined/dropped attempts still have a payable ACTIVE provider order.
    // Only provider-confirmed expiry/termination permits a new order.
    const existing = (
      await c.query(
        "SELECT * FROM monetization_orders WHERE user_id=$1 AND code=$2 AND resource_id=$3 AND mode=$4 AND status IN ('pending','failed','cancelled') ORDER BY created_at DESC LIMIT 1",
        [user.id, raw.code, resource, s.mode],
      )
    ).rows[0];
    if (existing) {
      // Remember cross-tab retry keys too, including if the response is lost
      // and payment settles before that tab retries its original request.
      await c.query(
        'UPDATE monetization_orders SET checkout_retry_keys=array_append(checkout_retry_keys,$2::uuid) WHERE id=$1',
        [existing.id, raw.checkoutKey],
      );
      return existing;
    }
    const id = 'ep_' + crypto.randomUUID().replaceAll('-', '');
    return (
      await c.query(
        `INSERT INTO monetization_orders(id,user_id,code,resource_id,amount_inr,mode,checkout_key,customer_phone)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [
          id,
          user.id,
          raw.code,
          resource,
          p.amount,
          s.mode,
          raw.checkoutKey,
          raw.phone,
        ],
      )
    ).rows[0];
  });
  if (local.status === 'paid') return ownOrder(local.id, user.id);
  if (['expired', 'terminated'].includes(local.status)) return receipt(local);
  let remote;
  try {
    remote = await gateway('GET', '/orders/' + local.id);
  } catch (e) {
    if (e.statusCode !== 404) throw e;
    if (!local.customer_phone)
      throw m.fail('This older order needs support reconciliation', 409);
    remote = await gateway('POST', '/orders', {
      order_id: local.id,
      order_amount: local.amount_inr,
      order_currency: 'INR',
      customer_details: {
        customer_id: user.id,
        customer_email: user.email,
        customer_phone: local.customer_phone,
      },
      order_meta: {
        return_url:
          s.frontend + '/account/payments?monetization_order={order_id}',
        notify_url: s.backend + '/api/v1/payments/webhook',
      },
    });
  }
  validateOrder(remote, local);
  if (remote.order_status !== 'ACTIVE') return reconcile(local.id, user.id);
  if (
    typeof remote.payment_session_id !== 'string' ||
    !remote.payment_session_id
  )
    throw m.fail('Invalid provider response', 502);
  return {
    ...receipt(local),
    paymentSessionId: remote.payment_session_id,
    mode: s.mode,
  };
}
function verify(raw, signature, timestamp) {
  providerSettings();
  if (
    !Buffer.isBuffer(raw) ||
    !/^\d{10,14}$/.test(timestamp || '') ||
    typeof signature !== 'string' ||
    signature.length > 128
  )
    throw m.fail('Invalid signature', 401);
  const expected = crypto
    .createHmac('sha256', process.env.MONETIZATION_CASHFREE_SECRET)
    .update(timestamp)
    .update(raw)
    .digest('base64');
  const a = Buffer.from(expected),
    b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b))
    throw m.fail('Invalid signature', 401);
  // No short freshness window: legitimate retries can be delayed. Independent
  // provider verification and durable unique references make replay harmless.
}
async function reconcile(id, userId) {
  if (!ORDER.test(id)) throw m.fail('Unknown order', 404);
  const local = (
    await db.query(
      'SELECT * FROM monetization_orders WHERE id=$1' +
        (userId ? ' AND user_id=$2' : ''),
      userId ? [id, userId] : [id],
    )
  ).rows[0];
  if (!local) throw m.fail('Unknown order', 404);
  if (local.status === 'paid') return ownOrder(id, local.user_id);
  if (local.mode !== providerSettings().mode)
    throw m.fail('Order environment mismatch', 409);
  const remote = await gateway('GET', '/orders/' + id);
  validateOrder(remote, local);
  const payments = await gateway('GET', '/orders/' + id + '/payments');
  if (!Array.isArray(payments))
    throw m.fail('Invalid provider payments response', 502);
  const success = payments.find(
    (p) =>
      p.payment_status === 'SUCCESS' &&
      p.order_id === id &&
      Number(p.payment_amount) === local.amount_inr &&
      p.payment_currency === 'INR' &&
      p.cf_payment_id,
  );
  if (remote.order_status === 'PAID' && !success)
    throw m.fail(
      'Successful payment is not yet verified. Recheck this order shortly.',
      409,
    );
  let status = 'pending';
  if (remote.order_status === 'PAID' && success) status = 'paid';
  else if (['EXPIRED', 'TERMINATED'].includes(remote.order_status))
    status = remote.order_status.toLowerCase();
  else if (
    !payments.some((p) =>
      ['PENDING', 'NOT_ATTEMPTED', 'SUCCESS'].includes(p.payment_status),
    )
  ) {
    const last = [...payments].sort(
      (a, b) =>
        Date.parse(b.payment_time || 0) - Date.parse(a.payment_time || 0),
    )[0];
    if (['USER_DROPPED', 'CANCELLED', 'VOID'].includes(last?.payment_status))
      status = 'cancelled';
    else if (last?.payment_status === 'FAILED') status = 'failed';
  }
  await m.transaction(async (c) => {
    const row = (
      await c.query(
        'SELECT * FROM monetization_orders WHERE id=$1 FOR UPDATE',
        [id],
      )
    ).rows[0];
    if (row.status === 'paid') return;
    if (status === 'paid') {
      await m.grant(
        c,
        row.user_id,
        row.code,
        row.resource_id,
        'cashfree:' + id,
        'cashfree:' + row.mode,
      );
      await c.query(
        "UPDATE monetization_orders SET status='paid',paid_at=now(),provider_payment_id=$2 WHERE id=$1",
        [id, String(success.cf_payment_id)],
      );
    } else
      await c.query('UPDATE monetization_orders SET status=$2 WHERE id=$1', [
        id,
        status,
      ]);
  });
  return ownOrder(id, local.user_id);
}
async function webhook(raw, signature, timestamp) {
  verify(raw, signature, timestamp);
  let event;
  try {
    event = JSON.parse(raw.toString('utf8'));
  } catch {
    throw m.fail('Malformed webhook');
  }
  if (
    ![
      'PAYMENT_SUCCESS_WEBHOOK',
      'PAYMENT_FAILED_WEBHOOK',
      'PAYMENT_USER_DROPPED_WEBHOOK',
    ].includes(event.type)
  )
    return { ignored: true };
  // Never grant from event fields: fetch both order AND payment from PG.
  return reconcile(event.data?.order?.order_id);
}
module.exports = {
  settings,
  providerSettings,
  availability,
  gateway,
  create,
  verify,
  reconcile,
  webhook,
  history,
  ownOrder,
};
