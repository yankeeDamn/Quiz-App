'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const content = require('../src/services/content.service');

const good = { question: 'What is 2 + 2?', options: ['3', '4', '5', '6'], answer: 1, explanation: 'Two plus two is four.' };

test('a good question passes and is trimmed', () => {
  const r = content.checkQuestion({ ...good, question: '  What is 2 + 2?  ' });
  assert.equal(r.ok, true);
  assert.equal(r.value.question, 'What is 2 + 2?');
});

test('bad questions are rejected with a reason', () => {
  const cases = [
    [{ ...good, options: ['3', '4', '5'] }, /four options/],
    [{ ...good, options: ['3', '4', '4', '6'] }, /different/],
    [{ ...good, options: ['3', '', '5', '6'] }, /Every option/],
    [{ ...good, answer: 4 }, /A, B, C or D/],
    [{ ...good, answer: 'x' }, /A, B, C or D/],
    [{ ...good, explanation: '' }, /Explanation/],
    [{ ...good, question: 'Hi' }, /Question must/],
    [null, /Question must/],
  ];
  cases.forEach(([input, re]) => {
    const r = content.checkQuestion(input);
    assert.equal(r.ok, false);
    assert.match(r.error, re);
  });
});

const test1 = {
  name: 'Custom Mock 1', exam: 'SSC', minutes: 30, marksPerCorrect: 2, negativeMarks: 0.5, level: 'Moderate', tier: 'premium',
  sections: [{ name: 'Maths', parts: [{ topic: 'percent', from: 0, to: 5 }] }],
};

test('a good test passes', () => {
  assert.equal(content.checkTest(test1, ['percent']).ok, true);
});

test('bad tests are rejected with a reason', () => {
  const topics = ['percent'];
  const cases = [
    [{ ...test1, tier: 'gold' }, /Tier/],
    [{ ...test1, minutes: 0 }, /Minutes/],
    [{ ...test1, negativeMarks: 3 }, /Negative/],
    [{ ...test1, sections: [] }, /sections/],
    [{ ...test1, sections: [{ name: 'X', parts: [{ topic: 'nope', from: 0, to: 3 }] }] }, /does not exist/],
    [{ ...test1, sections: [{ name: 'X', parts: [{ topic: 'percent', from: 5, to: 5 }] }] }, /range/],
    [{ ...test1, name: 'ab' }, /Name/],
  ];
  cases.forEach(([input, re]) => {
    const r = content.checkTest(input, topics);
    assert.equal(r.ok, false);
    assert.match(r.error, re);
  });
});
