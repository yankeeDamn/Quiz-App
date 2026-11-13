'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const raw=process.env.CONSUMER_TEST_DATABASE_URL;
if(!raw)throw Error('CONSUMER_TEST_DATABASE_URL required; disposable local database only');
const target=new URL(raw);
if(!['localhost','127.0.0.1','[::1]'].includes(target.hostname)||!/^\/consumer_tests(?:_[a-z0-9]+)?$/.test(target.pathname))throw Error('Only loopback consumer_tests databases permitted');
process.env.DATABASE_URL=raw;process.env.NODE_ENV='test';process.env.AUTH_SECRET='synthetic-consumer-auth-only';
process.env.GOVT_APPLICATION_ENCRYPTION_KEY=Buffer.alloc(32,42).toString('base64');
const express=require('express'),jwt=require('jsonwebtoken'),{randomUUID}=require('node:crypto'),db=require('../src/config/database');
const app=express();app.use(express.json({limit:'64kb'}));app.use('/user',require('../src/routes/bookmarks'));app.use('/applications',require('../src/routes/government-job-applications'));
app.use((err,_q,r,_n)=>r.status(err.statusCode||500).json({error:err.message}));
let server,base,application;
const emailA='synthetic-consumer-a@example.test',emailB='synthetic-consumer-b@example.test';
async function call(path,email=emailA,method='GET',body){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(email?{Authorization:'Bearer '+jwt.sign({sub:email,email,provider:'google',emailVerified:true},process.env.AUTH_SECRET,{expiresIn:'1h'})}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,headers:r.headers,json:await r.json()};}
async function ok(path,email,method,body,status=200){const r=await call(path,email,method,body);assert.equal(r.status,status,JSON.stringify(r.json));return r.json.data;}
test.before(async()=>{
 // Reuse exact table definitions; do not invoke seed/startup migration code.
 const source=fs.readFileSync('src/db/migrate.js','utf8');
 for(let n=0;n<2;n++){
  for(const table of ['users','bookmarks','notes']){const start=source.indexOf('CREATE TABLE IF NOT EXISTS '+table+' (');assert.ok(start>=0);const end=source.indexOf('\n);',start);assert.ok(end>start);await db.query(source.slice(start,end+3));}
  await db.query(fs.readFileSync('src/db/government-job-applications.sql','utf8'));
 }
 server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;
});
test.after(async()=>{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await db.end();});
test('consumer records require verified authentication and never permit public caching',async()=>{
 for(const path of ['/user/bookmarks','/user/notes','/applications']){
  const denied=await call(path,null);assert.equal(denied.status,401);
  const own=await call(path);assert.equal(own.status,200);assert.equal(own.headers.get('cache-control'),'private, no-store');
 }
});
test('bookmarks persist, concurrent saves are unique and another account cannot remove them',async()=>{
 const body={quizId:'synthetic-quiz',questionId:'synthetic-question',note:"'); DROP TABLE users; --",user_id:randomUUID()};
 const saved=await Promise.all([call('/user/bookmarks',emailA,'POST',body),call('/user/bookmarks',emailA,'POST',body)]);
 assert.ok(saved.every(r=>r.status===201));assert.equal(saved[0].json.data.id,saved[1].json.data.id);
 assert.equal((await ok('/user/bookmarks',emailA)).length,1);assert.equal((await ok('/user/bookmarks',emailA))[0].note,body.note);
 assert.equal((await ok('/user/bookmarks',emailB)).length,0);
 await ok('/user/bookmarks/synthetic-quiz/synthetic-question',emailB,'DELETE',undefined,404);
 await ok('/user/bookmarks',emailA,'POST',{...body,quizId:'x'.repeat(101)},400);
 await ok('/user/bookmarks',emailA,'POST',{...body,note:{private:true}},400);
 await ok('/user/bookmarks/synthetic-quiz/synthetic-question',emailA,'DELETE');assert.equal((await ok('/user/bookmarks',emailA)).length,0);
});
test('notes upsert only the verified account and reject oversized content without a database error',async()=>{
 const body={quizId:'synthetic-notes',questionId:'synthetic-question',content:'Synthetic private note'};
 const saved=await ok('/user/notes',emailA,'POST',body,201),updated=await ok('/user/notes',emailA,'POST',{...body,content:'Updated synthetic note'},201);assert.equal(saved.id,updated.id);
 assert.equal((await ok('/user/notes',emailA))[0].content,'Updated synthetic note');assert.equal((await ok('/user/notes',emailB)).length,0);
 await ok('/user/notes/synthetic-notes/synthetic-question',emailB,'DELETE',undefined,404);
 await ok('/user/notes',emailA,'POST',{...body,content:'x'.repeat(10001)},400);
 await ok('/user/notes/synthetic-notes/synthetic-question',emailA,'DELETE');assert.equal((await ok('/user/notes',emailA)).length,0);
});
test('job applications encrypt references, mask listings and deny cross-account ID substitution',async()=>{
 const body={title:'Synthetic recruitment notice',organisation:'Synthetic agency',category:'SSC',officialUrl:'https://ssc.gov.in/',status:'applied',applicationDate:'2026-11-12',deadline:'2026-12-12',reference:'SYNTHETIC-REFERENCE-1234'};
 application=(await ok('/applications',emailA,'POST',body,201)).application;
 assert.equal(application.referenceMasked,'••••1234');assert.equal(application.statusSource,'self_reported');assert.equal(application.reference,undefined);
 const row=(await db.query('SELECT reference_ciphertext FROM govt_job_applications WHERE id=$1',[application.id])).rows[0];assert.ok(row.reference_ciphertext);assert.equal(row.reference_ciphertext.includes(body.reference),false);
 assert.equal((await ok('/applications',emailA)).applications.length,1);assert.equal((await ok('/applications',emailB)).applications.length,0);
 assert.equal((await ok('/applications/'+application.id+'/reference',emailA)).reference,body.reference);
 await ok('/applications/'+application.id+'/reference',emailB,'GET',undefined,404);
 await ok('/applications/'+application.id,emailB,'PATCH',{status:'withdrawn'},404);
 await ok('/applications/'+application.id,emailB,'DELETE',undefined,404);
 await ok('/applications',emailB,'POST',{...body,user_id:randomUUID()},400);
 const updated=await ok('/applications/'+application.id,emailA,'PATCH',{status:'exam_completed',reference:null});assert.equal(updated.application.referenceMasked,null);
 assert.equal((await ok('/applications/'+application.id+'/reference',emailA)).reference,null);
});
test('missing encryption configuration fails closed and user foreign keys preserve ownership',async()=>{
 const key=process.env.GOVT_APPLICATION_ENCRYPTION_KEY;delete process.env.GOVT_APPLICATION_ENCRYPTION_KEY;
 try{await ok('/applications',emailA,'GET',undefined,503);await ok('/applications/'+application.id,emailA,'DELETE',undefined,503);}finally{process.env.GOVT_APPLICATION_ENCRYPTION_KEY=key;}
 await assert.rejects(db.query("INSERT INTO bookmarks(user_id,quiz_id,question_id) VALUES($1,'synthetic','synthetic')",[randomUUID()]),e=>e.code==='23503');
 await ok('/applications/'+application.id,emailA,'DELETE');assert.equal((await ok('/applications',emailA)).applications.length,0);
 assert.equal((await db.query('SELECT count(*)::int n FROM users')).rows[0].n,2);
});
