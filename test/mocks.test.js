'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const svc = require('../src/services/mocks.service');
const content = require('../src/services/content.service');

const bank = svc.fromJson();
const listMocks = () => svc.listFromBank(bank);
const getDefinition = (id) => svc.allDefinitions(bank).find((d) => d.id === id) || null;
const buildMock = (def) => svc.build(bank, def);

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
    topic.questions.forEach((q) => {
      const r = content.checkQuestion({ question: q.q, options: q.options, answer: q.answer, explanation: q.explanation });
      assert.equal(r.ok, true, `${topic.id}:${q.position} ${r.error || ''}`);
    });
  });
});

test('a built mock matches its catalogue entry and sections cover every question', () => {
  listMocks().forEach((summary) => {
    const built = buildMock(getDefinition(summary.id));
    assert.equal(built.questions.length, summary.questionCount, summary.id);
    assert.ok(summary.questionCount > 0, summary.id);
    const covered = built.sections.reduce((n, s) => n + (s.to - s.from), 0);
    assert.equal(covered, built.questions.length, summary.id);
    assert.equal(new Set(built.questions.map((q) => q.id)).size, built.questions.length, `${summary.id} repeats a question`);
  });
});

test('unknown test ids return null', () => {
  assert.equal(getDefinition('nope'), null);
});

test('retired questions drop out of a test but keep the ids of the others', () => {
  const copy = { ...bank, topics: bank.topics.map((t) => ({ ...t, questions: t.questions.filter((q) => q.position !== 1) })) };
  const def = svc.allDefinitions(copy).find((d) => d.id === 'ssc1');
  const built = svc.build(copy, def);
  const original = buildMock(getDefinition('ssc1'));
  assert.equal(built.questions.length, original.questions.length - 9); // ssc1 has nine ranges and each includes position 1
  assert.ok(built.questions.every((q) => q.id !== 'reason:1'));
  assert.ok(built.questions.some((q) => q.id === 'reason:2'));
});
