'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  REQUIRED_COLUMNS, MOCK_TOPICS, TABLES,
  confirmOperatorIntent, collectSnapshot, evaluateSnapshot,
} = require('../scripts/staging-release-preflight');

function fixture({ betaSchema = false, academicApproved = 0, hindiVerified = 0, activeMock = false, brokenTopic = false, failColumns = false, notReadOnly = false } = {}) {
  const history = [];
  const mockIds = Object.keys(MOCK_TOPICS);
  const topicIds = Object.values(MOCK_TOPICS).flat();
  return {
    history,
    async query(sql, params) {
      history.push({ sql, params });
      if (sql.startsWith('BEGIN') || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
      if (sql.includes('transaction_read_only')) return { rows: [{ read_only: notReadOnly ? 'off' : 'on' }] };
      if (sql.includes('to_regclass')) return {
        rows: TABLES.map(table => ({ table_name: table, present: betaSchema || !table.startsWith('exam_beta_') })),
      };
      if (sql.includes('information_schema.columns')) {
        if (failColumns) throw new Error('Simulated interrupted schema check');
        return {
          rows: betaSchema ? Object.entries(REQUIRED_COLUMNS).flatMap(([table, columns]) =>
            columns.map(column => ({ table_name: table, column_name: column }))) : [],
        };
      }
      if (sql.includes('FROM public.mock_tests')) return {
        rows: mockIds.map((id, i) => ({
          id, active: activeMock && i === 0, minutes: 60, marks_per_correct: '2.00', negative_marks: '0.5000',
        })),
      };
      if (sql.includes('FROM public.mock_topics')) return {
        rows: topicIds.map((id, i) => ({ id, active: false, question_count: brokenTopic && i === 0 ? 24 : 25 })),
      };
      if (sql.includes('FROM public.mock_question_reviews')) return {
        rows: mockIds.map(test_id => ({ test_id, review_rows: academicApproved, academic_approved: academicApproved, hindi_verified: hindiVerified })),
      };
      throw new Error('Unexpected SQL in read-only preflight: ' + sql);
    },
  };
}

test('refuses operator intent without explicit staging acknowledgement and connection', () => {
  assert.throws(() => confirmOperatorIntent({ EXAMPRO_ENV: 'production', STAGING_PREFLIGHT_BRANCH: 'exampro-staging', DATABASE_URL: 'postgres://localhost/db' }), /Refusing check/);
  assert.throws(() => confirmOperatorIntent({ EXAMPRO_ENV: 'staging', STAGING_PREFLIGHT_BRANCH: 'production', DATABASE_URL: 'postgres://localhost/db' }), /Refusing check/);
  assert.throws(() => confirmOperatorIntent({ EXAMPRO_ENV: 'staging', STAGING_PREFLIGHT_BRANCH: 'exampro-staging' }), /DATABASE_URL/);
  assert.doesNotThrow(() => confirmOperatorIntent({ EXAMPRO_ENV: 'staging', STAGING_PREFLIGHT_BRANCH: 'exampro-staging', DATABASE_URL: 'postgresql://localhost/staging' }));
});

test('missing beta schema and human review block release, but SSC drafts stay inactive', async () => {
  const client = fixture();
  const report = evaluateSnapshot(await collectSnapshot(client));
  assert.equal(report.status, 'BLOCKED');
  assert.equal(report.betaSchema.filter(table => !table.present).length, 3);
  assert.equal(report.mocks.length, 2);
  assert.ok(report.mocks.every(mock => mock.inactive && mock.topics.every(topic => topic.inactive && topic.questionCount === 25)));
  assert.ok(report.blockers.some(line => line.includes('exam_beta_invitations')));
  assert.ok(report.blockers.some(line => line.includes('100 academic')));
  assert.equal(report.publicationAuthorized, false);
  assert.equal(report.paymentActivationAuthorized, false);
  assert.match(client.history[0].sql, /READ ONLY/);
  assert.equal(client.history.at(-1).sql, 'COMMIT');
  assert.ok(client.history.slice(1, -1).every(call => call.sql.startsWith('SELECT')));
});

test('all schema and editorial counts still require independent manual signoff', async () => {
  const report = evaluateSnapshot(await collectSnapshot(fixture({ betaSchema: true, academicApproved: 100, hindiVerified: 75 })));
  assert.equal(report.betaSchema.every(table => table.present && table.missingColumns.length === 0), true);
  assert.equal(report.blockers.length, 0);
  assert.equal(report.status, 'MANUAL_SIGNOFF_REQUIRED');
  assert.equal(report.publicationAuthorized, false);
});

test('an active draft or incomplete section is a release blocker', async () => {
  const report = evaluateSnapshot(await collectSnapshot(fixture({ betaSchema: true, academicApproved: 100, hindiVerified: 75, activeMock: true, brokenTopic: true })));
  assert.equal(report.status, 'BLOCKED');
  assert.ok(report.blockers.some(line => line.includes('expected an inactive')));
  assert.ok(report.blockers.some(line => line.includes('contain 25 questions')));
});

test('schema failures and missing read-only mode roll back instead of continuing', async () => {
  for (const options of [{ failColumns: true }, { notReadOnly: true }]) {
    const client = fixture(options);
    await assert.rejects(collectSnapshot(client));
    assert.equal(client.history.at(-1).sql, 'ROLLBACK');
    assert.equal(client.history.some(call => call.sql === 'COMMIT'), false);
  }
});
