'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { listMocks, getDefinition, buildMock, bank } = require('../src/services/mocks.service');

test('catalogue has 11 full mocks and 10 topic tests', () => {
  const tests = listMocks();
  assert.equal(tests.filter((t) => t.kind === 'mock').length, 11);
  assert.equal(tests.filter((t) => t.kind === 'topic').length, 10);
});

test('catalogue never carries questions or answers', () => {
  listMocks().forEach((t) => {
    assert.equal(t.questions, undefined);
    assert.ok(t.questionCount > 0);
  });
});

test('both free and premium mocks exist', () => {
  const mocks = listMocks().filter((t) => t.kind === 'mock');
  assert.ok(mocks.some((t) => t.tier === 'free'));
  assert.ok(mocks.some((t) => t.tier === 'premium'));
  assert.ok(listMocks().filter((t) => t.kind === 'topic').every((t) => t.tier === 'free'));
});

test('every question is well formed', () => {
  bank.topics.forEach((topic) => {
    topic.questions.forEach((q, i) => {
      const where = `${topic.id}:${i}`;
      assert.equal(q.options.length, 4, where);
      assert.equal(new Set(q.options).size, 4, `${where} has duplicate options`);
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4, where);
      assert.ok(q.explanation && q.explanation.length > 3, where);
    });
  });
});

test('a built mock matches its catalogue entry and sections cover every question', () => {
  listMocks().forEach((summary) => {
    const built = buildMock(getDefinition(summary.id));
    assert.equal(built.questions.length, summary.questionCount, summary.id);
    const covered = built.sections.reduce((n, s) => n + (s.to - s.from), 0);
    assert.equal(covered, built.questions.length, summary.id);
    assert.equal(new Set(built.questions.map((q) => q.id)).size, built.questions.length, `${summary.id} repeats a question`);
  });
});

test('unknown test ids return null', () => {
  assert.equal(getDefinition('nope'), null);
});
