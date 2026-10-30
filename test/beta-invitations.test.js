'use strict';
process.env.NODE_ENV='test';
process.env.EXAMPRO_ENV='staging';
process.env.ENABLE_ADMIN_DRAFT_TESTS='true';
process.env.CORS_ORIGINS='https://exampro-staging-ui.vercel.app';
process.env.DATABASE_URL='postgres://fake:fake@localhost:5432/never_connect';
const test=require('node:test');
const assert=require('node:assert/strict');
const invitations=require('../src/services/beta-invitations.service');
const db=require('../src/config/database');
const config=require('../src/config');
const fs=require('node:fs');
const path=require('node:path');
const user={id:'11111111-1111-4111-8111-111111111111',email:'Student@Example.Test'};
const original=db.query;
test.after(()=>{db.query=original});
test('staging gate cannot be enabled with production origin or environment',async()=>{
 const previous={...config.draftTesting},origins=config.cors.origins;
 try{
  config.draftTesting.environment='production';
  await assert.rejects(invitations.create('student@example.test',48,'reviewer@example.test'),e=>e.statusCode===404);
  config.draftTesting.environment='staging';
  config.cors.origins=['https://quiz-app-virid-zeta-41.vercel.app','https://exampro-staging-ui.vercel.app'];
  await assert.rejects(invitations.authorized(user),e=>e.statusCode===404);
 }finally{Object.assign(config.draftTesting,previous);config.cors.origins=origins;}
});
test('create validates email and bounded expiry, stores only code hash',async()=>{
 const written=[];
 db.query=async(sql,params)=>{written.push({sql,params});return {rowCount:1,rows:[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}]};};
 await assert.rejects(invitations.create('not-an-email',24,'reviewer@example.test'),e=>e.statusCode===400);
 await assert.rejects(invitations.create('student@example.test',200,'reviewer@example.test'),e=>e.statusCode===400);
 const invitation=await invitations.create('Student@Example.Test',48,'reviewer@example.test');
 assert.match(invitation.invitationCode,/^[a-f0-9]{64}$/);
 assert.equal(invitation.email,'student@example.test');
 assert.equal(written.length,2);
 assert.match(written[1].sql,/exam_beta_invitation_audit/);
 assert.equal(written[0].params[1],'student@example.test');
 assert.notEqual(written[0].params[2],invitation.invitationCode);
 assert.match(written[0].params[2],/^[a-f0-9]{64}$/);
});
test('redemption is bound to verified identity, nonexpired code and active grant',async()=>{
 let issuedHash='';
 db.query=async(sql,params)=>{
  if(sql.includes('INSERT INTO exam_beta_invitation_audit'))return {rowCount:1,rows:[]};
  if(sql.includes('UPDATE exam_beta_invitations')){
   issuedHash=params[1];
   return {rowCount:params[0]===user.id&&params[3]==='student@example.test'?1:0,
    rows:[{id:'a',expires_at:'2026-11-01T00:00:00Z'}]};
  }
  if(sql.includes('SELECT 1 FROM exam_beta_invitations'))
   return {rowCount:params[1]===user.id&&params[2]==='student@example.test'?1:0,rows:[{one:1}]};
  throw Error('unexpected beta SQL');
 };
 const token='1'.repeat(64);
 assert.equal((await invitations.redeem(user,token)).testId,invitations.TEST_ID);
 assert.equal(issuedHash.length,64);
 assert.notEqual(issuedHash,token);
 await assert.rejects(invitations.redeem({...user,email:'other@example.test'},token),e=>e.statusCode===403);
 assert.equal(await invitations.authorized(user),true);
 await assert.rejects(invitations.authorized({...user,id:'22222222-2222-4222-8222-222222222222'}),e=>e.statusCode===403);
});
test('beta router is separate from admin and validates invitation before each attempt action',()=>{
 const routes=fs.readFileSync(path.resolve(__dirname,'../src/routes/beta.js'),'utf8');
 const index=fs.readFileSync(path.resolve(__dirname,'../src/routes/index.js'),'utf8');
 assert.match(index,/router\.use\('\/beta', betaRoutes\)/);
 assert.match(routes,/router\.use\(authenticateNextAuth\)/);
 assert.match(routes,/await invitations\.authorized\(req\.user\)/);
 assert.match(routes,/attempt\.testId!==['"]draft-['"]\+invitations\.TEST_ID/);
 assert.match(routes,/exams\.save\(req\.user\.id,req\.params\.id,req\.body\?\.responses,true,true\)/);
 assert.doesNotMatch(routes,/requireAdmin|adminEmails|grantPlan/);
});
test('invitation code never appears in a URL and beta attempts suppress public sharing',()=>{
 const page=fs.readFileSync(path.resolve(__dirname,'../exam-practice-pro/app/exampro/beta/mock-01/page.tsx'),'utf8');
 assert.match(page,/method:'POST',body:\{code:code\.trim\(\)\}/);
 const runner=fs.readFileSync(path.resolve(__dirname,'../exam-practice-pro/components/mocks/secure-exam.tsx'),'utf8');
 assert.match(runner,/betaMode \? '\/api\/v1\/beta\/attempt'/);
 assert.match(runner,/!draftMode&&!betaMode&&<ShareTestButtons/);
});
