'use strict';
// jose v6 requires WebCrypto; Node 18 exposes it as node:crypto.webcrypto.
if (!globalThis.crypto) globalThis.crypto = require('node:crypto').webcrypto;
process.env.NODE_ENV = 'test';
process.env.EXAMPRO_ENV = 'staging';
process.env.ENABLE_ADMIN_DRAFT_TESTS = 'true';
process.env.CORS_ORIGINS = 'https://exampro-staging-ui.vercel.app';
process.env.AUTH_SECRET = 'test-secret-for-staging-draft-exam-sessions-2026';
process.env.JWT_SECRET = process.env.AUTH_SECRET;
process.env.ADMIN_EMAILS = 'reviewer@example.test';
process.env.ADMIN_API_KEY = 'test-admin-key-valid-length-at-least-32-chars';
process.env.DATABASE_URL = 'postgres://fake:fake@localhost:5432/mocktest';

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const db = require('../src/config/database');
const config = require('../src/config');
const content = require('../src/services/content.service');
const mocks = require('../src/services/mocks.service');
const gate = require('../src/services/draft-testing-gate');
const exams = require('../src/services/exam-attempts.service');
const { eligible } = require('../src/services/ssc-section-timing');

const userId='11111111-1111-4111-8111-111111111111';
const attemptId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const key='ssc-cgl-2026-mock-01';
const makeExam=()=>({
 id:key,name:'SSC CGL 2026 Tier-I Full Mock 01',exam:'SSC',kind:'mock',
 tier:'free',minutes:60,marksPerCorrect:2,negativeMarks:0.5,passPercent:50,
 sections:['General Intelligence and Reasoning','General Awareness','Quantitative Aptitude','English Comprehension']
   .map((name,i)=>({name,from:i*25,to:(i+1)*25})),
 questions:Array.from({length:100},(_,i)=>({
    id:'topic'+Math.floor(i/25)+':'+(i%25), topic:'topic'+Math.floor(i/25),section:Math.floor(i/25),
    question:'Original QA question '+(i+1),options:['Option A','Option B','Option C','Option D'],
    answer:i%4,explanation:'This is the private keyed explanation for '+(i+1),
 }))
});
const makeRow=()=>({id:attemptId,user_id:userId,test_id:'draft-'+key,
 snapshot:null,responses:{},submitted_at:null,result:null,
 started_at:new Date().toISOString(),deadline_at:new Date(Date.now()+3600000).toISOString()});

test('staging-only guard fails closed when any prerequisite is missing',()=>{
 const old={...config.draftTesting},oldOrigins=config.cors.origins,oldDb=config.databaseUrl;
 assert.equal(gate.enabled(),true);
 try{
  config.draftTesting.enabled=false;assert.equal(gate.enabled(),false);
  config.draftTesting.enabled=true;config.draftTesting.environment='production';assert.equal(gate.enabled(),false);
  config.draftTesting.environment='staging';config.cors.origins=['https://quiz-app-virid-zeta-41.vercel.app','https://exampro-staging-ui.vercel.app'];
  assert.equal(gate.enabled(),false);
  config.cors.origins=['https://exampro-staging-ui.vercel.app'];config.databaseUrl='';
  assert.equal(gate.enabled(),false);
 }finally{Object.assign(config.draftTesting,old);config.cors.origins=oldOrigins;config.databaseUrl=oldDb}
});

