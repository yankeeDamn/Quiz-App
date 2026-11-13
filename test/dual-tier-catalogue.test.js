'use strict';
if(!globalThis.crypto)globalThis.crypto=require('node:crypto').webcrypto;
process.env.NODE_ENV='test';
process.env.AUTH_SECRET='dual-tier-fixture-secret';
process.env.ADMIN_EMAILS='owner@example.test';
process.env.ADMIN_API_KEY='test-key-dual-tier-at-least-32-characters';
process.env.DATABASE_URL='postgresql://disposable-test.invalid/unused';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const express=require('express'),jwt=require('jsonwebtoken');
const db=require('../src/config/database'),mocks=require('../src/services/mocks.service');
const content=require('../src/services/content.service'),exams=require('../src/services/exam-attempts.service');
const command=require('../src/services/admin-command-center.service');
const {question}=require('./fixtures/content');
const topics=[{id:'free-topic',name:'Free fixture',category:'Demo',active:true},{id:'paid-topic',name:'Paid fixture',category:'Demo',active:true}];
const questions=topics.flatMap(t=>Array.from({length:8},(_,position)=>{
 const q=question(t.id+'-'+position,position);
 return {topic_id:t.id,position,question:q.question,options:q.options,answer:q.answer,explanation:q.explanation,
  review_status:'published',reviewed_at:'2026-01-01',access_tier:t.id==='paid-topic'?'premium':'free'};
}));
const def=(id,tier,topic,active=true)=>({id,name:`Synthetic ${id} mock`,exam:'Demo',minutes:20,marks_per_correct:1,negative_marks:0.25,pass_percent:50,level:'Practice',tier,active,sections:[{name:'Fixture',parts:[{topic,from:0,to:8}]}]});
const definitions=[def('free-mock','free','free-topic'),def('paid-mock','premium','paid-topic'),def('alias-mock','pro','paid-topic'),def('draft-mock','premium','paid-topic',false)];
let server,base,plan='free',expired=false;
const owner='owner@example.test';
const token=(email=owner)=>jwt.sign({sub:email,email,name:'Fixture',provider:'google',emailVerified:true},process.env.AUTH_SECRET,{expiresIn:'1h'});
async function request(path,{email,method='GET',body,key}={}){
 const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(email?{Authorization:'Bearer '+token(email)}:{}),...(key?{'x-admin-key':process.env.ADMIN_API_KEY}:{})},body:body?JSON.stringify(body):undefined});
 return {status:r.status,body:await r.json(),headers:r.headers};
}
const noKeys=body=>assert.doesNotMatch(JSON.stringify(body),/"(?:answer|correctAnswer|explanation|correct_option)"/);
const noContent=body=>assert.doesNotMatch(JSON.stringify(body),/"(?:questions|question|options|answer|explanation)"/);
test.before(async()=>{
 db.query=async(sql)=>{
  if(sql.includes('FROM monetization_grants'))return {rows:[],rowCount:0};
  if(sql.includes('AS manual_grants'))return {rows:[{active:2,manual_grants:3}]};
  if(sql.includes('COUNT(*) FILTER (WHERE active)'))return {rows:[{published:3,drafts:1}]};
  if(sql.includes('AS submitted'))return {rows:[{submitted:9,accuracy:'62.5'}]};
  if(sql.includes('COUNT(q.id)'))return {rows:[{total:16,active:16,topics:2}]};
  if(sql.includes('FROM users'))return {rows:[{id:'11111111-1111-4111-8111-111111111111',email:owner,name:'Fixture',image:null,plan,plan_expires_at:new Date(Date.now()+(expired?-60000:60000)),role:'user'}],rowCount:1};
  if(sql.includes('FROM mock_topics'))return {rows:topics};
  if(sql.includes('FROM mock_questions'))return {rows:questions.filter(q=>q.review_status==='published')};
  if(sql.includes('FROM mock_tests'))return {rows:definitions};
  throw Error('Unexpected fixture query: '+sql);
 };
 const app=express();app.use(express.json());app.use('/mocks',require('../src/routes/mocks'));app.use('/admin',require('../src/routes/admin'));
 app.use((err,_req,res,_next)=>res.status(err.statusCode||500).json({error:err.message}));
 server=http.createServer(app);await new Promise(r=>server.listen(0,r));base=`http://127.0.0.1:${server.address().port}`;
});
test.after(()=>new Promise(r=>server.close(r)));

