'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const readiness=require('../src/services/mock-release-readiness.service');
const quality=require('../src/services/mock-quality.service');
const content=require('../src/services/content.service');
const fs=require('node:fs');
const path=require('node:path');
const id='ssc-cgl-2026-mock-01';
const definition={id,name:'SSC CGL Full Mock 01',exam:'SSC',active:false,sections:[]};
const original={listTests:content.listTests,list:quality.list,publication:content.publicationReadiness};
test.after(()=>{
 content.listTests=original.listTests;quality.list=original.list;content.publicationReadiness=original.publication;
});
function fixture({academic=0,hindi=0,stale=0,actual=100,publication=false}={}){
 content.listTests=async()=>[definition];
 quality.list=async()=>({
  expected:100,actual,academicApproved:academic,hindiRequired:75,hindiVerified:hindi,
  ready:actual===100&&academic===100&&hindi===75&&stale===0,
  entries:Array.from({length:actual},(_,i)=>({id:'q'+i,stale:i<stale})),
 });
 content.publicationReadiness=async()=>publication?{ok:true}:{ok:false,error:'Inactive topics: keep the draft private.'};
}
test('release report blocks unreviewed drafts without modifying data',async()=>{
 fixture();
 const r=await readiness.report(id);
 assert.equal(r.draft,true);
 assert.equal(r.technicalReady,false);
 assert.equal(r.editorialReady,false);
 assert.equal(r.academic.approved,0);
 assert.equal(r.hindi.verified,0);
 assert.equal(r.questions.actual,100);
 assert.equal(r.publicationPerformed,false);
 assert.equal(r.humanSignoffRequired,true);
 assert.ok(r.checks.find(c=>c.id==='publication'&&!c.passed));
});
test('complete reviews are insufficient while topics are inactive',async()=>{
 fixture({academic:100,hindi:75});
 const r=await readiness.report(id);
 assert.equal(r.editorialReady,true);
 assert.equal(r.technicalReady,false);
 assert.match(r.publicationBlocker,/Inactive topics/);
});
test('stale approvals and absent questions block readiness',async()=>{
 fixture({academic:100,hindi:75,stale:1,actual:99,publication:true});
 const r=await readiness.report(id);
 assert.equal(r.questions.missing,1);
 assert.equal(r.questions.stale,1);
 assert.equal(r.technicalReady,false);
 assert.equal(r.editorialReady,false);
});
test('all technical checks still require human signoff and do not publish',async()=>{
 fixture({academic:100,hindi:75,publication:true});
 const r=await readiness.report(id);
 assert.equal(r.technicalReady,true);
 assert.equal(r.humanSignoffRequired,true);
 assert.equal(r.publicationPerformed,false);
 assert.equal(r.draft,true);
});
test('missing or unrelated tests are rejected',async()=>{
 content.listTests=async()=>[];
 await assert.rejects(readiness.report(id),e=>e.statusCode===404);
 content.listTests=async()=>[{id:'practice-test',name:'Practice',exam:'SSC',sections:[]}];
 await assert.rejects(readiness.report('practice-test'),e=>e.statusCode===400);
});
test('summary endpoint requires human OAuth reviewer; view never offers publish',()=>{
 const routes=fs.readFileSync(path.resolve(__dirname,'../src/routes/admin.js'),'utf8');
 assert.match(routes,/router\.get\('\/tests\/:id\/release-readiness',requireHumanReviewer/);
 const view=fs.readFileSync(path.resolve(__dirname,'../exam-practice-pro/components/admin/mock-release-readiness.tsx'),'utf8');
 assert.match(view,/publicationBlocker/);
 assert.doesNotMatch(view,/admin<.*>\([^)]*,\s*'PUT'/);
});