test('private routes reject guests, ordinary users, API keys, and hide keys before submit',async t=>{
 let row=null;
 const originals={query:db.query,client:db.getClient,draft:content.buildDraftExam,publicMock:mocks.findMock};
 const exam=makeExam();
 assert.equal(eligible(exam),true,'full SSC pattern must trigger section timer');
 db.query=async(sql,params=[])=>{
   if(sql.includes('SELECT * FROM users')){
      return {rows:[{id:userId,email:params[2],name:'Review admin',image:null,
        provider:'google',provider_id:'oauth-id',plan:'free',role:'user'}],rowCount:1};
   }
   if(sql.includes('SELECT * FROM exam_attempts_v2 WHERE id=$1 AND user_id=$2')){
     const rows=row && params[0]===row.id && params[1]===row.user_id ? [row]:[];
     return {rows,rowCount:rows.length};
   }
   throw Error('unexpected draft QA db.query: '+sql);
 };
 content.buildDraftExam=async id=>id===key?exam:null;
 mocks.findMock=async()=>null;
 db.getClient=async()=>({
   release(){},
   async query(sql,params=[]){
     if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)||sql.startsWith('SELECT pg_advisory'))return {rows:[],rowCount:0};
     if(sql.includes('submitted_at IS NULL FOR UPDATE')){
       const matches=row&&!row.submitted_at&&row.user_id===params[0]&&row.test_id===params[1]?[row]:[];
       return {rows:matches,rowCount:matches.length};
     }
     if(sql.includes('INSERT INTO exam_attempts_v2')){
       row=makeRow();row.snapshot=JSON.parse(params[2]);row.test_id=params[1];
       return {rows:[row],rowCount:1};
     }
     if(sql.includes('FOR UPDATE')){
       const matches=row&&row.id===params[0]&&row.user_id===params[1]?[row]:[];
       return {rows:matches,rowCount:matches.length};
     }
     if(sql.includes('UPDATE exam_attempts_v2')){
       row.responses=JSON.parse(params[1]);
       row.submitted_at=params[2]?new Date().toISOString():null;
       row.result=params[3]?JSON.parse(params[3]):null;
       return {rows:[row],rowCount:1};
     }
     throw Error('unexpected draft QA client.query: '+sql);
   }
 });
 const server=await new Promise(resolve=>{
   const s=app.listen(0,'127.0.0.1',()=>resolve(s));
 });
 t.after(async()=>{
   Object.assign(db,{query:originals.query,getClient:originals.client});
   content.buildDraftExam=originals.draft;mocks.findMock=originals.publicMock;
   await new Promise((resolve,reject)=>server.close(err=>err?reject(err):resolve()));
 });
 const base='http://127.0.0.1:'+server.address().port;
 const {SignJWT}=await import('jose');
 const token=async(email,verified=true)=>new SignJWT({
   sub:'google-oauth-user',email,name:'Review admin',
   provider:'google',emailVerified:verified,
 }).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('1h')
   .sign(new TextEncoder().encode(process.env.AUTH_SECRET));
 const adminAuth='Bearer '+await token('reviewer@example.test');
 const nonAdmin='Bearer '+await token('student@example.test');
 const invalidProvider='Bearer '+await token('reviewer@example.test',false);
 const api=async(path,method='GET',authorization,body,other={})=>{
   const res=await fetch(base+'/api/v1'+path,{method,headers:{'Content-Type':'application/json',...(authorization?{Authorization:authorization}:{}),...other},
     ...(body?{body:JSON.stringify(body)}:{})});
   return {status:res.status,body:await res.json()};
 };
 const start='/admin/tests/'+key+'/draft-attempt';
 assert.equal((await api(start,'POST')).status,401);
 assert.equal((await api(start,'POST',nonAdmin)).status,403);
 assert.equal((await api(start,'POST',invalidProvider)).status,403);
 assert.equal((await api(start,'POST',undefined,undefined,{'x-admin-key':process.env.ADMIN_API_KEY})).status,403);
 assert.equal((await api('/mocks/'+key)).status,404,'public mocks never reveal draft');
 assert.equal((await api('/exam-attempts/start','POST',nonAdmin,{testId:key})).status,404);
 const stat=await api('/admin/draft-testing/status','GET',adminAuth);
 assert.equal(stat.status,200);assert.equal(stat.body.data.enabled,true);
 const started=await api(start,'POST',adminAuth,{testId:key});
 assert.equal(started.status,200,JSON.stringify(started.body));
 assert.equal(started.body.data.attempt.test.sectionTimingMinutes,15);
 assert.equal(started.body.data.attempt.test.questions.length,100);
 assert.equal(started.body.data.attempt.test.questions[0].answer,undefined);
 assert.equal(JSON.stringify(started.body).includes('private keyed explanation'),false);
 assert.equal(row.snapshot.adminDraft,true);
 assert.equal(row.test_id,'draft-'+key);
 const resume=await api(start,'POST',adminAuth,{testId:key});
 assert.equal(resume.body.data.attempt.id,attemptId,'resume existing unsubmitted draft');
 assert.equal((await api('/exam-attempts/'+attemptId,'GET',adminAuth)).status,404);
 assert.equal((await api('/exam-attempts/'+attemptId+'/progress','PUT',adminAuth,{responses:{}})).status,404);
 assert.equal((await api('/admin/draft-attempts/'+attemptId,'GET',nonAdmin)).status,403);
 assert.equal((await api('/admin/draft-attempts/'+attemptId,'GET')).status,401);
 assert.equal((await api('/admin/draft-attempts/'+attemptId,'GET',adminAuth)).status,200);
 const save=await api('/admin/draft-attempts/'+attemptId+'/progress','PUT',adminAuth,
   {responses:{'topic0:0':0}});
 assert.equal(save.status,200,JSON.stringify(save.body));
 assert.equal(save.body.data.attempt.responses['topic0:0'],0);
 assert.equal(save.body.data.attempt.result,null);
 const rejected=await api('/admin/draft-attempts/'+attemptId+'/progress','PUT',adminAuth,
   {responses:{'topic1:0':0}});
 assert.equal(rejected.status,409,'next section must be server locked');
 const graded=await api('/admin/draft-attempts/'+attemptId+'/submit','POST',adminAuth,
   {responses:{'topic0:0':0,'topic0:1':0}});
 assert.equal(graded.status,200,JSON.stringify(graded.body));
 assert.equal(graded.body.data.attempt.result.correct,1);
 assert.equal(graded.body.data.attempt.result.incorrect,1);
 assert.equal(graded.body.data.attempt.result.skipped,98);
 assert.equal(graded.body.data.attempt.result.score,1.5);
 assert.equal(graded.body.data.attempt.result.total,200);
 assert.equal(graded.body.data.attempt.result.review[0].correctAnswer,0);
 assert.equal((await api('/exam-attempts/'+attemptId,'GET',adminAuth)).status,404,'draft stays private after grading');
});

test('normal exam-attempt endpoint cannot read admin draft owned by same user',async t=>{
 const old=db.query;
 t.after(()=>{db.query=old});
 db.query=async()=>({rows:[{id:attemptId,user_id:userId,snapshot:{adminDraft:true,questions:[]}}],rowCount:1});
 await assert.rejects(exams.get(userId,attemptId),e=>e.statusCode===404);
});