test('public catalogue lists both tiers and pro aliases with metadata only',async()=>{
 const r=await request('/mocks');assert.equal(r.status,200);noContent(r.body);
 const tests=r.body.data.tests;
 assert.ok(tests.some(t=>t.tier==='free'));assert.ok(tests.some(t=>t.isPro));
 assert.equal(tests.find(t=>t.id==='alias-mock').tier,'premium');
 assert.equal(tests.find(t=>t.id==='paid-mock').previewQuestionCount,5);
 assert.ok(!tests.some(t=>t.id==='draft-mock'));
 assert.match(r.headers.get('cache-control'),/no-store/);
});
test('paid detail, alias and exam-start require an active plan; expired plans fail closed',async()=>{
 for(const id of ['paid-mock','alias-mock']){
  plan='free';expired=false;
  let r=await request('/mocks/'+id);assert.equal(r.status,401);noContent(r.body);
  r=await request('/mocks/'+id,{email:owner});assert.equal(r.status,403);noContent(r.body);
  await assert.rejects(exams.start({id:'fixture',plan:'free'},id),/Pro plan required/);
  plan='pro';r=await request('/mocks/'+id,{email:owner});assert.equal(r.status,200);noKeys(r.body);assert.equal(r.body.data.test.questions.length,8);
  expired=true;r=await request('/mocks/'+id,{email:owner});assert.equal(r.status,403);noContent(r.body);
 }
 plan='free';expired=false;
 const free=await request('/mocks/free-mock');assert.equal(free.status,200);noKeys(free.body);
});
test('preview is fixed to five questions, never paginates, and releases only sample solutions on submission',async()=>{
 const first=await request('/mocks/paid-mock/preview');assert.equal(first.status,200);noKeys(first.body);
 const preview=first.body.data.preview;assert.equal(preview.questions.length,5);
 const next=await request('/mocks/paid-mock/preview?offset=5&limit=999&questionId=paid-topic:7');
 assert.deepEqual(next.body.data.preview.questions.map(q=>q.id),preview.questions.map(q=>q.id));
 const checked=await request('/mocks/paid-mock/preview/submit',{method:'POST',body:{version:preview.version,answers:[0,1,2,3,0]}});
 assert.equal(checked.status,200);assert.equal(checked.body.data.result.correct,5);
 assert.equal(checked.body.data.result.solutions.length,5);
 assert.ok(checked.body.data.result.solutions.every(s=>preview.questions.some(q=>q.id===s.id)));
 const invalid=await request('/mocks/paid-mock/preview/submit',{method:'POST',body:{version:preview.version,answers:[0,1,2,3,0,1]}});assert.equal(invalid.status,400);noKeys(invalid.body);
 const stale=await request('/mocks/paid-mock/preview/submit',{method:'POST',body:{version:'stale',answers:[0,1,2,3,0]}});assert.equal(stale.status,409);
 for(const id of ['draft-mock','free-mock','unknown'])assert.equal((await request(`/mocks/${id}/preview`)).status,404);
});
test('unpublication and loss of review immediately revoke public preview and full detail',async()=>{
 definitions[1].active=false;
 assert.equal((await request('/mocks/paid-mock/preview')).status,404);
 definitions[1].active=true;questions[8].reviewed_at=null;
 assert.equal((await request('/mocks/paid-mock/preview')).status,404);
 assert.equal((await request('/mocks/paid-mock')).status,404);
 questions[8].reviewed_at='2026-01-01';
});
test('command metrics and bulk preflight require a verified human admin',async()=>{
 for(const path of ['/admin/command-center','/admin/catalogue','/admin/tests/publication-candidates','/admin/tests/paid-mock/publication-checklist']){
  assert.equal((await request(path)).status,401);
  assert.equal((await request(path,{key:true})).status,403);
  assert.equal((await request(path,{email:'student@example.test'})).status,403);
 }
 const r=await request('/admin/command-center',{email:owner});assert.equal(r.status,200);noKeys(r.body);
 assert.equal(r.body.data.attempts.accuracy,62.5);assert.equal(r.body.data.plans.active,2);assert.equal(r.body.data.catalogue.pro,2);
 assert.match(r.headers.get('cache-control'),/private/);
});
test('question workflow rejects guests, ordinary accounts and API keys before any mutation',async()=>{
 const path='/admin/questions/11111111-1111-4111-8111-111111111111/workflow';
 assert.equal((await request(path,{method:'POST',body:{}})).status,401);
 assert.equal((await request(path,{method:'POST',key:true,body:{}})).status,403);
 assert.equal((await request(path,{method:'POST',email:'student@example.test',body:{}})).status,403);
});
test('admin live catalogue matches the public database catalogue, including topic tests and no protected payload',async()=>{
 const publicList=await request('/mocks');
 const adminList=await request('/admin/catalogue',{email:owner});
 assert.equal(adminList.status,200);noContent(adminList.body);
 assert.deepEqual(adminList.body.data.tests,publicList.body.data.tests);
 assert.ok(adminList.body.data.tests.some(t=>t.kind==='topic'));
 assert.ok(!adminList.body.data.tests.some(t=>t.id==='draft-mock'));
});
test('publication candidates report blockers without mutating content',async t=>{
 t.mock.method(content,'listTests',async()=>[{id:'ready',name:'Ready',active:false,exam:'Demo'},{id:'blocked',name:'Blocked',active:false,exam:'Demo'},{id:'live',active:true}]);
 t.mock.method(content,'publicationReadiness',async def=>def.id==='ready'?{ok:true}:{ok:false,error:'Review required'});
 const result=await command.candidates();
 assert.deepEqual(result.candidates.map(c=>[c.id,c.ready,c.blocker]),[['ready',true,null],['blocked',false,'Review required']]);
});
test('draft deletion blocks active tests, historical attempts and paid shared free questions',async t=>{
 for(const scenario of ['active','attempts','shared','safe']){
  const queries=[];
  t.mock.method(db,'getClient',async()=>({release(){},query:async(sql)=>{
   queries.push(sql);
   if(sql.includes('FROM mock_tests'))return {rows:[{id:'draft',active:scenario==='active',tier:'premium',sections:definitions[1].sections}]};
   if(sql.includes('FROM exam_attempts_v2'))return {rowCount:scenario==='attempts'?1:0,rows:[]};
   if(sql.includes('FROM mock_questions'))return {rows:scenario==='shared'?[{topic_id:'paid-topic',position:0}]:[]};
   return {rows:[],rowCount:1};
  }}));
  const result=await content.deleteDraftTest('draft');assert.equal(result.ok,scenario==='safe');
  assert.equal(queries.some(sql=>sql.startsWith('DELETE')),scenario==='safe');
 }
});
