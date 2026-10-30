'use strict';
// Black-box API regression: all database and Azure operations are stubs.
// Nothing in this test connects to Neon, Azure, Render or a deployed URL.
if(!globalThis.crypto)globalThis.crypto=require('node:crypto').webcrypto;
process.env.NODE_ENV='test';
process.env.EXAMPRO_ENV='staging';
process.env.ENABLE_ADMIN_DRAFT_TESTS='true';
process.env.CORS_ORIGINS='https://exampro-staging-ui.vercel.app';
process.env.AUTH_SECRET='pr55-test-only-auth-secret-long-enough';
process.env.JWT_SECRET=process.env.AUTH_SECRET;
process.env.ADMIN_EMAILS='reviewer@example.test';
process.env.ADMIN_API_KEY='pr55-test-only-admin-key-01234567890';
process.env.DATABASE_URL='postgres://fake:fake@127.0.0.1:5432/no_real_db';
process.env.AZURE_TRANSLATOR_KEY='pr55-test-only-azure-key';
process.env.AZURE_TRANSLATOR_REGION='eastus';
process.env.AZURE_TRANSLATOR_ENDPOINT='https://api.cognitive.microsofttranslator.com';

const test=require('node:test');
const assert=require('node:assert/strict');
const app=require('../src/app');
const db=require('../src/config/database');
const content=require('../src/services/content.service');
const quality=require('../src/services/mock-quality.service');
const mocks=require('../src/services/mocks.service');
const azure=require('../src/services/azure-translator.service');
const nativeFetch=global.fetch;
const userId='11111111-1111-4111-8111-111111111111';
const attemptId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const mockId='ssc-cgl-2026-mock-01';
const topics=['reasoning','awareness','quant','english'];
const names=['General Intelligence and Reasoning','General Awareness','Quantitative Aptitude','English Comprehension'];
function fixture(){
 return {
  id:mockId,name:'SSC CGL 2026 Tier-I Full Mock 01',kind:'mock',exam:'SSC',
  tier:'free',minutes:60,marksPerCorrect:2,negativeMarks:0.5,passPercent:50,
  sections:names.map((name,i)=>({name,from:i*25,to:(i+1)*25})),
  questions:Array.from({length:100},(_,i)=>({
   id:topics[Math.floor(i/25)]+':'+(i%25),topic:topics[Math.floor(i/25)],
   section:Math.floor(i/25),question:'Original English question '+(i+1)+'?',
   options:['Option A','Option B','Option C','Option D'],answer:i%4,
   explanation:'Private keyed explanation for question '+(i+1),
  })),
 };
}

