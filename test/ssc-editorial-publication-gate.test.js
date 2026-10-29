'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {isFullCglMock}=require('../src/services/ssc-full-mock-classifier');

const full={
 id:'ssc-cgl-2026-mock-01',name:'SSC CGL 2026 Tier-I Full Mock 01',
 exam:'SSC',sections:['R','GK','Quant','English'].map((name,i)=>({
  name,parts:[{topic:'ssc26-m01-'+i,from:0,to:25}],
 })),
};
test('Mock 01 cannot evade academic/Hindi gate by renaming the title or exam group',()=>{
 assert.equal(isFullCglMock(full),true);
 assert.equal(isFullCglMock({...full,name:'Practice beta'}),true);
 assert.equal(isFullCglMock({...full,name:'Unreviewed',exam:'Other'}),true);
 assert.equal(isFullCglMock({...full,id:'other',name:'SSC CGL 2026 Full Mock 02'}),true);
 assert.equal(isFullCglMock({...full,id:'other',name:'SSC CGL Practice Beta'}),true,
  'four 25-question sections are still a full-length SSC CGL mock');
 assert.equal(isFullCglMock({...full,id:'other',name:'SSC CGL Mini Practice',
  sections:[{name:'practice',parts:[{topic:'s',from:0,to:25}]}]}),false);
 assert.equal(isFullCglMock(null),false);
});

test('Admin update route invokes the same classifier before editorial readiness',()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../src/routes/admin.js'),'utf8');
 const update=source.slice(source.indexOf("router.put('/tests/:id'"));
 assert.match(update,/isFullCglMock\(\{ \.\.\.r\.value, id: req\.params\.id \}\)/);
 assert.match(update,/await quality\.readiness\(req\.params\.id\)/);
 assert.match(update,/if\(!editorial\.ok\)return bad\(res,editorial\.error,409\)/);
 assert.doesNotMatch(update,/\/full\\\\s\+mock\//,'escaped regex must not bypass review');
});

test('public-bank publication readiness shares classifier and official-pattern requirements',()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../src/services/content.service.js'),'utf8');
 assert.match(source,/if \(isFullCglMock\(definition\)\)/);
 assert.match(source,/if \(!eligible\(built\)\)/);
});
