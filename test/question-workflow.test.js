'use strict';
process.env.NODE_ENV='test';
const test=require('node:test'),assert=require('node:assert/strict');
const db=require('../src/config/database');
const workflow=require('../src/services/question-workflow.service');
const content=require('../src/services/content.service');
const fixture=()=>({id:'11111111-1111-4111-8111-111111111111',position:0,question:'Synthetic review: choose the first label.',
 options:['Label A','Label B','Label C','Label D'],answer:0,explanation:'Synthetic rationale: the first label is A.',difficulty:'Easy',active:true,
 review_status:'draft',reviewed_at:null,access_tier:'premium'});
function database(t,initial=fixture()){
 let row=structuredClone(initial);const queries=[];
 t.mock.method(db,'getClient',async()=>({release(){queries.push('RELEASE');},query:async(sql,params=[])=>{
  queries.push(sql);
  if(sql.startsWith('SELECT'))return {rows:row?[structuredClone(row)]:[],rowCount:row?1:0};
  if(sql.startsWith('UPDATE')){
   if(sql.includes('review_status=$2')){row.review_status=params[1];row.reviewed_at='2026-11-02T00:00:00Z';row.reviewed_by=params[2];}
   else if(sql.includes("review_status='published'"))row.review_status='published';
   else if(sql.includes("review_status='draft'")){row.review_status='draft';row.reviewed_at=null;row.reviewed_by=null;row.access_tier=params[1];}
   else if(sql.includes('SET active=$2'))row.active=params[1];
   return {rows:[structuredClone(row)],rowCount:1};
  }
  return {rows:[],rowCount:0};
 }}));
 return {row:()=>row,queries,setRow:value=>{row=value;}};
}
const command=(row,action,extra={})=>({action,revision:workflow.revision(row),...extra});
test('review-and-publish requires explicit human acknowledgement before opening a transaction',async t=>{
 const dbState=database(t),q=dbState.row();
 for(const acknowledged of [undefined,false,'true'])await assert.rejects(workflow.apply(q.id,command(q,'review_publish',{acknowledged}),'owner@example.test'),e=>e.statusCode===400);
 await assert.rejects(workflow.apply(q.id,command(q,'review_publish',{acknowledged:true}),null),e=>e.statusCode===403);
 assert.equal(dbState.queries.length,0);
});
test('a confirmed review and publication save atomically against the displayed revision',async t=>{
 const state=database(t),q=state.row(),oldRevision=workflow.revision(q);
 const result=await workflow.apply(q.id,command(q,'review_publish',{acknowledged:true}),'owner@example.test');
 assert.equal(result.question.review_status,'published');assert.ok(result.question.reviewed_at);assert.equal(state.row().reviewed_by,'owner@example.test');
 assert.notEqual(result.question.revision,oldRevision);assert.equal(state.queries.filter(s=>s.startsWith('UPDATE')).length,1);
 assert.ok(state.queries.find(s=>s.startsWith('SELECT')).includes('FOR UPDATE'));assert.ok(state.queries.includes('COMMIT'));
 assert.equal(state.row().access_tier,'premium');
});
test('review-only leaves a question ready and publishing preserves the recorded review',async t=>{
 const state=database(t),q=state.row();
 await workflow.apply(q.id,command(q,'review',{acknowledged:true}),'owner@example.test');
 assert.equal(state.row().review_status,'reviewed');const date=state.row().reviewed_at;
 const result=await workflow.apply(q.id,command(state.row(),'publish'),'another-owner@example.test');
 assert.equal(result.question.review_status,'published');assert.equal(result.question.reviewed_at,date);assert.equal(state.row().reviewed_by,'owner@example.test');
});
test('unreviewed legacy published content cannot bypass review with Publish',async t=>{
 const q=fixture();q.review_status='published';const state=database(t,q);
 await assert.rejects(workflow.apply(q.id,command(q,'publish'),'owner@example.test'),e=>e.statusCode===409&&/Review this question/.test(e.message));
 assert.ok(state.queries.includes('ROLLBACK'));assert.equal(state.queries.some(s=>s.startsWith('UPDATE')),false);
});
test('concurrent content, access, retirement and review changes reject the old displayed revision without a write',async t=>{
 for(const change of [q=>{q.answer=1;},q=>{q.question+=' Changed';},q=>{q.access_tier='free';},q=>{q.active=false;},q=>{q.review_status='reviewed';q.reviewed_at='2026-11-01';}]){
  const initial=fixture(),state=database(t,initial),input=command(initial,'review_publish',{acknowledged:true});change(state.row());
  await assert.rejects(workflow.apply(initial.id,input,'owner@example.test'),e=>e.statusCode===409&&/another window/.test(e.message));
  assert.equal(state.queries.some(s=>s.startsWith('UPDATE')),false);assert.ok(state.queries.includes('ROLLBACK'));
 }
});
test('changing access explicitly resets review; selecting unchanged access does not discard approval',async t=>{
 const q=fixture();q.review_status='published';q.reviewed_at='2026-01-01';const state=database(t,q);
 let result=await workflow.apply(q.id,command(q,'access',{tier:'premium'}),'owner@example.test');
 assert.equal(result.changed,false);assert.equal(result.question.review_status,'published');
 result=await workflow.apply(q.id,command(state.row(),'access',{tier:'free'}),'owner@example.test');
 assert.equal(result.question.access_tier,'free');assert.equal(result.question.review_status,'draft');assert.equal(result.question.reviewed_at,null);
});
test('retired questions need explicit restoration before review; retirement retains numbering and content',async t=>{
 const q=fixture();q.active=false;const state=database(t,q);
 await assert.rejects(workflow.apply(q.id,command(q,'review_publish',{acknowledged:true}),'owner@example.test'),/Restore this retired question/);
 await workflow.apply(q.id,command(state.row(),'restore'),'owner@example.test');assert.equal(state.row().active,true);
 await workflow.apply(q.id,command(state.row(),'retire'),'owner@example.test');assert.equal(state.row().active,false);
 assert.equal(state.row().position,q.position);assert.equal(state.row().question,q.question);assert.equal(state.queries.some(s=>s.startsWith('DELETE')),false);
});
test('invalid content and malformed workflow commands fail closed',async t=>{
 const q=fixture();q.options=['Same','Same','Third','Fourth'];const state=database(t,q);
 await assert.rejects(workflow.apply(q.id,command(q,'review_publish',{acknowledged:true}),'owner@example.test'),/options|different/);
 await assert.rejects(workflow.apply(q.id,{action:'approve_all',revision:workflow.revision(q)},'owner@example.test'),e=>e.statusCode===400);
 await assert.rejects(workflow.apply(q.id,command(q,'access',{tier:'admin'}),'owner@example.test'),e=>e.statusCode===400);
 assert.equal(state.queries.some(s=>s.startsWith('UPDATE')),false);
});
test('a vanished question cannot create a review record',async t=>{
 const state=database(t);const q=state.row();state.setRow(null);
 await assert.rejects(workflow.apply(q.id,command(q,'review_publish',{acknowledged:true}),'owner@example.test'),e=>e.statusCode===404);
 assert.equal(state.queries.some(s=>s.startsWith('UPDATE')),false);
});
test('admin question reads include opaque revisions that change when the reviewable version changes',async t=>{
 const q=fixture();t.mock.method(db,'query',async()=>({rows:[q]}));
 const rows=await content.listQuestions('synthetic-topic');assert.equal(rows[0].revision,workflow.revision(q));
 q.options=[...q.options].reverse();assert.notEqual(rows[0].revision,workflow.revision(q));
});
