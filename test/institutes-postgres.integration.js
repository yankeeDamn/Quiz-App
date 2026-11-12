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
 for(let n=0;n<2;n++) { await db.query(fs.readFileSync('src/db/pilot-schema.sql','utf8'));await db.query(fs.readFileSync('src/db/institute-foundation.sql','utf8')); }
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
