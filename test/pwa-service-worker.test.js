'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'exam-practice-pro', 'public', 'sw.js'), 'utf8');

/** Load sw.js in a sandbox and return a helper that dispatches fetch events. */
function loadWorker() {
  const listeners = {};
  const self = {
    location: { origin: 'https://exampro.test' },
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting: async () => {}, clients: { claim: async () => {} },
  };
  vm.runInNewContext(source, { self, URL, Response, caches: { open: async () => ({ put: async () => {} }), keys: async () => [], match: async () => undefined }, fetch: async () => new Response('ok') });
  return (url, method = 'GET') => {
    let responded = false;
    listeners.fetch({ request: { url, method }, respondWith: () => { responded = true; } });
    return responded;
  };
}

test('service worker never handles API, auth, admin, Cashfree, mutations or other origins', () => {
  const handles = loadWorker();
  for (const url of [
    'https://exampro.test/api/auth/session', 'https://exampro.test/api/v1/monetization/config',
    'https://exampro.test/admin', 'https://exampro.test/auth/login',
    'https://exampro.test/pricing', 'https://exampro.test/account/payments',
    'https://sdk.cashfree.com/js/v3/cashfree.js', 'https://api.example.com/api/v1/mocks',
  ]) assert.equal(handles(url), false, url);
  assert.equal(handles('https://exampro.test/', 'POST'), false);
});

test('service worker only serves the public shell pages, without query strings', () => {
  const handles = loadWorker();
  for (const p of ['/', '/india-mocks', '/certifications']) assert.equal(handles('https://exampro.test' + p), true, p);
  assert.equal(handles('https://exampro.test/india-mocks?exam=Railways'), false);
});
