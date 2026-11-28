'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { transition } = require('../src/services/publishing-lifecycle');
const now = Date.parse('2026-11-28T00:00:00Z');
test('schedule normalizes timezone and requires readiness', () => {
  const input = {current:'draft',target:'scheduled',publishAt:'2026-11-29T05:30:00+05:30',now,ready:true};
  assert.deepEqual(transition(input), {status:'scheduled',publishAt:'2026-11-29T00:00:00.000Z'});
  assert.throws(()=>transition({...input,ready:false}),/readiness/);
  assert.throws(()=>transition({...input,publishAt:'2026-11-29T05:30:00'}),/timezone/);
  assert.throws(()=>transition({...input,publishAt:'2026-11-27T00:00:00Z'}),/future/);
});
test('publication cannot bypass readiness or archive restoration', () => {
  assert.throws(()=>transition({current:'review',target:'published'}),/readiness/);
  assert.throws(()=>transition({current:'archived',target:'published',ready:true}),/transition/);
  assert.deepEqual(transition({current:'review',target:'published',ready:true}),{status:'published',publishAt:null});
});
test('cancel schedule and reject invalid state or unexpected timestamp', () => {
  assert.deepEqual(transition({current:'scheduled',target:'draft'}),{status:'draft',publishAt:null});
  assert.throws(()=>transition({current:'constructor',target:'draft'}),/transition/);
  assert.throws(()=>transition({current:'published',target:'draft',publishAt:'2026-11-29T00:00:00Z'}),/Only scheduled/);
});
