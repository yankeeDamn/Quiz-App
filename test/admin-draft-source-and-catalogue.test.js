'use strict';
process.env.NODE_ENV='test';
const test=require('node:test'),assert=require('node:assert/strict');
const db=require('../src/config/database');
const content=require('../src/services/content.service');
const diagnostics=require('../src/services/mock-publication-diagnostics.service');
const {question}=require('./fixtures/content');
function fixture(states=[true]){
 const topics=states.map((active,i)=>({id:'source-'+i,name:'Synthetic source '+i,category:'Banking',active}));
 const rows=topics.flatMap(t=>Array.from({length:3},(_,position)=>{
  const q=question(t.id+'-'+position,position);
  return {topic_id:t.id,position,question:q.question,options:q.options,answer:q.answer,explanation:q.explanation,
   active:true,review_status:'draft',reviewed_at:null,access_tier:'premium'};
 }));
 const definition={id:'generic-bank-draft',name:'Synthetic banking draft',exam:'Banking',minutes:12,
  marks_per_correct:1,negative_marks:0.25,pass_percent:50,level:'Practice',tier:'premium',active:false,
  sections:[{name:'Banking practice',parts:topics.map(t=>({topic:t.id,from:0,to:3}))}]};
 return {topics,rows,definition};
}
function mockSource(t,data){
 const reads=[];
 t.mock.method(db,'query',async(sql,params)=>{
  reads.push(sql);assert.match(sql,/^SELECT/,'private source builder must not mutate publication state');
  if(sql.includes('FROM mock_tests')){
   assert.match(sql,/active=false/);assert.deepEqual(params,[data.definition.id]);
   return {rows:data.definition.active?[]:[data.definition]};
  }
  if(sql.includes('FROM mock_topics'))return {rows:data.topics};
  if(sql.includes('FROM mock_questions'))return {rows:data.rows.filter(q=>q.active)};
  throw Error('Unexpected source read');
 });
 return reads;
}
for(const states of [[true],[false],[true,false],[true,true,false,false]]){
 test(`private draft supports ${states.length} existing active/inactive topics without changing public flags: ${states}`,async t=>{
  const data=fixture(states),before=structuredClone(data);const reads=mockSource(t,data);
  const exam=await content.buildDraftExam(data.definition.id);
  assert.equal(exam.questions.length,states.length*3);assert.equal(exam.underReview,true);
  assert.deepEqual(data,before);assert.equal(reads.length,3);
  assert.equal(new Set(exam.questions.map(q=>q.id)).size,exam.questions.length);
 });
}
test('published definitions remain ineligible for the private draft builder',async t=>{
 const data=fixture();data.definition.active=true;mockSource(t,data);
 assert.equal(await content.buildDraftExam(data.definition.id),null);
});
test('private draft rejects missing topics, retired positions, overlapping ranges and malformed sections',async t=>{
 let data=fixture([true,false]);mockSource(t,data);
 const removed=data.topics.pop();
 await assert.rejects(content.buildDraftExam(data.definition.id),e=>e.statusCode===409&&/missing source topics/.test(e.message));
 data.topics.push(removed);data.rows[0].active=false;
 await assert.rejects(content.buildDraftExam(data.definition.id),e=>e.statusCode===409&&/5 of 6/.test(e.message));
 data.rows[0].active=true;data.definition.sections[0].parts.push({...data.definition.sections[0].parts[0]});
 await assert.rejects(content.buildDraftExam(data.definition.id),e=>e.statusCode===409&&/appears more than once/.test(e.message));
 data.definition.sections=[{name:'Invalid'}];
 await assert.rejects(content.buildDraftExam(data.definition.id),e=>e.statusCode===409&&/question ranges/.test(e.message));
});
function diagnosticFixture(){
 const definition={id:'bank1',name:'Synthetic bank mock',exam:'Banking',minutes:24,marksPerCorrect:1,
  negativeMarks:0.25,passPercent:50,level:'Practice',tier:'premium',active:false,
  sections:[{name:'Banking practice',parts:[{topic:'bank-source',from:0,to:24}]}]};
 const topics=[{id:'bank-source',name:'Synthetic banking',active:true}];
 const rows=Array.from({length:24},(_,position)=>({topic_id:'bank-source',position,active:true,
  review_status:position<4?'published':'draft',reviewed_at:position<4?'2026-01-01':null,access_tier:'premium',
  question:'DO NOT EXPOSE STEM',options:['DO NOT EXPOSE OPTIONS'],answer:2,explanation:'DO NOT EXPOSE SOLUTION'}));
 return {definition,topics,rows};
}
test('publication checklist explains a 24-question mock with 4 ready and 20 unreviewed questions',()=>{
 const {definition,topics,rows}=diagnosticFixture();const result=diagnostics.describe(definition,topics,rows);
 assert.equal(result.expected,24);assert.equal(result.ready,4);assert.equal(result.unreviewed,20);assert.equal(result.unpublished,20);
 assert.equal(result.missing,0);assert.doesNotMatch(JSON.stringify(result),/DO NOT EXPOSE|"(?:question|options|answer|explanation)"/);
});
test('checklist counts missing/retired positions, inactive/missing topics and free-tier conflicts separately',()=>{
 const {definition,topics,rows}=diagnosticFixture();
 rows.pop();rows[0].active=false;definition.tier='free';topics[0].active=false;
 const r=diagnostics.describe(definition,topics,rows);
 assert.equal(r.missing,1);assert.equal(r.retired,1);assert.equal(r.tierMismatch,23);assert.equal(r.ready,0);assert.equal(r.topics[0].active,false);
 const missing=diagnostics.describe(definition,[],rows);assert.equal(missing.topics[0].exists,false);
});
test('publication diagnostic report is read-only and preserves the original publication gate',async t=>{
 const {definition,topics,rows}=diagnosticFixture();let checked=false;
 t.mock.method(content,'listTests',async()=>[definition]);
 t.mock.method(content,'publicationReadiness',async d=>{checked=true;assert.equal(d.id,'bank1');return {ok:false,error:'Every question must be reviewed and published first.'};});
 t.mock.method(db,'query',async(sql,params)=>{
  assert.match(sql,/^SELECT/);assert.deepEqual(params,[['bank-source']]);
  return {rows:sql.includes('FROM mock_topics')?topics:rows};
 });
 const r=await diagnostics.report('bank1');assert.equal(checked,true);assert.equal(r.canPublish,false);
 assert.equal(r.ready,4);assert.equal(r.blockers.length,1);assert.doesNotMatch(JSON.stringify(r),/DO NOT EXPOSE/);
 await assert.rejects(diagnostics.report('missing'),e=>e.statusCode===404);
});
