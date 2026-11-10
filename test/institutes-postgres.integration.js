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
const app=express();app.use(express.json({limit:'128kb'}));app.use('/api/v1',router);
app.use((err,_req,res,_next)=>res.status(err.statusCode||500).json({error:err.message}));
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
 for(let n=0;n<2;n++) { await db.query(fs.readFileSync('src/db/pilot-schema.sql','utf8'));await db.query(fs.readFileSync('src/db/institute-foundation.sql','utf8'));await db.query(fs.readFileSync('src/db/institute-delivery.sql','utf8')); }
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
