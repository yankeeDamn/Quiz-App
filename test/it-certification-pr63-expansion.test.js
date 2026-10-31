'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const questions=require('../exam-practice-pro/data/it-certification-questions.json');
const {checkQuestion}=require('../src/services/content.service');
const required={'AZ-900':26,'AWS-CLF-C02':26,'LINUX-LFCS':12};
test('AWS, Microsoft and Linux practice tracks have expanded candidate banks',()=>{
 for(const [code,n] of Object.entries(required))assert.equal(questions.filter(q=>q.exam_code===code).length,n);
});
test('all certification questions have distinct stems and structurally valid options, keys and explanations',()=>{
 const ids=new Set(),stems=new Set();
 for(const q of questions){
  assert.ok(!ids.has(q.id),'Duplicate ID '+q.id);ids.add(q.id);
  const normalized=q.question.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
  assert.ok(!stems.has(normalized),'Duplicate stem '+q.question);stems.add(normalized);
  assert.equal(q.review_status,'needs_review',q.id);
  assert.equal(checkQuestion({question:q.question,options:q.options,answer:'ABCD'.indexOf(q.correct_option),explanation:q.explanation,difficulty:'Moderate'}).ok,true,q.id);
 }
});
test('Linux LFCS bank is supplemental practice, never an official exam claim',()=>{
 const linux=questions.filter(q=>q.exam_code==='LINUX-LFCS');
 assert.ok(linux.some(q=>q.subject==='Storage'));
 assert.ok(linux.some(q=>q.subject==='Networking'));
 assert.ok(linux.some(q=>q.subject==='Users and Groups'));
});
