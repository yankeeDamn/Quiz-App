'use strict';
process.env.NODE_ENV='test';
const test=require('node:test');
const assert=require('node:assert/strict');
const db=require('../src/config/database');
const mocks=require('../src/services/mocks.service');
const exams=require('../src/services/exam-attempts.service');
const oldClient=db.getClient,oldQuery=db.query,oldFind=mocks.findMock;
const alice={id:'11111111-1111-4111-8111-111111111111',email:'alice@example.com',plan:'free'};
const bob={id:'22222222-2222-4222-8222-222222222222',email:'bob@example.com',plan:'free'};
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const testData={id:'fixture',name:'Fixture',minutes:5,tier:'free',marksPerCorrect:2,negativeMarks:0.5,passPercent:50,
  sections:[{name:'One',from:0,to:2}],questions:[
  {id:'topic:0',question:'A or B?',options:['A','B','C','D'],answer:1,explanation:'B is correct',topic:'topic',section:0},
  {id:'topic:1',question:'C or D?',options:['A','B','C','D'],answer:3,explanation:'D is correct',topic:'topic',section:0}
  ]};
let row=null;
const client={ release(){}, async query(sql,params=[]){
  if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK'||sql.startsWith('SELECT pg_advisory'))return {rows:[],rowCount:0};
  if(sql.includes('SELECT * FROM exam_attempts_v2')&&sql.includes('submitted_at IS NULL')){
    const found=row&&!row.submitted_at&&row.user_id===params[0]&&row.test_id===params[1]?[row]:[];
    return {rows:found,rowCount:found.length};
  }
  if(sql.includes('INSERT INTO exam_attempts_v2')){
    row={id,user_id:params[0],test_id:params[1],snapshot:JSON.parse(params[2]),responses:{},started_at:new Date().toISOString(),deadline_at:new Date(Date.now()+params[3]*60000).toISOString(),submitted_at:null,result:null};
    return {rows:[row],rowCount:1};
  }
  if(sql.includes('WHERE id=$1 AND user_id=$2 FOR UPDATE')){
    const found=row&&row.id===params[0]&&row.user_id===params[1]?[row]:[];
    return {rows:found,rowCount:found.length};
  }
  if(sql.startsWith('UPDATE exam_attempts_v2')){
    row.responses=JSON.parse(params[1]);row.submitted_at=params[2]?new Date().toISOString():null;
    row.result=params[3]?JSON.parse(params[3]):null;
    return {rows:[row],rowCount:1};
  }
  throw Error('Unexpected fake query: '+sql);
}};
test.before(()=>{ db.getClient=async()=>client;
  db.query=async(sql,params)=>{
    if(sql.includes('SELECT * FROM exam_attempts_v2')){
      const rows=row&&row.id===params[0]&&row.user_id===params[1]?[row]:[];
      return {rows,rowCount:rows.length};
    }
    if(sql.includes('FROM exam_attempts_v2 WHERE user_id=$1')){
      const rows=row&&row.user_id===params[0]?[row]:[];return {rows,rowCount:rows.length};
    }
    throw Error('Unexpected fake SELECT');
  };
  mocks.findMock=async testId=>testId==='draft'?null:{tier:'free',build:()=>testData,summary:{id:'fixture'}};
});
test.after(()=>{db.getClient=oldClient;db.query=oldQuery;mocks.findMock=oldFind});
test('draft and unknown exams are not startable',async()=>{
 await assert.rejects(exams.start(alice,'draft'),e=>e.statusCode===404);
});
test('start is recoverable and never includes answer keys',async()=>{
 row=null;
 const one=await exams.start(alice,'fixture');
 const two=await exams.start(alice,'fixture');
 assert.equal(one.id,two.id);
 assert.equal(one.test.questions[0].answer,undefined);
 assert.equal(JSON.stringify(one).includes('B is correct'),false);
});
test('saves progress and prevents student IDOR',async()=>{
 const saved=await exams.save(alice.id,id,{'topic:0':1},false);
 assert.equal(saved.responses['topic:0'],1);
 await assert.rejects(exams.get(bob.id,id),e=>e.statusCode===404);
 await assert.rejects(exams.save(bob.id,id,{},true),e=>e.statusCode===404);
});
test('server submits once, ignores edited client scores and preserves review',async()=>{
 const first=await exams.save(alice.id,id,{'topic:0':1,'topic:1':0},true);
 assert.equal(first.result.score,1.5);
 assert.equal(first.result.correct,1);
 assert.equal(first.result.incorrect,1);
 const retry=await exams.save(alice.id,id,{'topic:0':0},true);
 assert.deepEqual(retry.result,first.result);
 const list=await exams.history(alice.id);
 assert.equal(list[0].result.score,1.5);
 assert.equal(list[0].result.review,undefined);
});
test('expired attempt discards late answers, grading persisted progress only',async()=>{
 row=null;await exams.start(alice,'fixture');
 await exams.save(alice.id,id,{'topic:0':1},false);
 row.deadline_at=new Date(Date.now()-1000).toISOString();
 await assert.rejects(exams.save(alice.id,id,{'topic:0':1,'topic:1':3},false),e=>e.statusCode===409);
 const final=await exams.save(alice.id,id,{'topic:0':0,'topic:1':3},true);
 assert.equal(final.result.correct,1);
 assert.equal(final.result.skipped,1);
 assert.equal(final.result.score,2);
});
