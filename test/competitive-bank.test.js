'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const source = require('../src/data/competitive-questions-500.json');
const { GROUPS, makeCompetitiveBank, seedCompetitiveContent } = require('../src/db/seed-competitive');

test('500 questions are split into four exam groups and twenty distinct 25-question mocks', () => {
  const bank = makeCompetitiveBank();
  assert.equal(bank.topics.length, 4);
  assert.equal(bank.mocks.length, 20);
  assert.deepEqual(bank.topics.map(x => x.questions.length), [125, 125, 125, 125]);
  assert.equal(new Set(bank.topics.map(x => x.id)).size, 4);
  assert.equal(new Set(bank.mocks.map(x => x.id)).size, 20);
  assert.equal(source.questions.filter(q => q.source).length, 30);
  assert.equal(source.questions.filter(q => !q.source).length, 470);
  const ids = new Set();
  for (const mock of bank.mocks) {
    assert.equal(mock.level, 'Practice');
    assert.equal(mock.tier, 'free');
    assert.equal(mock.sections.length, 1);
    const part = mock.sections[0].parts[0];
    const topic = bank.topics.find(t => t.id === part.topic);
    assert.ok(topic, 'Mock references an existing topic');
    assert.equal(part.to - part.from, 25);
    assert.ok(part.from >= 0 && part.to <= topic.questions.length);
    for (let i = part.from; i < part.to; i++) {
      const key = topic.id + ':' + i;
      assert.ok(!ids.has(key), 'Every question appears in exactly one new 25-question mock');
      ids.add(key);
    }
  }
  assert.equal(ids.size, 500);
  assert.deepEqual(new Set(bank.mocks.map(x => x.exam)), new Set(['SSC', 'Banking', 'Railways']));
  for (const topic of bank.topics) {
    for (const q of topic.questions) {
      assert.equal(q.options.length, 4);
      assert.ok(q.answer >= 0 && q.answer <= 3);
      assert.ok(q.explanation.length >= 3);
    }
  }
});

test('seeding is additive, conflict safe, stages content inactive and never writes to old topics', async () => {
  const calls = [];
  const client = { query: async (sql, params) => { calls.push({sql, params}); return {rowCount: 1}; } };
  const result = await seedCompetitiveContent(client);
  assert.deepEqual(result, {topics: 4, questions: 500, mocks: 20, drafts: true});
  assert.equal(calls.length, 28);
  assert.ok(calls.every(x => /ON CONFLICT/i.test(x.sql)));
  assert.ok(calls.every(x => !/DELETE|TRUNCATE|DO UPDATE/i.test(x.sql)));
  assert.equal(calls.filter(x => /INSERT INTO mock_topics/i.test(x.sql)).length, 4);
  assert.equal(calls.filter(x => /INSERT INTO mock_questions/i.test(x.sql)).length, 4);
  assert.equal(calls.filter(x => /INSERT INTO mock_tests/i.test(x.sql)).length, 20);
  assert.ok(calls.filter(x => /INSERT INTO mock_topics|INSERT INTO mock_tests/i.test(x.sql))
    .every(x => /FALSE/i.test(x.sql)), 'All new topics/mocks must start unpublished');
  const topicIds = GROUPS.map(x => x.id);
  for (const call of calls) {
    if (/INSERT INTO mock_topics|INSERT INTO mock_questions/i.test(call.sql)) assert.ok(topicIds.includes(call.params[0]));
  }
  for (const call of calls.filter(x => /INSERT INTO mock_questions/i.test(x.sql))) {
    assert.equal(JSON.parse(call.params[1]).length, 125);
  }
  calls.length = 0;
  await seedCompetitiveContent(client);
  assert.equal(calls.length, 28, 're-run uses same guarded inserts');
});

test('invalid bank aborts before database changes', async () => {
  const client = {query: async () => { throw new Error('No writes should run'); }};
  await assert.rejects(seedCompetitiveContent(client, {questions: []}), /exactly 500/);
  const bad = structuredClone(source);
  bad.questions[2].options[0] = bad.questions[2].options[1];
  await assert.rejects(seedCompetitiveContent(client,bad), /Invalid answer\/options/);
});
