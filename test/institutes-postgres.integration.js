'use strict';
// A real PostgreSQL server is required. Fail closed before any connection/mutation.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const raw=process.env.INSTITUTE_TEST_DATABASE_URL;
if(!raw) throw Error('INSTITUTE_TEST_DATABASE_URL is required; use disposable local PostgreSQL');
const target=new URL(raw);
if(!['localhost','127.0.0.1','[::1]'].includes(target.hostname)||!/^\/institute_tests(?:_[a-z0-9]+)?$/.test(target.pathname)) throw Error('Only loopback institute_tests databases are permitted');
process.env.DATABASE_URL=raw;
process.env.NODE_ENV='test';
process.env.AUTH_SECRET='synthetic-institute-api-secret-only';
process.env.ADMIN_EMAILS='platform@example.test';
process.env.INSTITUTE_INVITATION_SECRET='synthetic-institute-invitation-secret-only';
const jwt=require('jsonwebtoken'),express=require('express'),{randomUUID}=require('node:crypto');
const db=require('../src/config/database');
const router=require('../src/routes/institutes');
const app=express();app.use('/api/v1/institute-billing',require('../src/routes/institute-billing-webhook'));app.use(express.json({limit:'128kb'}));app.use('/api/v1',router);app.use('/api/v1',require('../src/routes/monetization').router);
app.use((err,_req,res,_next)=>res.status(err.statusCode||500).json({error:err.message}));
app.use((_req,res)=>res.status(404).json({error:'Not found'}));
let server,base,A,B;
const token=email=>jwt.sign({sub:email,email,provider:'google',emailVerified:true},process.env.AUTH_SECRET,{expiresIn:'1h'});
async function call(path,email='platform@example.test',method='GET',body){
 const r=await fetch(base+'/api/v1'+path,{method,headers:{'Content-Type':'application/json',...(email?{Authorization:'Bearer '+token(email)}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.status,json:await r.json()};
}
async function user(email){await call('/institutes/my',email);return(await db.query('SELECT id FROM users WHERE email=$1',[email])).rows[0].id;}
async function createInstitute(slug,owner){
 const a=await call('/institutes/applications',owner,'POST',{name:slug,legalName:slug+' legal',slug});assert.equal(a.status,201,JSON.stringify(a.json));
 const r=await call('/platform/institutes/applications/'+a.json.data.id+'/review',undefined,'POST',{action:'approve'});assert.equal(r.status,200,JSON.stringify(r.json));return r.json.data.institute;
}
async function join(i,email,role,owner){
 const r=await call('/institutes/'+i.slug+'/invitations',owner,'POST',{email,role});assert.equal(r.status,201,JSON.stringify(r.json));
 const accepted=await call('/institutes/invitations/accept',email,'POST',{token:r.json.data.token});assert.equal(accepted.status,200,JSON.stringify(accepted.json));return user(email);
}
test.before(async()=>{
 await db.query(`CREATE TABLE IF NOT EXISTS users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),email text UNIQUE,name text,image text,provider text,provider_id text,role text DEFAULT 'user',payment_status text DEFAULT 'unpaid',plan text DEFAULT 'free',plan_expires_at timestamptz,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now())`);
 for(let n=0;n<2;n++) { await db.query(fs.readFileSync('src/db/pilot-schema.sql','utf8'));await db.query(fs.readFileSync('src/db/institute-foundation.sql','utf8'));await db.query(fs.readFileSync('src/db/institute-delivery.sql','utf8'));await db.query(fs.readFileSync('src/db/institute-reporting.sql','utf8'));await db.query(fs.readFileSync('src/db/institute-billing.sql','utf8'));await db.query(fs.readFileSync('src/db/monetization.sql','utf8'));await db.query(fs.readFileSync('src/db/advertising-verification.sql','utf8')); }
 server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;
});
test.after(async()=>{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await db.end();});
test('disabled flag and verified OAuth deny access without changing consumer plans',async()=>{
 delete process.env.INSTITUTES_ENABLED;assert.equal((await call('/institutes/my')).status,404);
 process.env.INSTITUTES_ENABLED='true';assert.equal((await call('/institutes/my',null)).status,401);
 const unverified=jwt.sign({sub:'guest',email:'guest@example.test',provider:'credentials',emailVerified:false},process.env.AUTH_SECRET);
 assert.equal((await fetch(base+'/api/v1/institutes/my',{headers:{Authorization:'Bearer '+unverified}})).status,403);
});
test('platform-reviewed onboarding binds owner to verified applicant, not body identity',async()=>{
 A=await createInstitute('synthetic-alpha','owner-a@example.test');B=await createInstitute('synthetic-beta','owner-b@example.test');
 assert.equal((await call('/platform/institutes/applications','owner-a@example.test')).status,403);
 assert.equal((await call('/institutes/'+A.slug+'/workspace','owner-a@example.test')).json.data.role,'owner');
 assert.equal((await call('/institutes/'+B.slug+'/workspace','owner-a@example.test')).status,404);
 const plans=(await db.query("SELECT plan,payment_status FROM users")).rows;assert.ok(plans.every(u=>u.plan==='free'&&u.payment_status==='unpaid'));
 await assert.rejects(db.query('UPDATE pilot_institutes SET slug=$2 WHERE id=$1',[A.id,'renamed-alpha']),e=>e.code==='23514');
});
test('two institutes have distinct teachers and ten students each',async()=>{
 for(const [i,letter] of [[A,'a'],[B,'b']]){
  i.teacher=await join(i,'teacher-'+letter+'@example.test','teacher','owner-'+letter+'@example.test');i.students=[];
  for(let n=0;n<10;n++)i.students.push(await join(i,`student-${letter}-${n}@example.test`,'student','owner-'+letter+'@example.test'));
  const w=await call('/institutes/'+i.slug+'/workspace','owner-'+letter+'@example.test');assert.equal(w.json.data.counts.students,10);
 }
});
test('invitations reject wrong email, tampering, reuse, revocation and unauthorized staff role',async()=>{
 const invite=await call('/institutes/'+A.slug+'/invitations','owner-a@example.test','POST',{email:'dual@example.test',role:'student'}),t=invite.json.data.token;
 assert.equal((await call('/institutes/invitations/accept','wrong@example.test','POST',{token:t})).status,404);
 assert.equal((await call('/institutes/invitations/accept','dual@example.test','POST',{token:t+'x'})).status,400);
 const both=await Promise.all([call('/institutes/invitations/accept','dual@example.test','POST',{token:t}),call('/institutes/invitations/accept','dual@example.test','POST',{token:t})]);assert.deepEqual(both.map(x=>x.status).sort(),[200,410]);
 await join(B,'dual@example.test','teacher','owner-b@example.test');
 const mine=await call('/institutes/my','dual@example.test');assert.deepEqual(mine.json.data.institutes.map(i=>i.role).sort(),['student','teacher']);
 const revoked=await call('/institutes/'+A.slug+'/invitations','owner-a@example.test','POST',{email:'revoked@example.test',role:'student'});
 assert.equal((await call('/institutes/'+A.slug+'/invitations/'+revoked.json.data.id+'/revoke','owner-a@example.test','POST',{})).status,200);
 assert.equal((await call('/institutes/invitations/accept','revoked@example.test','POST',{token:revoked.json.data.token})).status,410);
 assert.equal((await call('/institutes/'+A.slug+'/invitations','teacher-a@example.test','POST',{email:'escalation@example.test',role:'admin'})).status,403);
});
test('A cannot enumerate B students or target B resources through A routes',async()=>{
 const blocked=await call('/institutes/'+B.slug+'/members','owner-a@example.test');assert.equal(blocked.status,404);assert.equal(JSON.stringify(blocked).includes('student-b'),false);
 assert.equal((await call('/institutes/'+A.slug+'/members','student-a-0@example.test')).status,403);
 assert.equal((await call('/institutes/'+A.slug+'/members/'+B.students[0]+'/revoke','owner-a@example.test','POST',{institute_id:B.id})).status,404);
 assert.equal((await call('/institutes/'+A.slug+'/settings','teacher-a@example.test','PUT',{name:'hijack'})).status,403);
});
test('composite foreign keys reject cross-tenant questions, assignments and attempts; rollback preserves rows',async()=>{
 for(const i of [A,B]){
  i.bank=(await db.query('INSERT INTO pilot_question_banks(institute_id,title,exam_code,created_by) VALUES($1,$2,$3,$4) RETURNING id',[i.id,'Synthetic private bank','SYN',i.teacher])).rows[0].id;
  i.batch=(await db.query('INSERT INTO pilot_batches(institute_id,name) VALUES($1,$2) RETURNING id',[i.id,'Synthetic batch'])).rows[0].id;
  i.question=(await db.query("INSERT INTO pilot_questions(institute_id,bank_id,external_id,topic,difficulty,prompt,options,correct_option,explanation) VALUES($1,$2,'synthetic-q','arithmetic','Easy','Synthetic only','[\"one\",\"two\",\"three\",\"four\"]','A','Synthetic explanation') RETURNING id",[i.id,i.bank])).rows[0].id;
  i.exams=[];for(const status of ['draft','published'])i.exams.push((await db.query('INSERT INTO pilot_exams(institute_id,bank_id,title,duration_minutes,status) VALUES($1,$2,$3,10,$4) RETURNING id',[i.id,i.bank,'Synthetic '+status,status])).rows[0].id);
 }
 await assert.rejects(db.query('INSERT INTO pilot_exam_questions(institute_id,exam_id,question_id,position) VALUES($1,$2,$3,1)',[A.id,A.exams[0],B.question]),e=>e.code==='23503');
 await assert.rejects(db.query('INSERT INTO pilot_exam_assignments(institute_id,exam_id,batch_id) VALUES($1,$2,$3)',[A.id,A.exams[0],B.batch]),e=>e.code==='23503');
 await assert.rejects(db.query('INSERT INTO pilot_attempts(institute_id,exam_id,student_id) VALUES($1,$2,$3)',[A.id,A.exams[0],B.students[0]]),e=>e.code==='23503');
 const c=await db.getClient();try{await c.query('BEGIN');await c.query("INSERT INTO pilot_batches(institute_id,name) VALUES($1,'rollback-fixture')",[A.id]);await c.query('ROLLBACK');}finally{c.release();}
 assert.equal((await db.query("SELECT 1 FROM pilot_batches WHERE name='rollback-fixture'")).rowCount,0);
});
test('revocation and suspension invalidate subsequent requests; student-selected role cannot elevate',async()=>{
 assert.equal((await call('/institutes/'+A.slug+'/members/'+A.students[0]+'/revoke','owner-a@example.test','POST',{})).status,200);
 assert.equal((await call('/institutes/'+A.slug+'/workspace','student-a-0@example.test')).status,404);
 assert.equal((await call('/institutes/'+A.slug+'/workspace?role=owner&institute_id='+B.id,'dual@example.test')).json.data.role,'student');
 assert.equal((await call('/platform/institutes/'+B.id+'/lifecycle',undefined,'POST',{status:'suspended'})).status,200);
 assert.equal((await call('/institutes/'+B.slug+'/workspace','owner-b@example.test')).status,404);
 assert.equal((await call('/institutes/public/'+B.slug,null)).status,404);
 assert.equal((await call('/platform/institutes/'+B.id+'/lifecycle',undefined,'POST',{status:'active'})).status,200);
 const logs=(await db.query('SELECT action FROM pilot_audit_logs')).rows;assert.ok(logs.some(x=>x.action==='membership.revoked'));
});

const questionInput=(id='original')=>({external_id:id,topic:'Synthetic arithmetic',difficulty:'Easy',prompt:'Synthetic '+id+': select the first option',options:['First','Second','Third','Fourth'],correct_option:'A',explanation:'Synthetic private explanation',language:'en'});
const at=i=>'/institutes/'+i.slug;
async function expectCall(path,email,method,body,status=200){const r=await call(path,email,method,body);assert.equal(r.status,status,JSON.stringify(r.json));return r.json.data;}
function examInput(i,extra={}){return {bankId:i.deliveryBank,title:'Synthetic assigned exam',minutes:10,marksPerCorrect:2,negativeMarks:0.5,passPercent:50,startsAt:new Date(Date.now()-1000).toISOString(),endsAt:new Date(Date.now()+3600000).toISOString(),sections:[{name:'Section one',questionIds:[i.deliveryQ.id]},{name:'Section two',questionIds:[i.deliveryQ2.id]}],...extra};}
test('private teaching APIs create two reviewed banks, assigned batches and published snapshots',async()=>{
 process.env.INSTITUTE_DELIVERY_ENABLED='true';
 for(const [i,letter] of [[A,'a'],[B,'b']]) {
  const teacher=`teacher-${letter}@example.test`,owner=`owner-${letter}@example.test`;
  i.deliveryBank=(await expectCall(at(i)+'/banks',teacher,'POST',{title:'Synthetic private bank',examCode:'SYN'},201)).id;
  i.deliveryQ=await expectCall(at(i)+'/banks/'+i.deliveryBank+'/questions',teacher,'POST',questionInput('q1'),201);
  i.deliveryQ2=await expectCall(at(i)+'/banks/'+i.deliveryBank+'/questions',teacher,'POST',questionInput('q2'),201);
  i.deliveryBatch=(await expectCall(at(i)+'/batches',owner,'POST',{name:'Synthetic assigned batch'},201)).id;
  for(const id of i.students.slice(1))await expectCall(at(i)+'/batches/'+i.deliveryBatch+'/members/'+id,owner,'PUT',{role:'student'});
  await expectCall(at(i)+'/batches/'+i.deliveryBatch+'/members/'+i.teacher,owner,'PUT',{role:'teacher'});
  i.deliveryDraft=await expectCall(at(i)+'/exams',teacher,'POST',examInput(i),201);
  i.deliveryExam=await expectCall(at(i)+'/exams',teacher,'POST',examInput(i),201);
  await expectCall(at(i)+'/exams/'+i.deliveryExam.id+'/assignments',owner,'POST',{batchId:i.deliveryBatch});
  await expectCall(at(i)+'/exams/'+i.deliveryExam.id+'/publish',owner,'POST',{},409);
  for(const q of [i.deliveryQ,i.deliveryQ2])await expectCall(at(i)+'/questions/'+q.id+'/review',owner,'POST',{action:'approve'});
  await expectCall(at(i)+'/exams/'+i.deliveryExam.id+'/publish',owner,'POST',{});
  await expectCall(at(i)+'/exams/'+i.deliveryExam.id,teacher,'PUT',examInput(i),409);
 }
 assert.equal((await db.query('SELECT count(*)::int n FROM pilot_exams WHERE snapshot IS NOT NULL')).rows[0].n,2);
});
test('tenant and teacher boundaries deny banks, questions, versions, batches and assignments by substituted IDs',async()=>{
 await expectCall(at(A)+'/banks/'+B.deliveryBank+'/questions','owner-a@example.test','GET',undefined,404);
 await expectCall(at(A)+'/questions/'+B.deliveryQ.id,'owner-a@example.test','PUT',{...questionInput('q1'),institute_id:B.id},404);
 await expectCall(at(B)+'/questions/'+B.deliveryQ.id+'/versions','teacher-a@example.test','GET',undefined,404);
 await expectCall(at(A)+'/banks/'+A.deliveryBank+'/questions','student-a-1@example.test','GET',undefined,403);
 await expectCall(at(A)+'/batches/'+A.deliveryBatch+'/members/'+B.students[1],'owner-a@example.test','PUT',{role:'student'},404);
 await expectCall(at(A)+'/exams/'+A.deliveryDraft.id+'/assignments','owner-a@example.test','POST',{batchId:B.deliveryBatch},404);
 const privateBank=await expectCall(at(A)+'/banks','owner-a@example.test','POST',{title:'Owner restricted bank',examCode:'SYN'},201);
 await expectCall(at(A)+'/banks/'+privateBank.id+'/questions','teacher-a@example.test','GET',undefined,404);
 const own=await expectCall(at(A)+'/banks/'+privateBank.id+'/questions','owner-a@example.test','POST',questionInput('owner-question'),201);
 await expectCall(at(A)+'/questions/'+own.id+'/review','owner-a@example.test','POST',{action:'approve'},409);
});
test('CSV is atomic, preserves external IDs, detects reordered duplicate content and records versions',async()=>{
 const prefix=at(A)+'/banks/'+A.deliveryBank;
 const header='external_id,topic,difficulty,prompt,option_a,option_b,option_c,option_d,correct_option,explanation,language\n';
 const source=header+'csv-one,topic,Easy,"Synthetic, quoted prompt",one,two,three,four,A,"Line one\nline two",en\n';
 const imported=await expectCall(prefix+'/import','teacher-a@example.test','POST',{csv:source},201);assert.equal(imported.count,1);
 const before=(await db.query('SELECT count(*) n FROM pilot_questions WHERE bank_id=$1',[A.deliveryBank])).rows[0].n;
 const bad=header+'csv-new,topic,Easy,New synthetic prompt,one,two,three,four,A,Explanation,en\n'+'csv-one,topic,Easy,Other prompt,one,two,three,four,A,Explanation,en';
 await expectCall(prefix+'/import','teacher-a@example.test','POST',{csv:bad},409);
 assert.equal((await db.query('SELECT count(*) n FROM pilot_questions WHERE bank_id=$1',[A.deliveryBank])).rows[0].n,before);
 await expectCall(prefix+'/questions','teacher-a@example.test','POST',{...questionInput('q1'),external_id:'duplicate',options:['Fourth','Third','Second','First']},409);
 const versions=await expectCall(at(A)+'/questions/'+A.deliveryQ.id+'/versions','owner-a@example.test');assert.equal(versions.versions.length,2);
 assert.equal(versions.versions[1].content.external_id,'q1');
});
test('draft/private exams cannot be started through another tenant, role or caller-selected tenant ID',async()=>{
 await expectCall(at(B)+'/exams/'+B.deliveryExam.id+'/start','student-a-1@example.test','POST',{},404);
 await expectCall(at(A)+'/exams/'+B.deliveryExam.id+'/start','student-a-1@example.test','POST',{institute_id:B.id},404);
 await expectCall(at(A)+'/exams/'+A.deliveryDraft.id+'/start','student-a-1@example.test','POST',{},404);
 await expectCall(at(A)+'/exams/'+A.deliveryExam.id+'/start','teacher-a@example.test','POST',{},403);
 await expectCall(at(A)+'/exams/'+A.deliveryExam.id+'/start','dual@example.test','POST',{},404);
 const list=await expectCall(at(A)+'/assigned-exams','student-a-1@example.test');assert.equal(list.exams.length,1);
 assert.equal(JSON.stringify(list).includes('correct_option'),false);assert.equal(JSON.stringify(list).includes('Synthetic private explanation'),false);
});
test('concurrent starts create one attempt, never expose keys, and retain the original published question',async()=>{
 const started=await Promise.all([call(at(A)+'/exams/'+A.deliveryExam.id+'/start','student-a-1@example.test','POST',{}),call(at(A)+'/exams/'+A.deliveryExam.id+'/start','student-a-1@example.test','POST',{})]);
 assert.ok(started.every(x=>x.status===200),JSON.stringify(started));assert.equal(started[0].json.data.id,started[1].json.data.id);A.attempt=started[0].json.data;
 assert.equal(A.attempt.test.questions.length,2);assert.equal(A.attempt.result,null);assert.ok(new Date(A.attempt.deadlineAt)>new Date(A.attempt.serverNow));
 assert.equal(Object.hasOwn(A.attempt.test.questions[0],'answer'),false);assert.equal(JSON.stringify(A.attempt).includes('Synthetic private explanation'),false);
 await expectCall(at(A)+'/questions/'+A.deliveryQ.id,'teacher-a@example.test','PUT',{...questionInput('q1'),prompt:'Changed draft source after publication'});
 const reloaded=await expectCall(at(A)+'/attempts/'+A.attempt.id,'student-a-1@example.test');assert.equal(reloaded.test.questions[0].question,questionInput('q1').prompt);
 await assert.rejects(db.query("UPDATE pilot_exams SET snapshot='{}' WHERE id=$1",[A.deliveryExam.id]),e=>e.code==='23514');
 await assert.rejects(db.query("UPDATE pilot_attempts SET deadline_at=deadline_at+interval '1 hour' WHERE id=$1",[A.attempt.id]),e=>e.code==='23514');
});
test('autosave persists across refresh, rejects stale devices and ignores forged scores on idempotent submission',async()=>{
 const endpoint=at(A)+'/attempts/'+A.attempt.id,email='student-a-1@example.test';
 await expectCall(endpoint,email,'PUT',{revision:0,responses:{[B.deliveryQ.id]:0}},400);
 const answers={[A.deliveryQ.id]:0,[A.deliveryQ2.id]:1};
 const saves=await Promise.all([call(endpoint,email,'PUT',{revision:0,responses:answers}),call(endpoint,email,'PUT',{revision:0,responses:{}})]);
 assert.deepEqual(saves.map(x=>x.status).sort(),[200,409]);
 let reloaded=await expectCall(endpoint,email);assert.equal(reloaded.revision,1);
 reloaded=await expectCall(endpoint,email,'PUT',{revision:1,responses:answers});assert.deepEqual(reloaded.responses,answers);
 const submissions=await Promise.all([call(endpoint+'/submit',email,'POST',{revision:2,responses:answers,score:99999,result:{passed:true}}),call(endpoint+'/submit',email,'POST',{revision:2,responses:answers})]);
 assert.ok(submissions.every(x=>x.status===200),JSON.stringify(submissions));assert.deepEqual(submissions[0].json.data.result,submissions[1].json.data.result);
 assert.equal(submissions[0].json.data.result.score,1.5);assert.equal(submissions[0].json.data.result.total,4);assert.equal(submissions[0].json.data.result.review,undefined);
 assert.equal((await expectCall(endpoint,email,'PUT',{revision:999,responses:{}})).result.score,1.5);
 await assert.rejects(db.query('UPDATE pilot_attempts SET score=2 WHERE id=$1',[A.attempt.id]),e=>e.code==='23514');
});
test('only own results and assigned teacher batch reports are readable; removing membership revokes access',async()=>{
 const endpoint=at(A)+'/attempts/'+A.attempt.id;
 await expectCall(at(B)+'/attempts/'+A.attempt.id,'student-b-1@example.test','GET',undefined,404);
 await expectCall(endpoint,'student-a-2@example.test','GET',undefined,404);
 await expectCall(at(A)+'/batches/'+A.deliveryBatch+'/report','student-a-2@example.test','GET',undefined,403);
 await expectCall(at(A)+'/batches/'+B.deliveryBatch+'/report','teacher-a@example.test','GET',undefined,404);
 const report=await expectCall(at(A)+'/batches/'+A.deliveryBatch+'/report','teacher-a@example.test');assert.equal(report.attempts.length,1);assert.equal(report.attempts[0].result.review,undefined);
 await expectCall(at(A)+'/batches/'+B.deliveryBatch+'/members','teacher-a@example.test','GET',undefined,404);
 await expectCall(at(A)+'/batches/'+A.deliveryBatch+'/members','student-a-2@example.test','GET',undefined,403);
 await expectCall(at(B)+'/batches/'+B.deliveryBatch+'/members','dual@example.test','GET',undefined,404);
 assert.equal((await expectCall(at(A)+'/batches/'+A.deliveryBatch+'/members','teacher-a@example.test')).members.length,10);
 assert.equal((await expectCall(at(B)+'/results','student-b-1@example.test')).results.length,0);
 await expectCall(at(A)+'/members/'+A.students[1]+'/revoke','owner-a@example.test','POST',{});
 await expectCall(endpoint,'student-a-1@example.test','GET',undefined,404);
 assert.equal((await expectCall(at(A)+'/results','dual@example.test')).results.length,0);
 await expectCall(at(B)+'/results','dual@example.test','GET',undefined,403);
});
test('deadline uses database time; late answers are ignored and review unlocks only after the exam window',async()=>{
 // q1 was edited and must be reviewed again before another publication.
 await expectCall(at(A)+'/questions/'+A.deliveryQ.id+'/review','owner-a@example.test','POST',{action:'approve'});
 const e=await expectCall(at(A)+'/exams','teacher-a@example.test','POST',examInput(A,{endsAt:new Date(Date.now()+2000).toISOString()}),201);
 await expectCall(at(A)+'/exams/'+e.id+'/assignments','owner-a@example.test','POST',{batchId:A.deliveryBatch});
 await expectCall(at(A)+'/exams/'+e.id+'/publish','owner-a@example.test','POST',{});
 const a=await expectCall(at(A)+'/exams/'+e.id+'/start','student-a-2@example.test','POST',{});
 await new Promise(resolve=>setTimeout(resolve,Math.max(0,+new Date(a.deadlineAt)-Date.now()+50)));
 const expired=await expectCall(at(A)+'/attempts/'+a.id,'student-a-2@example.test','PUT',{revision:0,responses:{[A.deliveryQ.id]:0}});
 assert.ok(expired.submittedAt);assert.equal(expired.result.score,0);assert.equal(expired.result.skipped,2);assert.equal(expired.result.review.length,2);
 await expectCall(at(A)+'/exams/'+e.id+'/start','student-a-3@example.test','POST',{},409);
});

test('background expiry grades saved responses once even when a learner never returns',async()=>{
 const {finalizeExpired}=require('../src/services/institutes/expiry');
 const e=await expectCall(at(A)+'/exams','teacher-a@example.test','POST',examInput(A,{endsAt:new Date(Date.now()+2000).toISOString()}),201);
 await expectCall(at(A)+'/exams/'+e.id+'/assignments','owner-a@example.test','POST',{batchId:A.deliveryBatch});
 await expectCall(at(A)+'/exams/'+e.id+'/publish','owner-a@example.test','POST',{});
 const a=await expectCall(at(A)+'/exams/'+e.id+'/start','student-a-3@example.test','POST',{});
 await expectCall(at(A)+'/attempts/'+a.id,'student-a-3@example.test','PUT',{revision:0,responses:{[A.deliveryQ.id]:0}});
 // An ended membership cannot keep an existing started attempt pending indefinitely.
 await expectCall(at(A)+'/members/'+A.students[3]+'/revoke','owner-a@example.test','POST',{});
 assert.equal(await finalizeExpired(),0);
 await new Promise(resolve=>setTimeout(resolve,Math.max(0,+new Date(a.deadlineAt)-Date.now()+50)));
 const finalized=await Promise.all([finalizeExpired(),finalizeExpired()]);assert.equal(finalized.reduce((a,b)=>a+b,0),1);
 const result=(await db.query('SELECT * FROM pilot_attempts WHERE id=$1',[a.id])).rows[0];assert.equal(result.result.score,2);assert.equal(result.revision,2);assert.ok(result.submitted_at);
 assert.equal(await finalizeExpired(),0);
 assert.equal((await db.query("SELECT id FROM pilot_audit_logs WHERE resource_id=$1 AND action='attempt.expired_automatically'",[a.id])).rowCount,1);
 await expectCall(at(A)+'/attempts/'+a.id,'student-a-3@example.test','GET',undefined,404);
});
test('aggregate reports and CSV exports enforce assigned staff scope and exclude answer keys',async()=>{
 const endpoint=at(A)+'/batches/'+A.deliveryBatch;
 for(const suffix of ['/analytics','/export']){
  await expectCall(endpoint+suffix,'student-a-2@example.test','GET',undefined,403);
  await expectCall(at(A)+'/batches/'+B.deliveryBatch+suffix,'teacher-a@example.test','GET',undefined,404);
  await expectCall(at(B)+'/batches/'+B.deliveryBatch+suffix,'dual@example.test','GET',undefined,404);
 }
 const data=await expectCall(endpoint+'/analytics','teacher-a@example.test');
 assert.equal(data.summary.submitted,1);assert.equal(data.summary.students,7);assert.equal(data.summary.eligible_assignments,21);
 assert.equal(data.summary.completion_percentage,4.76);assert.equal(data.summary.average_percentage,0);
 assert.equal(data.performance.find(r=>r.kind==='topic').skipped,2);assert.equal(JSON.stringify(data).includes('correctAnswer'),false);
 await db.query('UPDATE users SET name=$2 WHERE id=$1',[A.students[2],'=HYPERLINK("https://example.test")']);
 const exported=await expectCall(endpoint+'/export','teacher-a@example.test');assert.equal(exported.count,1);assert.equal(exported.nextOffset,null);
 assert.ok(exported.csv.includes("'="));assert.ok(!exported.csv.includes('correctAnswer'));assert.ok(!exported.csv.includes('example.test,student-b'));
 await expectCall(endpoint+'/export?offset=-1','owner-a@example.test','GET',undefined,400);
 assert.equal((await expectCall(endpoint+'/export?offset=500','owner-a@example.test')).count,0);
 await db.query('DELETE FROM pilot_batch_teachers WHERE institute_id=$1 AND batch_id=$2 AND user_id=$3',[A.id,A.deliveryBatch,A.teacher]);
 await expectCall(endpoint+'/analytics','teacher-a@example.test','GET',undefined,404);
 assert.equal((await expectCall(endpoint+'/analytics','owner-a@example.test')).summary.submitted,1);
});

let billingOrder;
const billingPlan={code:'SYNTHETIC_TEST',name:'Synthetic fixture, not a public offer',amountPaise:12345,periodDays:30,active:true,limits:{students:9,teachers:1,batches:3,questions:6,monthlyAttempts:4}};
function configureBilling(){process.env.INSTITUTE_BILLING_ENABLED='true';process.env.APP_ENV='test';process.env.MONETIZATION_ENABLED='true';process.env.MONETIZATION_CASHFREE_MODE='sandbox';process.env.MONETIZATION_CASHFREE_APP_ID='synthetic-app';process.env.MONETIZATION_CASHFREE_SECRET='synthetic-secret-only';process.env.MONETIZATION_FRONTEND_ORIGIN='https://exampro-staging-ui.vercel.app';process.env.MONETIZATION_API_ORIGIN='https://exampro-staging-api.onrender.com';}
test('institute quotes require platform review and never trust buyer price, limits or tenant IDs',async()=>{
 await expectCall(at(A)+'/billing','owner-a@example.test','GET',undefined,404);configureBilling();
 await expectCall('/platform/institutes/billing/plans','owner-a@example.test','PUT',billingPlan,403);
 await expectCall('/platform/institutes/billing/plans',undefined,'PUT',billingPlan);
 billingOrder=await expectCall('/platform/institutes/'+A.id+'/billing/quotes',undefined,'POST',{planCode:billingPlan.code,amountPaise:1,institute_id:B.id},201);
 assert.equal(billingOrder.plan_snapshot.amountPaise,12345);
 await expectCall('/platform/institutes/'+A.id+'/billing/quotes',undefined,'POST',{planCode:billingPlan.code},409);
 await expectCall(at(A)+'/billing','teacher-a@example.test','GET',undefined,403);
 await expectCall(at(A)+'/billing','owner-b@example.test','GET',undefined,404);
 await expectCall(at(B)+'/billing/orders/'+billingOrder.id+'/checkout','owner-b@example.test','POST',{phone:'9999999999'},404);
 await assert.rejects(db.query('UPDATE pilot_billing_orders SET amount_paise=1 WHERE id=$1',[billingOrder.id]),e=>e.code==='23514');
 const status=await expectCall(at(A)+'/billing','owner-a@example.test');assert.equal(status.subscription,null);assert.equal(status.receipts.length,0);
});
test('provider-confirmed institute payment creates one subscription and receipt under concurrent retries',async()=>{
 const pay=require('../src/services/monetization-payments.service'),billing=require('../src/services/institutes/billing'),original=pay.gateway;
 const purchaser=(await db.query('SELECT requested_by FROM pilot_billing_orders WHERE id=$1',[billingOrder.id])).rows[0].requested_by;
 let amount=1,status='ACTIVE';
 pay.gateway=async(method,path,body)=>{if(method==='POST'){assert.equal(body.order_id,billingOrder.id);assert.equal(body.order_amount,123.45);assert.equal(body.customer_details.customer_id,purchaser);assert.match(body.order_meta.notify_url,/institute-billing\/webhook$/);return {order_id:body.order_id,payment_session_id:'synthetic-session'};}return {order_id:billingOrder.id,order_amount:amount,order_currency:'INR',order_status:status,customer_details:{customer_id:purchaser}};};
 try{
  const checkout=await expectCall(at(A)+'/billing/orders/'+billingOrder.id+'/checkout','owner-a@example.test','POST',{phone:'9999999999',amount:1,limits:{students:9999}});assert.equal(checkout.amountPaise,12345);
  await expectCall(at(A)+'/billing/orders/'+billingOrder.id+'/reconcile','owner-a@example.test','POST',{},409);
  amount=123.45;assert.equal((await expectCall(at(A)+'/billing/orders/'+billingOrder.id+'/reconcile','owner-a@example.test','POST',{})).status,'pending');
  const raw=Buffer.from(JSON.stringify({type:'PAYMENT_SUCCESS_WEBHOOK',data:{order:{order_id:billingOrder.id},payment:{payment_status:'SUCCESS'}}})),timestamp=String(Date.now());
  const signature=require('node:crypto').createHmac('sha256',process.env.MONETIZATION_CASHFREE_SECRET).update(timestamp).update(raw).digest('base64');
  const notify=signature=>fetch(base+'/api/v1/institute-billing/webhook',{method:'POST',headers:{'Content-Type':'application/json','x-webhook-signature':signature,'x-webhook-timestamp':timestamp},body:raw});
  assert.equal((await notify('forged')).status,401);
  status='PAID';const both=await Promise.all([notify(signature),call(at(A)+'/billing/orders/'+billingOrder.id+'/reconcile','owner-a@example.test','POST',{})]);assert.equal(both[0].status,200);assert.equal((await both[0].json()).data.status,'paid');assert.equal(both[1].status,200);
  assert.equal((await billing.webhook(raw,signature,timestamp)).status,'paid');
  const overview=await expectCall(at(A)+'/billing','owner-a@example.test');assert.equal(overview.receipts.length,1);assert.equal(overview.subscription.effectiveStatus,'active');assert.deepEqual(overview.subscription.limits,billingPlan.limits);
  assert.equal((await db.query('SELECT count(*)::int n FROM pilot_subscriptions WHERE institute_id=$1 AND billing_managed',[A.id])).rows[0].n,1);
  assert.ok((await db.query('SELECT plan,payment_status FROM users')).rows.every(u=>u.plan==='free'&&u.payment_status==='unpaid'));
  await assert.rejects(db.query('UPDATE pilot_billing_receipts SET amount_paise=1 WHERE order_id=$1',[billingOrder.id]),e=>e.code==='23514');
  await expectCall(at(A)+'/billing/cancel','owner-a@example.test','POST',{});assert.equal((await expectCall(at(A)+'/billing','owner-a@example.test')).subscription.effectiveStatus,'active');
 }finally{pay.gateway=original;}
});
test('quota checks serialize concurrent new usage and preserve reads and ongoing attempts',async()=>{
 process.env.INSTITUTE_QUOTAS_ENABLED='true';
 try{
  const invite1=await expectCall(at(A)+'/invitations','owner-a@example.test','POST',{email:'quota-one@example.test',role:'student'},201),invite2=await expectCall(at(A)+'/invitations','owner-a@example.test','POST',{email:'quota-two@example.test',role:'student'},201);
  const accepted=await Promise.all([call('/institutes/invitations/accept','quota-one@example.test','POST',{token:invite1.token}),call('/institutes/invitations/accept','quota-two@example.test','POST',{token:invite2.token})]);assert.deepEqual(accepted.map(x=>x.status).sort(),[200,409]);
  const batches=await Promise.all([call(at(A)+'/batches','owner-a@example.test','POST',{name:'Capacity one'}),call(at(A)+'/batches','owner-a@example.test','POST',{name:'Capacity two'})]);assert.deepEqual(batches.map(x=>x.status).sort(),[201,409]);
  const questions=await Promise.all([call(at(A)+'/banks/'+A.deliveryBank+'/questions','teacher-a@example.test','POST',questionInput('capacity-one')),call(at(A)+'/banks/'+A.deliveryBank+'/questions','teacher-a@example.test','POST',questionInput('capacity-two'))]);assert.deepEqual(questions.map(x=>x.status).sort(),[201,409]);
  const starts=await Promise.all([call(at(A)+'/exams/'+A.deliveryExam.id+'/start','student-a-4@example.test','POST',{}),call(at(A)+'/exams/'+A.deliveryExam.id+'/start','student-a-5@example.test','POST',{})]);assert.deepEqual(starts.map(x=>x.status).sort(),[200,409]);
  const winner=starts[0].status===200?4:5,attempt=starts.find(r=>r.status===200).json.data;
  assert.equal((await expectCall(at(A)+'/exams/'+A.deliveryExam.id+'/start',`student-a-${winner}@example.test`,'POST',{})).id,attempt.id);
  await expectCall(at(B)+'/batches','owner-b@example.test','POST',{name:'No subscription'},402);
  const unpaid=await expectCall('/platform/institutes/'+A.id+'/billing/quotes',undefined,'POST',{planCode:billingPlan.code},201);
  const c=await db.getClient();try{await c.query('BEGIN');await assert.rejects(c.query('INSERT INTO pilot_billing_receipts(institute_id,order_id,amount_paise,currency,mode,period_start,period_end) VALUES($1,$2,100,\'INR\',\'sandbox\',now(),now()+interval \'1 day\')',[B.id,unpaid.id]),e=>e.code==='23503');await c.query('ROLLBACK');}finally{c.release();}
  await db.query("UPDATE pilot_subscriptions SET current_period_end=now()-interval '1 second' WHERE institute_id=$1 AND billing_managed",[A.id]);
  assert.equal((await expectCall(at(A)+'/billing','owner-a@example.test')).subscription.effectiveStatus,'expired');
  await expectCall(at(A)+'/batches','owner-a@example.test','POST',{name:'After expiry'},402);
  await expectCall(at(A)+'/attempts/'+attempt.id,`student-a-${winner}@example.test`,'PUT',{revision:0,responses:{}});
  await expectCall(at(A)+'/attempts/'+attempt.id+'/submit',`student-a-${winner}@example.test`,'POST',{revision:1,responses:{}});
 }finally{delete process.env.INSTITUTE_QUOTAS_ENABLED;}
});

test('expired subscriptions renew from current time and unstarted quotes can be cancelled without deleting records',async()=>{
 const pay=require('../src/services/monetization-payments.service'),original=pay.gateway;
 const overview=await expectCall(at(A)+'/billing','owner-a@example.test'),order=overview.orders.find(o=>o.status==='quoted');
 assert.ok(order);const purchaser=(await db.query('SELECT requested_by FROM pilot_billing_orders WHERE id=$1',[order.id])).rows[0].requested_by;
 pay.gateway=async(method,path,body)=>method==='POST'?{order_id:body.order_id,payment_session_id:'synthetic-renewal'}:{order_id:order.id,order_amount:123.45,order_currency:'INR',order_status:'PAID',customer_details:{customer_id:purchaser}};
 try{
  await expectCall(at(A)+'/billing/orders/'+order.id+'/checkout','owner-a@example.test','POST',{phone:'9999999999'});
  await expectCall(at(A)+'/billing/orders/'+order.id+'/cancel-quote','owner-a@example.test','POST',{},409);
  await expectCall(at(A)+'/billing/orders/'+order.id+'/reconcile','owner-a@example.test','POST',{});
  const renewed=await expectCall(at(A)+'/billing','owner-a@example.test');assert.equal(renewed.subscription.effectiveStatus,'active');assert.equal(renewed.receipts.length,2);assert.equal(renewed.subscription.cancel_at_period_end,false);
  const replacement=await expectCall('/platform/institutes/'+A.id+'/billing/quotes',undefined,'POST',{planCode:billingPlan.code},201);
  await expectCall(at(A)+'/billing/orders/'+replacement.id+'/cancel-quote','owner-a@example.test','POST',{});
  assert.equal((await db.query('SELECT status FROM pilot_billing_orders WHERE id=$1',[replacement.id])).rows[0].status,'cancelled');
 }finally{pay.gateway=original;}
});

let adId,adPayment;
const adFixture={advertiserName:'Synthetic advertiser',contactEmail:'advertiser@example.test',whatsappNumber:'919999999999',slotType:'HOME_TOP_BANNER',targetCategory:'SSC',headline:'Synthetic booking only',subtext:'Not a real public advertisement',ctaLabel:'Learn more',destinationUrl:'https://example.test/synthetic',badgeText:'Sponsored',durationDays:7,paymentReference:'UNVERIFIED-SYNTHETIC'};
test('ad approval requires independently verified provider evidence, not a checkbox or consumer payment',async()=>{
 process.env.AD_PAYMENT_VERIFICATION_ENABLED='true';
 adId=(await expectCall('/ads/submit',null,'POST',{...adFixture,status:'active'},201)).id;
 await expectCall('/admin/monetization/ads/'+adId,'owner-a@example.test','POST',{action:'approve',paymentVerified:true},403);
 await expectCall('/admin/monetization/ads/'+adId,undefined,'POST',{action:'approve',paymentVerified:true},400);
 assert.equal((await expectCall('/ads',null)).ads.length,0);
 const pay=require('../src/services/monetization-payments.service'),original=pay.gateway;
 let bound=false;
 pay.gateway=async(method,path)=>{assert.equal(method,'GET');return {order_id:'synthetic-ad-order',order_status:'PAID',order_currency:'INR',order_amount:999,order_tags:bound?{exampro_ad_id:adId,exampro_purpose:'booking'}:{exampro_ad_id:B.id,exampro_purpose:'institute'}};};
 try{
  await expectCall('/admin/monetization/ads/'+adId+'/verify-payment',undefined,'POST',{orderId:'synthetic-ad-order',purpose:'booking'},409);
  bound=true;adPayment=await expectCall('/admin/monetization/ads/'+adId+'/verify-payment',undefined,'POST',{orderId:'synthetic-ad-order',purpose:'booking'});
  assert.equal((await expectCall('/admin/monetization/ads/'+adId+'/verify-payment',undefined,'POST',{orderId:'synthetic-ad-order',purpose:'booking'})).id,adPayment.id);
  const approvals=await Promise.all([call('/admin/monetization/ads/'+adId,undefined,'POST',{action:'approve',paymentId:adPayment.id}),call('/admin/monetization/ads/'+adId,undefined,'POST',{action:'approve',paymentId:adPayment.id})]);
  assert.ok(approvals.every(r=>r.status===200),JSON.stringify(approvals));assert.equal(approvals[0].json.data.expiresAt,approvals[1].json.data.expiresAt);
  assert.equal((await db.query("SELECT id FROM advertising_audit_logs WHERE ad_id=$1 AND action='ad.approve'",[adId])).rowCount,1);
  const publicAds=await expectCall('/ads',null);assert.equal(publicAds.ads.length,1);assert.doesNotMatch(JSON.stringify(publicAds),/contactEmail|paymentReference|verified_by/);
  process.env.APP_ENV='production';assert.equal((await expectCall('/ads',null)).ads.length,0);process.env.APP_ENV='test';
 }finally{pay.gateway=original;process.env.APP_ENV='test';}
});
test('ad analytics deduplicate sessions; pause/resume, verified renewal, rejection and deletion preserve evidence',async()=>{
 const sessionId=randomUUID();for(let n=0;n<2;n++)await expectCall('/ads/'+adId+'/track',null,'POST',{event:'impression',sessionId});
 assert.equal((await db.query("SELECT 1 FROM monetization_metrics WHERE kind='ad' AND id=$1",[adId])).rowCount,1);
 const paused=await expectCall('/admin/monetization/ads/'+adId,undefined,'POST',{action:'pause'});assert.equal((await expectCall('/ads',null)).ads.length,0);
 await expectCall('/ads/'+adId+'/track',null,'POST',{event:'click',sessionId},404);
 const resumed=await expectCall('/admin/monetization/ads/'+adId,undefined,'POST',{action:'resume'});assert.equal(resumed.expiresAt,paused.expiresAt);
 await expectCall('/admin/monetization/ads/'+adId,undefined,'POST',{action:'extend',paymentId:adPayment.id},409);
 const pay=require('../src/services/monetization-payments.service'),original=pay.gateway;
 pay.gateway=async()=>({order_id:'synthetic-ad-renewal',order_status:'PAID',order_currency:'INR',order_amount:999,order_tags:{exampro_ad_id:adId,exampro_purpose:'renewal'}});
 try{
  const renewal=await expectCall('/admin/monetization/ads/'+adId+'/verify-payment',undefined,'POST',{orderId:'synthetic-ad-renewal',purpose:'renewal'});
  const extended=await expectCall('/admin/monetization/ads/'+adId,undefined,'POST',{action:'extend',paymentId:renewal.id});assert.equal(Date.parse(extended.expiresAt)-Date.parse(resumed.expiresAt),7*86400000);
  assert.equal((await expectCall('/admin/monetization/ads/'+adId,undefined,'POST',{action:'extend',paymentId:renewal.id})).expiresAt,extended.expiresAt);
  await assert.rejects(db.query('UPDATE advertising_verified_payments SET amount_paise=1 WHERE id=$1',[renewal.id]),e=>e.code==='23514');
 }finally{pay.gateway=original;}
 await expectCall('/admin/monetization/ads/'+adId,undefined,'POST',{action:'delete'});
 assert.equal((await expectCall('/ads',null)).ads.length,0);assert.equal((await db.query('SELECT id FROM advertising_verified_payments WHERE ad_id=$1',[adId])).rowCount,2);
 const rejected=(await expectCall('/ads/submit',null,'POST',adFixture,201)).id;await expectCall('/admin/monetization/ads/'+rejected,undefined,'POST',{action:'reject'});
 assert.ok((await db.query('SELECT plan,payment_status FROM users')).rows.every(u=>u.plan==='free'&&u.payment_status==='unpaid'));
});

test('students receive private anonymized exam rankings only after the exam window closes',async()=>{
 const end=new Date(Date.now()+5000).toISOString(),e=await expectCall(at(A)+'/exams','teacher-a@example.test','POST',examInput(A,{endsAt:end}),201);
 await expectCall(at(A)+'/exams/'+e.id+'/assignments','owner-a@example.test','POST',{batchId:A.deliveryBatch});await expectCall(at(A)+'/exams/'+e.id+'/publish','owner-a@example.test','POST',{});
 const url=at(A)+'/exams/'+e.id+'/leaderboard';
 await expectCall(url,'student-a-4@example.test','GET',undefined,409);await expectCall(url,'teacher-a@example.test','GET',undefined,403);
 await expectCall(at(B)+'/exams/'+e.id+'/leaderboard','student-a-4@example.test','GET',undefined,404);
 const first=await expectCall(at(A)+'/exams/'+e.id+'/start','student-a-4@example.test','POST',{}),second=await expectCall(at(A)+'/exams/'+e.id+'/start','student-a-5@example.test','POST',{});
 await expectCall(at(A)+'/attempts/'+first.id+'/submit','student-a-4@example.test','POST',{revision:0,responses:{[A.deliveryQ.id]:0}});
 await expectCall(at(A)+'/attempts/'+second.id+'/submit','student-a-5@example.test','POST',{revision:0,responses:{[A.deliveryQ2.id]:3}});
 await new Promise(resolve=>setTimeout(resolve,Math.max(0,+new Date(end)-Date.now()+50)));
 const board=await expectCall(url,'student-a-4@example.test');assert.equal(board.ranking.participants,7);assert.equal(board.ranking.selfRank,1);assert.equal(board.ranking.leaders[0].label,'You');assert.equal(board.ranking.leaders[0].percentage,50);
 assert.equal(board.ranking.leaders.length,7);assert.equal(JSON.stringify(board).includes('student-a-5'),false);assert.equal(JSON.stringify(board).includes(A.students[4]),false);
 assert.equal((await expectCall(url,'student-a-5@example.test')).ranking.selfRank,2);
 await expectCall(url,'student-a-0@example.test','GET',undefined,404);
 assert.equal((await expectCall(at(A)+'/batches/'+A.deliveryBatch+'/analytics','owner-a@example.test')).summary.eligible_assignments,28);
});
