'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const bank=require('../content/ssc-cgl-2026-mock-02.questions.json');
const existingStarter=require('../src/data/mock-bank.json');
const existingCompetitive=require('../src/data/competitive-questions-500.json');
const pipeline=require('../src/services/ssc-content-pipeline.service');
const contentService=require('../src/services/content.service');
const {eligible}=require('../src/services/ssc-section-timing');
const sections=['reasoning','general-awareness','quant','english'];
const existing=[
 ...existingStarter.topics.flatMap(t=>t.questions.map(q=>q.q||q.question)),
 ...existingCompetitive.questions.map(q=>q.q||q.question),
];
test('Mock 02 is exactly four SSC sections of 25 original candidate questions',()=>{
 assert.deepEqual(Object.keys(bank),sections);
 assert.equal(sections.reduce((sum,s)=>sum+bank[s].length,0),100);
 assert.ok(sections.every(s=>bank[s].length===25));
 const result=pipeline.inspect(2,bank,existing);
 assert.equal(result.valid,true,JSON.stringify(result.issues.slice(0,12)));
 assert.equal(result.canPublish,false);
 assert.equal(result.academicApproved,0);
 assert.equal(result.hindiVerified,0);
 assert.equal(result.hindiRequired,75);
});
test('each answer key and detailed explanation passes existing production validation',()=>{
 for(const section of sections)for(const [index,row] of bank[section].entries()){
  const checked=contentService.checkQuestion(row);
  assert.equal(checked.ok,true,section+' question '+(index+1)+': '+checked.error);
  assert.ok(Number.isInteger(row.answer)&&row.answer>=0&&row.answer<=3);
  assert.ok(row.explanation.trim().length>=15);
  assert.ok(!Object.hasOwn(row,'hindiStatus'),'No auto-certified Hindi');
 }
});
test('keys are unique and every option contains distinct non-empty text',()=>{
 for(const section of sections)for(const row of bank[section]){
  assert.equal(new Set(row.options.map(v=>v.trim().toLowerCase())).size,4,row.question);
  assert.ok(row.options[row.answer]?.trim().length>0);
 }
 const stems=sections.flatMap(s=>bank[s].map(q=>pipeline.key(q.question)));
 assert.equal(new Set(stems).size,100);
});
test('bank cannot bypass academic, bilingual, and publication requirements',()=>{
 const r=pipeline.inspect(2,bank,existing);
 assert.equal(r.draftOnly,true);
 assert.equal(r.canPublish,false);
 assert.equal(r.hindiRequired,75);
 assert.ok(!sections.some(s=>bank[s].some(q=>q.hindiStatus==='verified'||q.academicStatus==='approved')));
});
test('bank follows official four-section timing and 60-minute marking pattern structurally',()=>{
 const sectionNames=['Reasoning','General Awareness','Quant','English'];
 const questions=sections.flatMap((s,index)=>bank[s].map((q,j)=>({
  id:s+':'+j,section:index,question:q.question,options:q.options,
 })));
 const mock={kind:'mock',exam:'SSC',name:'SSC CGL 2026 Mock 02',minutes:60,
  marksPerCorrect:2,negativeMarks:0.5,questions,
  sections:sectionNames.map((name,i)=>({name,from:i*25,to:(i+1)*25}))};
 assert.equal(eligible(mock),true);
});
