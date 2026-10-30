'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const pipeline=require('../src/services/ssc-content-pipeline.service');
const db=require('../src/config/database');
const gate=require('../src/services/draft-testing-gate');
function question(section,i){return {question:`${section} unique question ${i}: which option is correct?`,options:['Option A','Option B','Option C','Option D'],answer:1,explanation:'Option B is correct because it meets the given rule.',difficulty:'Moderate'};}
function bank(){return Object.fromEntries(pipeline.sections.map(s=>[s,Array.from({length:25},(_,i)=>question(s,i))]));}
test('Mock 02–10 exact four by 25 validation and clean draft-only report',()=>{
 const r=pipeline.inspect(2,bank());
 assert.equal(r.valid,true);
 assert.equal(r.expected,100);
 assert.equal(r.academicApproved,0);
 assert.equal(r.hindiVerified,0);
 assert.equal(r.hindiRequired,75);
 assert.equal(r.canPublish,false);
 assert.equal(r.draftOnly,true);
});
test('rejects outside 02–10 and incomplete section counts',()=>{
 assert.throws(()=>pipeline.inspect(1,bank()),/02–10/);
 assert.throws(()=>pipeline.inspect(11,bank()),/02–10/);
 const b=bank();b.english.pop();
 const r=pipeline.inspect(4,b);
 assert.equal(r.valid,false);
 assert.ok(r.issues.some(x=>x.section==='english'&&/25/.test(x.message)));
});
test('catches normalized duplicates within a batch and across existing bank',()=>{
 const b=bank();
 b.quant[0].question='  REASONING --- unique question 0: which option is correct? ';
 const r=pipeline.inspect(6,b,['General awareness unique question 10: which option is correct?']);
 assert.equal(r.valid,false);
 assert.ok(r.issues.filter(x=>/Duplicate/.test(x.message)).length>=2);
});
test('requires meaningful explanations and ignores untrusted verified Hindi claims',()=>{
 const b=bank();
 b.reasoning[3].explanation='yes';
 b.quant[4].hindiStatus='verified';
 const r=pipeline.inspect(8,b);
 assert.ok(r.issues.some(x=>/Explanation/.test(x.message)));
 assert.ok(r.issues.some(x=>/cannot claim human-verified/.test(x.message)));
});
test('pipeline routes have human-auth and staging-only read-only previews',()=>{
 const routes=fs.readFileSync(path.resolve(__dirname,'../src/routes/admin.js'),'utf8');
 const service=fs.readFileSync(path.resolve(__dirname,'../src/services/ssc-content-pipeline.service.js'),'utf8');
 assert.match(routes,/router\.post\('\/content-pipeline\/preview',requireHumanReviewer/);
 assert.match(routes,/router\.get\('\/content-pipeline\/dashboard',requireHumanReviewer/);
 assert.match(service,/gate\.enabled\(\)/);
 assert.match(service,/VALUES\(\$1,\$2,\$3,false\)/);
 assert.match(service,/50,false\)/);
 assert.doesNotMatch(service,/UPDATE mock_tests SET active|UPDATE mock_topics SET active|DELETE FROM/);
});

test('draft creation is refused when staging feature gate is disabled',async()=>{
 const original=gate.enabled;
 gate.enabled=()=>false;
 try{await assert.rejects(pipeline.stage(2,bank()),e=>e.statusCode===404);}
 finally{gate.enabled=original;}
});
test('validated drafts are inserted in a single transaction with inactive topic/test flags',async()=>{
 const originalGate=gate.enabled,originalClient=db.getClient;
 const sql=[];const client={
  query:async(statement,params=[])=>{
   sql.push({statement,params});
   if(statement==='SELECT question FROM mock_questions')return {rows:[],rowCount:0};
   return {rows:[],rowCount:0};
  },release:()=>{},
 };
 gate.enabled=()=>true;db.getClient=async()=>client;
 try{
  const result=await pipeline.stage(2,bank());
  assert.equal(result.active,false);assert.equal(result.topicsActive,false);assert.equal(result.questions,100);
  assert.equal(sql.filter(x=>/INSERT INTO mock_questions/.test(x.statement)).length,100);
  assert.equal(sql.filter(x=>/INSERT INTO mock_topics/.test(x.statement)).length,4);
  assert.equal(sql.filter(x=>/INSERT INTO mock_tests/.test(x.statement)).length,1);
  assert.match(sql.filter(x=>/INSERT INTO mock_tests/.test(x.statement))[0].statement,/false/);
  assert.equal(sql.at(-1).statement,'COMMIT');
 }finally{gate.enabled=originalGate;db.getClient=originalClient;}
});
test('invalid drafts roll back without creating content',async()=>{
 const originalGate=gate.enabled,originalClient=db.getClient;
 const sql=[];const client={query:async(statement)=>{
  sql.push(statement);
  if(statement==='SELECT question FROM mock_questions')return {rows:[],rowCount:0};
  return {rows:[],rowCount:0};
 },release:()=>{}};
 gate.enabled=()=>true;db.getClient=async()=>client;
 const b=bank();b.reasoning.pop();
 try{
  await assert.rejects(pipeline.stage(2,b),e=>e.statusCode===422);
  assert.ok(sql.includes('ROLLBACK'));
  assert.equal(sql.some(x=>/INSERT INTO mock_questions/.test(x)),false);
 }finally{gate.enabled=originalGate;db.getClient=originalClient;}
});
