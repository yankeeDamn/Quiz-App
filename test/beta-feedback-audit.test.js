'use strict';
process.env.NODE_ENV='test';
process.env.EXAMPRO_ENV='staging';
process.env.ENABLE_ADMIN_DRAFT_TESTS='true';
process.env.CORS_ORIGINS='https://exampro-staging-ui.vercel.app';
process.env.DATABASE_URL='postgres://fake:fake@localhost:5432/never_connect';
const test=require('node:test');
const assert=require('node:assert/strict');
const db=require('../src/config/database');
const config=require('../src/config');
const feedback=require('../src/services/beta-feedback.service');
const invitations=require('../src/services/beta-invitations.service');
const fs=require('node:fs');
const path=require('node:path');
const original={query:db.query,authorized:invitations.authorized,environment:config.draftTesting.environment};
const user={id:'11111111-1111-4111-8111-111111111111',email:'beta@example.test'};
test.after(()=>{db.query=original.query;invitations.authorized=original.authorized;config.draftTesting.environment=original.environment;});
test('invitation is required before feedback validation or database writes',async()=>{
 invitations.authorized=async()=>{throw Object.assign(new Error('not invited'),{statusCode:403});};
 db.query=async()=>{throw Error('must not query');};
 await assert.rejects(feedback.submit(user,{category:'other',severity:'high',comment:'Something is wrong'}),e=>e.statusCode===403);
});
test('validates feedback and stores only permitted fields',async()=>{
 invitations.authorized=async()=>true;
 const calls=[];db.query=async(sql,params)=>{calls.push({sql,params});return {rows:[{id:'a',created_at:'2026-10-30'}],rowCount:1};};
 for(const data of [{category:'wrong',severity:'high',comment:'More than ten chars'}, {category:'timing',severity:'urgent',comment:'More than ten chars'}, {category:'timing',severity:'high',comment:'short'}]){
  await assert.rejects(feedback.submit(user,data),e=>e.statusCode===400);
 }
 assert.equal(calls.length,0);
 const result=await feedback.submit(user,{category:'translation',severity:'medium',comment:'  Hindi option has typo   ',answer:'secret'});
 assert.equal(result.id,'a');
 assert.deepEqual(calls[0].params,[invitations.TEST_ID,user.id,'translation','medium','Hindi option has typo']);
});
test('dashboard reads are staging only and release signoff never grants approval',async()=>{
 config.draftTesting.environment='production';
 await assert.rejects(feedback.list(),e=>e.statusCode===404);
 config.draftTesting.environment='staging';
 db.query=async(sql)=>({rows:sql.includes('exam_beta_feedback')?[{id:'x',status:'open',severity:'high'}]:[],rowCount:1});
 const result=await feedback.list();
 assert.equal(result.feedback.length,1);
 const source=fs.readFileSync(path.resolve(__dirname,'../src/services/beta-feedback.service.js'),'utf8');
 assert.match(source,/releaseAuthorized:false/);
 assert.match(source,/requiresIndependentSignoff:true/);
});
test('routes protect feedback by OAuth invitation and admin reviews by human reviewer',()=>{
 const beta=fs.readFileSync(path.resolve(__dirname,'../src/routes/beta.js'),'utf8');
 const admin=fs.readFileSync(path.resolve(__dirname,'../src/routes/admin.js'),'utf8');
 assert.match(beta,/router\.use\(authenticateNextAuth\)/);
 assert.match(beta,/feedback\.submit\(req\.user,req\.body\)/);
 assert.match(admin,/router\.get\('\/beta\/audit',requireHumanReviewer/);
 assert.match(admin,/router\.get\('\/beta\/release-signoff\/:testId',requireHumanReviewer/);
});
