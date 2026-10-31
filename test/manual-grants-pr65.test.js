'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const db=require('../src/config/database');
const grants=require('../src/services/manual-grants.service');
const original={getClient:db.getClient,query:db.query};
test.after(()=>{db.getClient=original.getClient;db.query=original.query});
const id='a02e5bd5-8ad0-4ae2-8eb0-25c89ed7c21a';
const email='reviewed@example.test';
const base={email,plan:'pro',months:1,amountInr:199,reason:'manual_payment',note:'Verified separate UPI payment receipt',requestId:id,expectedExpiresAt:null,acknowledgeActivePlan:false,acknowledgeRecentCashfree:false};
function fake({plan='free',expiry=null,lastGrants=[],already=false}={}){
 let updates=0,inserts=0,commits=0,rollbacks=0;
 const user={id:'11111111-1111-4111-8111-111111111111',email,plan,plan_expires_at:expiry};
 const tx={
  query:async(sql,params=[])=>{
   if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK'){
    if(sql==='COMMIT')commits++;
    if(sql==='ROLLBACK')rollbacks++;
    return {rows:[],rowCount:0};
   }
   if(sql.includes('FROM users')&&sql.includes('FOR UPDATE'))return {rows:[user],rowCount:1};
   if(sql.includes('FROM plan_grants')&&sql.includes('LEFT('))
    return {rows:already?[{expires_at:'2027-01-01T00:00:00.000Z'}]:[],rowCount:already?1:0};
   if(sql.includes('FROM plan_grants')&&sql.includes('ORDER BY granted_at'))return {rows:lastGrants,rowCount:lastGrants.length};
   if(sql.includes('UPDATE users')){updates++;return {rows:[{email,plan:params[1],plan_expires_at:params[2]}],rowCount:1};}
   if(sql.includes('INSERT INTO plan_grants')){inserts++;return {rows:[],rowCount:1};}
   throw Error('Unexpected SQL '+sql);
  },
  release:()=>{}
 };
 db.getClient=async()=>tx;
 return {counters:()=>({updates,inserts,commits,rollbacks})};
}
test('grant provenance distinguishes legacy and confirmed Cashfree without rewriting records',()=>{
 assert.equal(grants.classify('Cashfree sandbox cf_sbx_abcd').source,'cashfree_sandbox');
 assert.equal(grants.classify('WhatsApp transfer').source,'legacy_manual');
 assert.deepEqual(grants.classify('Manual grant '+id+' | Bank reference receipt'),{source:'manual',note:'Bank reference receipt'});
});
test('a single reviewed manual payment grants exactly once within one transaction',async()=>{
 const dbFake=fake();
 const r=await grants.grant(base);
 assert.equal(r.duplicate,false);
 assert.deepEqual(dbFake.counters(),{updates:1,inserts:1,commits:1,rollbacks:0});
});
test('retry with same request UUID cannot extend an existing plan again',async()=>{
 const dbFake=fake({already:true,expiry:'2026-12-01T00:00:00.000Z'});
 const r=await grants.grant(base);
 assert.equal(r.duplicate,true);
 assert.deepEqual(dbFake.counters(),{updates:0,inserts:0,commits:1,rollbacks:0});
});
test('stale reviewed expiry fails closed without modifying the account',async()=>{
 const dbFake=fake({plan:'pro',expiry:'2026-12-01T00:00:00.000Z'});
 await assert.rejects(grants.grant(base),e=>e.statusCode===409&&/plan changed/.test(e.message));
 assert.deepEqual(dbFake.counters(),{updates:0,inserts:0,commits:0,rollbacks:1});
});
test('active plans require explicit renewal acknowledgement',async()=>{
 const dbFake=fake({plan:'pro',expiry:'2027-12-01T00:00:00.000Z'});
 await assert.rejects(grants.grant({...base,expectedExpiresAt:'2027-12-01T00:00:00.000Z'}),e=>e.statusCode===409&&/active plan/.test(e.message));
 assert.equal(dbFake.counters().inserts,0);
});
test('a recent Cashfree grant blocks unacknowledged second manual unlock',async()=>{
 const dbFake=fake({lastGrants:[{note:'Cashfree sandbox cf_sbx_abcd',granted_at:new Date().toISOString()}]});
 await assert.rejects(grants.grant(base),e=>e.statusCode===409&&/Cashfree/.test(e.message));
 assert.equal(dbFake.counters().updates,0);
});
test('reviewed complimentary access never claims a payment was received',async()=>{
 const dbFake=fake();
 const r=await grants.grant({...base,reason:'complimentary',amountInr:0,note:'Authorized beta tester access'});
 assert.equal(r.duplicate,false);
 assert.equal(dbFake.counters().inserts,1);
 await assert.rejects(grants.grant({...base,reason:'complimentary',amountInr:199}),/complimentary access must have amount zero/);
});
test('a reviewed manual grant requires source evidence and human OAuth admin route',async()=>{
 await assert.rejects(grants.grant({...base,reason:'manual_payment',amountInr:0}),/positive amount/);
 const routes=fs.readFileSync(path.join(__dirname,'../src/routes/admin.js'),'utf8');
 assert.match(routes,/router\.get\('\/grant-preview',requireHumanReviewer/);
 assert.match(routes,/\s+'\/grant',\s+requireHumanReviewer/);
 assert.match(routes,/body\('requestId'\)\.isUUID\(\)/);
});
