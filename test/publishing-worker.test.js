'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {runDue}=require('../src/services/publishing-worker');
test('disabled worker does not query or publish',async()=>{
 const prior=process.env.PUBLISHING_WORKFLOW_ENABLED;
 try{delete process.env.PUBLISHING_WORKFLOW_ENABLED;assert.deepEqual(await runDue({database:{query:async()=>{throw Error('unexpected query')}}}),{published:0,blocked:0});}
 finally{if(prior===undefined)delete process.env.PUBLISHING_WORKFLOW_ENABLED;else process.env.PUBLISHING_WORKFLOW_ENABLED=prior;}
});
test('due jobs pass original actor and revision to native publishing service',async()=>{
 const prior=process.env.PUBLISHING_WORKFLOW_ENABLED;
 try{process.env.PUBLISHING_WORKFLOW_ENABLED='true';const calls=[];const rows=[{content_id:'p1',expected_revision:2,requested_by:'u1',email:'owner@example.invalid'},{content_id:'p2',expected_revision:3,requested_by:'u2',email:null}];
 const result=await runDue({database:{query:async()=>({rows})},service:{publish:async(...args)=>{calls.push(args);if(!args[0].email)throw Object.assign(Error('denied'),{statusCode:403});}}});
 assert.deepEqual(result,{published:1,blocked:1});assert.deepEqual(calls[0],[{id:'u1',email:'owner@example.invalid'},'p1',{revision:2,acknowledged:true,scheduled:true}]);
 }finally{if(prior===undefined)delete process.env.PUBLISHING_WORKFLOW_ENABLED;else process.env.PUBLISHING_WORKFLOW_ENABLED=prior;}
});