test('PR55: authenticated EN/HI/BN translations and private Mock 01 save/lock/grade flow',async t=>{
 const originals={
  query:db.query,getClient:db.getClient,draft:content.buildDraftExam,
  attach:quality.attachApprovedHindi,find:mocks.findMock,fetch:global.fetch,
 };
 t.after(()=>{
  db.query=originals.query;db.getClient=originals.getClient;
  content.buildDraftExam=originals.draft;quality.attachApprovedHindi=originals.attach;
  mocks.findMock=originals.find;global.fetch=originals.fetch;azure.resetCacheForTests();
 });
 azure.resetCacheForTests();
 let row=null;
 const azureCalls=[];
 global.fetch=async(url,options)=>{
  if(!String(url).startsWith('https://api.cognitive.microsofttranslator.com/'))
   throw Error('Unexpected external network access in PR55 test');
  const parsed=new URL(String(url));
  const language=parsed.searchParams.get('to');
  assert.equal(parsed.searchParams.get('from'),'en');
  assert.equal(options.headers['Ocp-Apim-Subscription-Region'],'eastus');
  assert.equal(options.headers['Ocp-Apim-Subscription-Key'],'pr55-test-only-azure-key');
  azureCalls.push({language,texts:JSON.parse(options.body)});
  return {ok:true,json:async()=>JSON.parse(options.body).map(v=>({
   translations:[{to:language,text:language+':'+v.Text}],
  }))};
 };
 db.query=async(sql,params=[])=>{
  if(sql.includes('SELECT * FROM users'))return {rows:[{
   id:userId,email:String(params[2]).toLowerCase(),name:'QA reviewer',
   image:null,provider:'google',provider_id:'qa-oauth',role:'user',plan:'free',
  }],rowCount:1};
  if(sql.includes('FROM exam_time_accommodations'))return {rows:[],rowCount:0};
  if(sql.includes('SELECT * FROM exam_attempts_v2 WHERE id=$1 AND user_id=$2')){
   const rows=row&&row.id===params[0]&&row.user_id===params[1]?[row]:[];
   return {rows,rowCount:rows.length};
  }
  throw Error('Unexpected PR55 db.query: '+sql);
 };
 db.getClient=async()=>({
  release(){},
  async query(sql,params=[]){
   if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)||sql.startsWith('SELECT pg_advisory'))return {rows:[],rowCount:0};
   if(sql.includes('submitted_at IS NULL FOR UPDATE')){
    const rows=row&&!row.submitted_at&&row.user_id===params[0]&&row.test_id===params[1]?[row]:[];
    return {rows,rowCount:rows.length};
   }
   if(sql.includes('INSERT INTO exam_attempts_v2')){
    row={id:attemptId,user_id:params[0],test_id:params[1],snapshot:JSON.parse(params[2]),
     responses:{},started_at:new Date().toISOString(),
     deadline_at:new Date(Date.now()+Number(params[3])*60000).toISOString(),
     submitted_at:null,result:null};
    return {rows:[row],rowCount:1};
   }
   if(sql.includes('FOR UPDATE')){
    const rows=row&&row.id===params[0]&&row.user_id===params[1]?[row]:[];
    return {rows,rowCount:rows.length};
   }
   if(sql.includes('UPDATE exam_attempts_v2')){
    row.responses=JSON.parse(params[1]);
    row.submitted_at=params[2]?new Date().toISOString():null;
    row.result=params[3]?JSON.parse(params[3]):null;
    return {rows:[row],rowCount:1};
   }
   throw Error('Unexpected PR55 transaction: '+sql);
  },
 });
 content.buildDraftExam=async id=>id===mockId?fixture():null;
 // This fixture has no approved Hindi, so Azure text remains advisory and
 // neither a source question nor its answer key can be overwritten.
 quality.attachApprovedHindi=async(_id,built)=>built;
 mocks.findMock=async()=>null;
 const server=await new Promise(resolve=>{
  const s=app.listen(0,'127.0.0.1',()=>resolve(s));
 });
 t.after(()=>new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve())));
 const base='http://127.0.0.1:'+server.address().port;
 const {SignJWT}=await import('jose');
 const token=async(email)=>'Bearer '+await new SignJWT({
  sub:'qa-oauth',email,name:'QA reviewer',provider:'google',emailVerified:true,
 }).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('1h')
  .sign(new TextEncoder().encode(process.env.AUTH_SECRET));
 const admin=await token('reviewer@example.test');
 const nonAdmin=await token('student@example.test');
 const request=async(path,method='GET',authorization,body)=>{
  const res=await nativeFetch(base+'/api/v1'+path,{
   method,headers:{'Content-Type':'application/json',...(authorization?{Authorization:authorization}:{})},
   ...(body?{body:JSON.stringify(body)}:{}),
  });
  return {status:res.status,body:await res.json()};
 };
 const translate='/exampro/translate-exam';
 assert.equal((await request(translate,'POST',undefined,{language:'hi',texts:['Question?']})).status,401);
 assert.equal((await request(translate,'POST',admin,{language:'hi',texts:['']})).status,400);
 const hi=await request(translate,'POST',admin,{language:'hi',texts:['Original English question 1?','Option A']});
 assert.equal(hi.status,200);
 assert.deepEqual(hi.body.data.texts,['hi:Original English question 1?','hi:Option A']);
 assert.equal(hi.body.data.advisory,true);
 assert.equal(JSON.stringify(hi.body).includes(process.env.AZURE_TRANSLATOR_KEY),false);
 const repeat=await request(translate,'POST',admin,{language:'hi',texts:['Original English question 1?','Option A']});
 assert.equal(repeat.status,200);
 assert.equal(repeat.body.data.cached,2);
 const bn=await request(translate,'POST',nonAdmin,{language:'bn',texts:['Original English question 1?']});
 assert.equal(bn.status,200,'verified students can translate their own exams');
 assert.deepEqual(bn.body.data.texts,['bn:Original English question 1?']);
 assert.equal(azureCalls.length,2,'Hindi repeat must use cache; Bangla uses a distinct cache key');

 const start='/admin/tests/'+mockId+'/draft-attempt';
 assert.equal((await request(start,'POST',undefined,{})).status,401);
 assert.equal((await request(start,'POST',nonAdmin,{})).status,403);
 assert.equal((await request('/exam-attempts/start','POST',nonAdmin,{testId:mockId})).status,404);
 const started=await request(start,'POST',admin,{testId:mockId});
 assert.equal(started.status,200,JSON.stringify(started.body));
 const attempt=started.body.data.attempt;
 assert.equal(attempt.test.questions.length,100);
 assert.equal(attempt.test.sections.length,4);
 assert.equal(attempt.test.sectionTimingMinutes,15);
 assert.equal(attempt.test.questions[0].answer,undefined,'keys must stay on server');
 assert.equal(JSON.stringify(attempt).includes('Private keyed explanation'),false);
 assert.equal(row.snapshot.adminDraft,true);
 assert.equal(row.snapshot.questions[0].question,'Original English question 1?');
 assert.equal(row.snapshot.questions[0].answer,0);
 const resumed=await request(start,'POST',admin,{});
 assert.equal(resumed.body.data.attempt.id,attempt.id);

 const save='/admin/draft-attempts/'+attempt.id+'/progress';
 assert.equal((await request(save,'PUT',admin,{responses:{'awareness:0':1}})).status,409,'future section locked');
 const saved=await request(save,'PUT',admin,{responses:{'reasoning:0':0}});
 assert.equal(saved.status,200,JSON.stringify(saved.body));
 assert.equal(saved.body.data.attempt.responses['reasoning:0'],0);
 row.started_at=new Date(Date.now()-16*60000).toISOString();
 assert.equal((await request(save,'PUT',admin,{responses:{'reasoning:0':1}})).status,409,'past section locked');
 const second=await request(save,'PUT',admin,{responses:{'awareness:0':1}});
 assert.equal(second.status,200,JSON.stringify(second.body));
 assert.deepEqual(second.body.data.attempt.responses,{'reasoning:0':0,'awareness:0':1});

 row.started_at=new Date(Date.now()-61*60000).toISOString();
 row.deadline_at=new Date(Date.now()-60000).toISOString();
 assert.equal((await request(save,'PUT',admin,{responses:{'english:0':0}})).status,409);
 const submitted=await request('/admin/draft-attempts/'+attempt.id+'/submit','POST',admin,
  {responses:{'english:0':0}});
 assert.equal(submitted.status,200,JSON.stringify(submitted.body));
 assert.equal(submitted.body.data.attempt.result.correct,2);
 assert.equal(submitted.body.data.attempt.result.incorrect,0);
 assert.equal(submitted.body.data.attempt.result.skipped,98);
 assert.equal(submitted.body.data.attempt.result.score,4);
 assert.equal(submitted.body.data.attempt.result.total,200);
 assert.equal(submitted.body.data.attempt.result.review[0].correctAnswer,0);
 assert.equal((await request('/exam-attempts/'+attempt.id,'GET',admin)).status,404,
  'draft result must not appear through public student attempt route');
 assert.equal((await request('/admin/draft-attempts/'+attempt.id,'GET',nonAdmin)).status,403);
 assert.equal((await request('/admin/draft-attempts/'+attempt.id,'GET',admin)).status,200);
});
