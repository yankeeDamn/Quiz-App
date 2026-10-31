'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const starter=require('../src/data/mock-bank.json');
const competitive=require('../src/data/competitive-questions-500.json');
const packs=require('../content/separate-exam-practice-starter.json');
const certs=require('../exam-practice-pro/data/it-certification-questions.json');
const {checkQuestion}=require('../src/services/content.service');
const {key}=require('../src/services/ssc-content-pipeline.service');
const families=['railways-rrb','banking-ibps','upsc-gs'];
const existing=[
 ...starter.topics.flatMap(t=>t.questions.map(q=>q.q||q.question)),
 ...competitive.questions.map(q=>q.q),
];
test('Railway Banking and UPSC packs are distinct and have twelve review-pending questions each',()=>{
 assert.deepEqual(Object.keys(packs),families);
 const seen=new Set(existing.map(key));
 for(const family of families){
  assert.equal(packs[family].length,12,family);
  for(const q of packs[family]){
   const result=checkQuestion(q);
   assert.equal(result.ok,true,q.question+': '+result.error);
   const stem=key(q.question);
   assert.equal(seen.has(stem),false,'Existing or duplicated stem: '+q.question);
   seen.add(stem);
   assert.equal(q.options.length,4);
   assert.ok(q.options[q.answer]);
  }
 }
});
test('IT certifications have unique IDs and at least eight additional questions across four families',()=>{
 const groups=new Map();
 const ids=new Set();
 for(const q of certs){
  assert.ok(!ids.has(q.id),'Duplicate ID: '+q.id);ids.add(q.id);
  const checked=checkQuestion({question:q.question,options:q.options,answer:'ABCD'.indexOf(q.correct_option),explanation:q.explanation,difficulty:'Moderate'});
  assert.equal(checked.ok,true,q.id+': '+checked.error);
  assert.equal(q.review_status,'needs_review','Do not mark computer-generated questions reviewed');
  groups.set(q.exam_code,(groups.get(q.exam_code)||0)+1);
 }
 assert.ok(groups.get('AZ-900')>=16);
 assert.ok(groups.get('AWS-CLF-C02')>=16);
 assert.equal(groups.get('CompTIA-A+'),16);
 assert.equal(groups.get('GCP-CDL'),8);
 assert.ok(certs.length>=56);
});
test('Certification and competitive practice questions contain no identical normalized new stems',()=>{
 const stems=[...Object.values(packs).flatMap(rows=>rows.map(q=>q.question)),...certs.map(q=>q.question)].map(key);
 assert.equal(new Set(stems).size,stems.length);
});
test('Mock 02 imported into staging is blocked if any existing Mock 01 question matches',()=>{
 const pipeline=require('../src/services/ssc-content-pipeline.service');
 const q={question:'A new reasoning question with known answer?',options:['First','Second','Third','Fourth'],answer:0,explanation:'The first option follows the stated condition.',difficulty:'Moderate'};
 const bank=Object.fromEntries(pipeline.sections.map(s=>[s,Array.from({length:25},(_,i)=>({...q,question:s+' unique constructed question '+i}))]));
 const first=bank.reasoning[0].question;
 const report=pipeline.inspect(2,bank,[first]);
 assert.equal(report.valid,false);
 assert.ok(report.issues.some(i=>/Duplicate question/.test(i.message)));
});
