'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const store=require('../src/services/publishing-store');
const user={id:'00000000-0000-4000-8000-000000000001'};
const plan={id:'plan-1',revision:3};
function client(){const calls=[];return {calls,query:async(sql,args)=>{calls.push({sql,args});return {rowCount:1,rows:[]};}}}
test('disabled scheduling fails before SQL',async()=>{
 const previous=process.env.PUBLISHING_WORKFLOW_ENABLED;
 try{delete process.env.PUBLISHING_WORKFLOW_ENABLED;const c=client();await assert.rejects(store.schedule(c,plan,{},user,true),/disabled/);assert.equal(c.calls.length,0);}
 finally{if(previous===undefined)delete process.env.PUBLISHING_WORKFLOW_ENABLED;else process.env.PUBLISHING_WORKFLOW_ENABLED=previous;}
});
test('schedule requires review and current revision, writes queue and event',async()=>{
 const previous=process.env.PUBLISHING_WORKFLOW_ENABLED;
 try{process.env.PUBLISHING_WORKFLOW_ENABLED='true';const c=client();const input={acknowledged:true,revision:3,publishAt:new Date(Date.now()+3600000).toISOString()};
 await assert.rejects(store.schedule(c,plan,{...input,revision:2},user,true),/revision/);
 await assert.rejects(store.schedule(c,plan,input,user,false),/readiness/);
 assert.equal(c.calls.length,0);
 await store.schedule(c,plan,input,user,true);
 assert.equal(c.calls.length,2);assert.match(c.calls[0].sql,/ON CONFLICT/);assert.equal(c.calls[0].args[3],user.id);assert.equal(c.calls[1].args[1],'schedule');
 }finally{if(previous===undefined)delete process.env.PUBLISHING_WORKFLOW_ENABLED;else process.env.PUBLISHING_WORKFLOW_ENABLED=previous;}
});
test('snapshot and event share supplied transaction client',async()=>{
 const c=client();await store.published(c,plan,user,{days:[]});
 assert.equal(c.calls.length,3);assert.match(c.calls[0].sql,/publishing_versions/);assert.match(c.calls[1].sql,/DELETE/);assert.equal(c.calls[2].args[1],'publish');
});
