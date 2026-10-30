'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const audit=require('../src/services/mock01-02-audit.service');
const gate=require('../src/services/draft-testing-gate');
const quality=require('../src/services/mock-quality.service');
const content=require('../src/services/content.service');
const readiness=require('../src/services/mock-release-readiness.service');
test('exact normalized and heuristic near-duplicate evidence is separated',()=>{
 const entry=(id,question)=>({id,question,options:['a','b','c','d'],answer:1,explanation:'A complete reviewer explanation is present.',academicStatus:'pending',hindiStatus:'pending',hindiRequired:true,stale:false});
 const a={testId:audit.IDS[0],expected:2,actual:2,entries:[entry('a1','How can a train arrive safely?'),entry('a2','Find the square of thirteen')] ,academicApproved:0,hindiVerified:0,hindiRequired:2};
 const b={...a,testId:audit.IDS[1],entries:[entry('b1','HOW can a train arrive safely!'),entry('b2','How can a train arrive safely at the station?')]};
 const r=audit.analyze(a,b);
 assert.equal(r.exact.length,1);
 assert.equal(r.exact[0].mock02Id,'b1');
 assert.ok(r.nearCount>=1);
 assert.equal(r.mocks[0].complete,false);
 assert.equal(r.mocks[1].academicApproved,0);
});
test('empty, missing and invalid explanation/answers are reported',()=>{
 const a={testId:audit.IDS[0],expected:100,actual:1,academicApproved:0,hindiVerified:0,hindiRequired:1,
 entries:[{id:'q',question:'Test content?',options:['a','b'],answer:9,explanation:'',stale:true}]};
 const r=audit.analyze(a,{...a,testId:audit.IDS[1],entries:[]});
 assert.deepEqual(r.mocks[0].missingExplanation,['q']);
 assert.deepEqual(r.mocks[0].invalidAnswers,['q']);
 assert.equal(r.mocks[0].stale,1);
 assert.equal(r.mocks[0].complete,false);
});
test('private audit must refuse operation when staging gate is disabled',async()=>{
 const previous=gate.enabled;gate.enabled=()=>false;
 try{await assert.rejects(audit.report(),e=>e.statusCode===404);}
 finally{gate.enabled=previous;}
});
test('full report reads existing review and publication gates but cannot publish',async()=>{
 const original={enabled:gate.enabled,list:quality.list,listTests:content.listTests,report:readiness.report};
 gate.enabled=()=>true;
 const sample=id=>({testId:id,expected:100,actual:100,academicApproved:0,hindiRequired:75,hindiVerified:0,
 entries:Array.from({length:100},(_,i)=>({id:id+i,question:id+' distinct question '+i,options:['a','b','c','d'],answer:0,explanation:'This answer follows the stated facts.',stale:false}))});
 quality.list=async id=>sample(id);
 content.listTests=async()=>audit.IDS.map(id=>({id,active:false,minutes:60,marksPerCorrect:2,negativeMarks:0.5,
 sections:['Reasoning','General Awareness','Quant','English'].map((name,i)=>({name,parts:[{topic:'t'+i,from:0,to:25}]}))}));
 readiness.report=async()=>({editorialReady:false,technicalReady:false,publicationBlocker:'Topics inactive'});
 try{
  const result=await audit.report();
  assert.equal(result.releaseAuthorized,false);
  assert.equal(result.noWritesPerformed,true);
  assert.ok(result.structure.every(s=>s.valid&&s.draft));
  assert.equal(result.publication.length,2);
 }finally{gate.enabled=original.enabled;quality.list=original.list;content.listTests=original.listTests;readiness.report=original.report;}
});
test('route requires OAuth human reviewer and audit service has no mutation calls',()=>{
 const route=fs.readFileSync(path.join(__dirname,'../src/routes/admin.js'),'utf8');
 const src=fs.readFileSync(path.join(__dirname,'../src/services/mock01-02-audit.service.js'),'utf8');
 assert.match(route,/router\.get\('\/mock01-02\/audit',requireHumanReviewer/);
 assert.doesNotMatch(src,/INSERT INTO|UPDATE mock_tests|UPDATE mock_topics|DELETE FROM|\.stage\(/);
});
