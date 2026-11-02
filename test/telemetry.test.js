'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  EVENTS,
  validateEvent,
  createTracker,
  analyticsUrl,
} = require('../exam-practice-pro/lib/track-policy');
const { scrubEvent, scrubSpan } = require('../src/telemetry/scrub');
test('tracking rejects unknown events and every non-catalogue property, including nested and disguised PII', () => {
  assert.equal(validateEvent('unknown', {}), null);
  for (const key of [
    'email',
    'name',
    'question',
    'Email',
    'user',
    'question_text',
    'score',
  ]) {
    for (const event of EVENTS)
      assert.equal(validateEvent(event, { [key]: 'private' }), null);
  }
  for (const props of [
    { test_id: 'learner@example.com' },
    { test_id: { email: 'private' } },
    { exam_slug: 'What is Python?' },
    { plan_name: 'Yankee' },
  ])
    assert.equal(validateEvent('mock_started', props), null);
  assert.equal(
    validateEvent('sign_in', Object.create({ email: 'hidden@example.com' })),
    null,
  );
  assert.equal(
    validateEvent(
      'sign_in',
      Object.defineProperty({}, 'email', { value: 'hidden@example.com' }),
    ),
    null,
  );
  assert.equal(
    validateEvent('sign_in', {
      get test_id() {
        throw Error('do not execute');
      },
    }),
    null,
  );
  assert.deepEqual(
    validateEvent('mock_started', {
      test_id: 'ssc-cgl-2026-mock-01',
      exam_slug: 'ssc-cgl',
    }),
    { test_id: 'ssc-cgl-2026-mock-01', exam_slug: 'ssc-cgl' },
  );
});
test('the tracker is a no-op on server/development and cannot break the user action if delivery fails', () => {
  const sent = [];
  const send = (...args) => sent.push(args);
  const server = createTracker(send, () => false);
  assert.equal(server('sign_in'), false);
  assert.equal(sent.length, 0);
  const production = createTracker(send, () => true);
  for (const event of EVENTS) assert.equal(production(event), true);
  production('mock_started', { email: 'no' });
  assert.equal(sent.length, 5);
  assert.equal(
    createTracker(
      () => {
        throw Error('blocked');
      },
      () => true,
    )('sign_in'),
    false,
  );
});
test('analytics strips search/hash/credentials, excludes private routes and normalizes dynamic and bad links', () => {
  assert.equal(
    analyticsUrl(
      'https://exampro.test/pricing?email=private@example.com#secret',
    ),
    'https://exampro.test/pricing',
  );
  for (const path of [
    '/auth/signin',
    '/admin',
    '/dashboard',
    '/api/v1/ebooks',
    '/bookmarks',
  ])
    assert.equal(analyticsUrl('https://exampro.test' + path), null);
  assert.equal(
    analyticsUrl(
      'https://exampro.test/india-mocks/sensitive-reference?attempt=abc',
    ),
    'https://exampro.test/india-mocks/[id]',
  );
  assert.equal(
    analyticsUrl('https://exampro.test/auth/complete?next=secret', true),
    'https://exampro.test/[activity]',
  );
  assert.equal(
    analyticsUrl('https://exampro.test/person@example.com'),
    'https://exampro.test/[other]',
  );
});
test('Sentry error and transaction scrubbers remove identity, cookies, bodies, free text and span data', () => {
  const raw = {
    event_id: 'technical-id',
    platform: 'node',
    user: {
      email: 'person@example.com',
      username: 'private-name',
      ip_address: '192.0.2.1',
    },
    request: {
      method: 'POST',
      url: 'https://exampro.test/api/v1/tests/private-id?token=secret',
      data: { question: 'private-question' },
      cookies: { session: 'private-cookie' },
      headers: { Cookie: 'private-cookie', Authorization: 'private-token' },
    },
    message: 'private-question',
    breadcrumbs: [{ message: 'private-cookie' }],
    extra: { email: 'person@example.com' },
    contexts: {
      response: { body: 'private-question' },
      trace: {
        trace_id: 'trace-id',
        span_id: 'span-id',
        data: { cookie: 'private-cookie' },
      },
    },
    exception: {
      values: [
        {
          type: 'TypeError',
          value: 'person@example.com private-name',
          stacktrace: {
            frames: [
              {
                filename: '/Users/private-name/app.js?token=secret',
                function: 'render',
                lineno: 42,
                vars: { email: 'person@example.com' },
              },
            ],
          },
        },
      ],
    },
    spans: [
      {
        op: 'http.client',
        description: 'private-question',
        data: { cookie: 'private-cookie' },
      },
    ],
  };
  const clean = scrubEvent(raw),
    serialized = JSON.stringify(clean);
  for (const value of [
    'person@example.com',
    'private-name',
    '192.0.2.1',
    'private-question',
    'private-cookie',
    'private-token',
    'private-id',
    'token=secret',
  ])
    assert.equal(serialized.includes(value), false, value);
  assert.equal(clean.exception.values[0].type, 'TypeError');
  assert.equal(clean.exception.values[0].stacktrace.frames[0].lineno, 42);
  assert.equal(clean.request.url, '/api/v1/tests/[parameter]');
  assert.equal(clean.contexts.trace.trace_id, 'trace-id');
  assert.deepEqual(
    scrubSpan({
      op: 'db',
      description: 'SELECT private',
      data: { cookie: 'no' },
    }),
    { op: 'db', description: 'db', data: {} },
  );
  assert.equal(raw.user.email, 'person@example.com');
});
test('the API boots with no SENTRY_DSN and readiness remains fail-closed without database settings', async (t) => {
  const prior = process.env.SENTRY_DSN;
  process.env.SENTRY_DSN = '';
  t.after(() => {
    if (prior === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = prior;
  });
  const database = require('../src/config/database');
  t.mock.method(database, 'isHealthy', async () => false);
  const app = require('../src/app');
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/v1/health`,
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.database, 'unavailable');
  assert.equal(require.cache[require.resolve('@sentry/node')], undefined);
});
