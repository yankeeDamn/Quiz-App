'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const bank = require('../src/data/mock-bank.json');
const { seedStarterContent } = require('../src/db/seed-content');

test('official starter bank has 10 topics, 120 unique questions and 11 mocks', () => {
  assert.equal(bank.topics.length, 10);
  assert.equal(bank.topics.reduce((sum, topic) => sum + topic.questions.length, 0), 120);
  assert.equal(bank.mocks.length, 11);
  assert.equal(new Set(bank.topics.map(t => t.id)).size, 10);
});

test('re-running seed remains conflict-safe, repairs missing starter rows and preserves edits', async () => {
  const queries = [];
  const client = { query: async (sql, args) => {
    queries.push({ sql, args });
    return { rows: [], rowCount: 1 };
  } };
  const result = await seedStarterContent(client);
  assert.deepEqual(result, { topics: 10, questions: 120, mocks: 11 });
  assert.equal(queries.length, 10 + 120 + 11);
  assert.ok(queries.every(q => /ON CONFLICT/.test(q.sql)), 'All inserts must be idempotent');
  assert.ok(queries.every(q => !/DO UPDATE|DELETE|TRUNCATE/i.test(q.sql)), 'Never overwrite owner edits');
  assert.equal(queries.filter(q => q.sql.includes('INTO mock_questions')).length, 120);
  queries.length = 0;
  await seedStarterContent(client);
  assert.equal(queries.length, 141, 'Repeat runs also check all starter rows');
});

test('invalid or incomplete starter bank aborts before touching database', async () => {
  const client = { query: async () => { throw new Error('unexpected write'); } };
  await assert.rejects(seedStarterContent(client, { topics: [], mocks: [] }), /Expected 10 topics and 120 questions/);
});
