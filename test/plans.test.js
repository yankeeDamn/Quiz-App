'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isPlanActive, nextExpiry, isPaidPlan } = require('../src/services/plan.service');

const now = new Date('2026-10-24T10:00:00Z');

test('free plan is never active', () => {
  assert.equal(isPlanActive('free', '2030-01-01T00:00:00Z', now), false);
  assert.equal(isPlanActive(undefined, null, now), false);
});

test('paid plan is active until it expires', () => {
  assert.equal(isPlanActive('pro', '2026-11-24T10:00:00Z', now), true);
  assert.equal(isPlanActive('pro', '2026-10-24T09:59:59Z', now), false);
  assert.equal(isPlanActive('pro', null, now), false);
  assert.equal(isPlanActive('institute', 'not a date', now), false);
});

test('only pro and institute count as paid', () => {
  assert.equal(isPaidPlan('pro'), true);
  assert.equal(isPaidPlan('institute'), true);
  assert.equal(isPaidPlan('admin'), false);
});

test('a first grant starts from today', () => {
  const end = nextExpiry(null, 3, now);
  assert.equal(end.toISOString(), '2027-01-24T10:00:00.000Z');
});

test('a renewal extends the running plan instead of losing days', () => {
  const end = nextExpiry('2026-11-10T00:00:00Z', 1, now);
  assert.equal(end.toISOString(), '2026-12-10T00:00:00.000Z');
});

test('an expired plan restarts from today', () => {
  const end = nextExpiry('2026-01-01T00:00:00Z', 1, now);
  assert.equal(end.toISOString(), '2026-11-24T10:00:00.000Z');
});
