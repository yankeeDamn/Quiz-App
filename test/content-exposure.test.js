'use strict';
process.env.NODE_ENV='test';
process.env.AUTH_SECRET='content-security-test-secret';
process.env.DATABASE_URL='postgresql://disposable-test.invalid/unused';
const test=require('node:test'), assert=require('node:assert/strict');
const http=require('node:http'), jwt=require('jsonwebtoken');
const express=require('express');
const mocks=require('../src/services/mocks.service');
const db=require('../src/config/database');
const content=require('../src/services/content.service');
const practice=require('../src/services/practice-overrides.service');
const {question}=require('./fixtures/content');
const topic={id:'secure',name:'Synthetic practice',category:'Demo',active:true};
const rows=Array.from({length:5},(_,position)=>{
 const q=question('security-'+position,position);
 return {topic_id:topic.id,position,question:q.question,options:q.options,answer:q.answer,explanation:q.explanation,
  review_status:position===3?'draft':position===4?'reviewed':'published',
  reviewed_at:position===0?null:'2026-01-01',access_tier:position===2?'premium':'free'};
});
const definition=(id,tier,from,to,active=true)=>({id,name:'Synthetic '+id,exam:'Demo',minutes:10,marks_per_correct:1,negative_marks:0,pass_percent:70,level:'Practice',tier,active,sections:[{name:'Fixture',parts:[{topic:'secure',from,to}]}]});
const definitions=[definition('free','free',0,1),definition('pro','premium',1,3),definition('draft','free',3,5),definition('incomplete','free',0,5),definition('private-pro','premium',1,2,false)];
let server,base,plan='free';
test.before(async()=>{
 db.query=async(sql)=>{
  if(sql.includes('FROM mock_topics'))return {rows:[topic],rowCount:1};
  if(sql.includes('FROM mock_questions')){
   assert.match(sql,/review_status\s*=\s*'published'/,'public SQL must filter review status');
   return {rows:rows.filter(q=>q.review_status==='published'),rowCount:3};
  }
  if(sql.includes('FROM mock_tests'))return {rows:definitions};
  if(sql.includes('FROM users'))return {rows:[{id:'11111111-1111-4111-8111-111111111111',email:'free@example.com',name:'Fixture',image:null,plan,plan_expires_at:plan==='free'?null:new Date(Date.now()+60000),role:'user'}]};
  throw Error('Unexpected query in exposure test');
 };
 const app=express();app.use('/api/v1/mocks',require('../src/routes/mocks'));
 app.use((err,_req,res,_next)=>res.status(err.statusCode||500).json({error:'Internal test error'}));
 server=http.createServer(app);await new Promise(resolve=>server.listen(0,resolve));base=`http://127.0.0.1:${server.address().port}/api/v1/mocks`;
});
test.after(()=>new Promise(resolve=>server.close(resolve)));
const token=()=>jwt.sign({sub:'free',email:'free@example.com',name:'Fixture',image:null,provider:'google',emailVerified:true},process.env.AUTH_SECRET,{expiresIn:'1h'});
async function get(path,authorized=false){const r=await fetch(base+path,{headers:authorized?{Authorization:'Bearer '+token()}:{}});return {status:r.status,body:await r.json(),headers:r.headers};}
const noContent=body=>assert.doesNotMatch(JSON.stringify(body),/"(?:questions|question|options|answer|correctAnswer|correct_option|explanation)"/);
test('Pro detail refuses anonymous and DB-backed free accounts without any payload',async()=>{
 for(const signedIn of [false,true]){
  plan='free';const r=await get('/pro',signedIn);assert.equal(r.status,signedIn?403:401);noContent(r.body);
  assert.match(r.headers.get('cache-control'),/no-store/);
 }
});
test('published Pro detail is available to a running Pro plan but never carries keys',async()=>{
 plan='pro';const r=await get('/pro',true);assert.equal(r.status,200);
 assert.equal(r.body.data.test.questions.length,2);
 assert.doesNotMatch(JSON.stringify(r.body),/"(?:answer|correctAnswer|correct_option|explanation)"/);
 plan='free';
});
test('catalogue has no payload and excludes draft, private and incomplete definitions',async()=>{
 const r=await get('');assert.equal(r.status,200);noContent(r.body);
 const ids=r.body.data.tests.map(t=>t.id);assert.deepEqual(ids,['free','pro','topic-secure']);
 assert.equal(r.body.data.tests.find(t=>t.id==='free').underReview,true);
});
test('paid and shared paid ranges cannot leak through free topic practice',async()=>{
 const r=await get('/topic-secure/practice');assert.equal(r.status,200);
 assert.deepEqual(r.body.data.test.questions.map(q=>q.id),['secure:0']);
 assert.equal((await get('/pro/practice')).status,404);
 for(const id of ['draft','incomplete','private-pro'])assert.equal((await get('/'+id)).status,404);
});
test('editing published content invalidates review and publication',async t=>{
 let update;
 t.mock.method(db,'query',async(sql)=>{update=sql;return {rowCount:1,rows:[]};});
 await content.updateQuestion('id',{question:'Changed fixture',options:['a','b','c','d'],answer:0,explanation:'Changed',difficulty:'Easy'});
 assert.match(update,/review_status = 'draft'/);assert.match(update,/reviewed_at = NULL/);
});
test('public practice overrides/additions filter published and edits reset to draft',async t=>{
 const queries=[];t.mock.method(db,'query',async sql=>{queries.push(sql);return {rows:[]};});
 await practice.listOverrides();await practice.listAdditions();
 assert.ok(queries.every(sql=>sql.includes("WHERE review_status='published'")));
 queries.length=0;await practice.listOverrides({includeDrafts:true});assert.doesNotMatch(queries[0],/WHERE review_status/);
});
test('private seeds are optional and offline fallback contains only a nonsensitive public sample',async()=>{
 const old=process.env.PRIVATE_CONTENT_DIR;delete process.env.PRIVATE_CONTENT_DIR;
 try{
  const client={query:async()=>{throw Error('No seed writes without explicit private input');}};
  assert.equal((await require('../src/db/seed-content').seedStarterContent(client)).skipped,true);
  assert.equal((await require('../src/db/seed-competitive').seedCompetitiveContent(client)).skipped,true);
  assert.deepEqual(mocks.fromJson().mocks,[]);
  assert.equal(mocks.fromJson().topics.length,1);
 }finally{if(old!==undefined)process.env.PRIVATE_CONTENT_DIR=old;}
});


