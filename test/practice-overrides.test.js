'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePracticeOverride } = require('../src/services/practice-overrides.service');

const home = {
  id:'aws-1',subject:'Cloud Computing',topic:'AWS Fundamentals',
  difficulty:'Easy',type:'single',question:'What is Amazon S3?',
  options:[{id:'a',text:'A compute service'},{id:'b',text:'Object storage'},{id:'c',text:'A database'},{id:'d',text:'A queue'}],
  correctAnswers:['b'], explanation:'Amazon S3 provides object storage.'
};
const cert = {
  id:'AZ900-001',exam_code:'AZ-900',subject:'Cloud Concepts',
  question:'Which of these is IaaS?',options:['Virtual machines','Serverless SQL','Email','None'],
  correct_option:'A',explanation:'Virtual machines are IaaS.'
};

test('preserves local homepage question IDs and answer formats', () => {
  assert.deepEqual(validatePracticeOverride('homepage','aws-1',home).correctAnswers,['b']);
  assert.throws(()=>validatePracticeOverride('homepage','aws-1',{...home,correctAnswers:['d','b']}),/Correct answers/);
  assert.deepEqual(validatePracticeOverride('homepage','aws-1',{...home,type:'multiple',correctAnswers:['b','d']}).correctAnswers,['b','d']);
});

test('checks two-option true/false questions', () => {
  const tf={...home,type:'true-false',options:[{id:'true',text:'True'},{id:'false',text:'False'}],correctAnswers:['false']};
  assert.equal(validatePracticeOverride('homepage','aws-1',tf).options.length,2);
  assert.throws(()=>validatePracticeOverride('homepage','aws-1',{...tf,correctAnswers:['true','false']}),/Correct answers/);
});

test('validates certification questions', () => {
  assert.equal(validatePracticeOverride('certification','AZ900-001',cert).correct_option,'A');
  assert.throws(()=>validatePracticeOverride('certification','AZ900-001',{...cert,correct_option:'X'}),/Certification questions/);
  assert.throws(()=>validatePracticeOverride('certification','other-id',cert),/ID must match/);
  assert.throws(()=>validatePracticeOverride('wrong','AZ900-001',cert),/source/);
});
