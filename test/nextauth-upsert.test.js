'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/database');
const { upsertUser } = require('../src/middleware/nextauth');

function account(overrides = {}) {
  return {
    id: 'google-sub-123',
    provider: 'google',
    email: ' Learner@Example.COM ',
    name: 'Learner',
    image: 'https://example.com/avatar.png',
    ...overrides,
  };
}

test('concurrent new OAuth sign-ins use an atomic email conflict path', async (t) => {
  const statements = [];
  const canonicalRow = {
    id: 'shared-database-uuid',
    email: 'learner@example.com',
    role: 'user',
    plan: 'premium',
    plan_expires_at: '2026-12-01',
    provider: 'google',
    provider_id: 'google-sub-123',
  };
  t.mock.method(db, 'query', async (sql, params) => {
    statements.push({ sql, params });
    // Simulate both requests reading before the first INSERT commits.
    if (sql.startsWith('SELECT')) return { rows: [] };
    if (sql.startsWith('INSERT')) return { rows: [canonicalRow] };
    throw new Error('Unexpected SQL statement: ' + sql);
  });

  const [first, second] = await Promise.all([
    upsertUser(account()),
    upsertUser(account({ email: 'learner@example.com' })),
  ]);
  assert.equal(first.id, second.id);
  assert.equal(first.plan, 'premium');
  const inserts = statements.filter(s => s.sql.startsWith('INSERT'));
  assert.equal(inserts.length, 2);
  for (const { sql, params } of inserts) {
    assert.match(sql, /ON CONFLICT \(email\) DO UPDATE/);
    assert.match(sql, /RETURNING \*/);
    assert.equal(params[0], 'learner@example.com');
    assert.doesNotMatch(sql, /SET[^]*?role\s*=/);
    assert.doesNotMatch(sql, /SET[^]*?plan\s*=/);
    assert.doesNotMatch(sql, /SET[^]*?provider_id\s*=/);
  }
});

test('existing verified identity is updated without changing billing or roles', async (t) => {
  const existing = {
    id: 'existing-database-uuid',
    name: 'Old Name',
    image: null,
    role: 'admin',
    plan: 'premium',
    provider: 'google',
    provider_id: 'google-sub-123',
  };
  const updated = { ...existing, name: 'Learner', image: account().image };
  let updates = 0;
  t.mock.method(db, 'query', async (sql, params) => {
    if (sql.startsWith('SELECT')) {
      assert.equal(params[2], 'learner@example.com');
      return { rows: [existing] };
    }
    if (sql.startsWith('UPDATE')) {
      updates += 1;
      assert.match(sql, /WHERE id = \$3\s+RETURNING \*/);
      assert.equal(params[2], existing.id);
      return { rows: [updated] };
    }
    throw new Error('Existing account must not be reinserted');
  });
  const result = await upsertUser(account());
  assert.equal(updates, 1);
  assert.equal(result.id, existing.id);
  assert.equal(result.role, 'admin');
  assert.equal(result.plan, 'premium');
  assert.equal(result.name, 'Learner');
});

test('missing email cannot create an account', async (t) => {
  t.mock.method(db, 'query', async () => { throw new Error('database should not be called'); });
  await assert.rejects(upsertUser(account({ email: null })), /Verified email is required/);
});
