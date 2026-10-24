'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { categories, questions } = require('../src/data/exam-catalog');
const { publicBranding } = require('../src/data/branding');
test('starter questions have unique IDs, valid answers and explanations', () => {
 assert.ok(questions.length >= 25);
 assert.equal(new Set(questions.map(q=>q.id)).size,questions.length);
 for (const q of questions) {
  const c=categories.find(c=>c.id===q.categoryId);
  assert.ok(c && c.subjects.includes(q.subject));
  assert.equal(q.options.length,4);
  assert.ok(Number.isInteger(q.answerIndex) && q.answerIndex>=0 && q.answerIndex<4);
  assert.ok(q.explanation.length>8);
 }
});
test('branding only returns allowlisted keys', () => {
 const result=publicBranding({instituteName:'Demo',adminToken:'secret'});
 assert.equal(result.instituteName,'Demo');
 assert.equal('adminToken' in result,false);
});