test('human review is required before publishing; changing access returns question to draft',async t=>{
 const queries=[];t.mock.method(db,'query',async(sql,params)=>{queries.push({sql,params});return {rowCount:0,rows:[]};});
 const result=await content.reviewQuestion('id','published','free','owner@example.com');
 assert.equal(result.ok,false);
 assert.match(queries[0].sql,/review_status IN \('reviewed','published'\) AND reviewed_at IS NOT NULL/);
 assert.equal((await content.reviewQuestion('id','unknown','free','owner@example.com')).ok,false);
});

test('publication gate rejects unreviewed questions even when active',async t=>{
 t.mock.method(db,'query',async(sql)=>sql.includes('FROM mock_topics')?{rows:[topic]}:{rows:[rows[0]]});
 const result=await content.publicationReadiness({tier:'free',sections:[{name:'Fixture',parts:[{topic:'secure',from:0,to:1}]}]});
 assert.equal(result.ok,false);assert.match(result.error,/reviewed and published/);
});

test('review badges and report links have all three locales and contain the question ID',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const strings=fs.readFileSync(path.join(__dirname,'../exam-practice-pro/components/exampro/exam-language.tsx'),'utf8');
 assert.equal((strings.match(/underReview:/g)||[]).length,3);
 assert.equal((strings.match(/reportMistake:/g)||[]).length,3);
 const links=fs.readFileSync(path.join(__dirname,'../exam-practice-pro/components/shared/content-review.tsx'),'utf8');
 assert.match(links,/question ID \$\{questionId\}/);
 assert.doesNotMatch(links,/question\.question|question\.options|question\.answer/);
});
