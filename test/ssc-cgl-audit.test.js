'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mocks = require('../src/services/mocks.service');
const {auditBank}=require('../scripts/audit-ssc-cgl');
test('does not misrepresent starter SSC mock papers as ten full mocks',()=>{
 const report=auditBank(mocks.fromJson());
 assert.equal(report.target,10);
 assert.equal(report.passes,false);
 assert.ok(report.ready<10);
 assert.ok(report.results.some(r=>r.issues.some(issue=>issue.includes('100 questions'))));
});
test('an empty bank never claims successful mock readiness',()=>{
 const report=auditBank({topics:[],mocks:[]});
 assert.equal(report.passes,false);
 assert.equal(report.totalCglCandidates,0);
});
test('live 33-question SSC CGL papers are labeled mini mocks, not official-pattern full papers',()=>{
 const bank=mocks.fromJson();
 const names=Object.fromEntries(bank.mocks.filter(m=>['ssc1','ssc2'].includes(m.id)).map(m=>[m.id,m.name]));
 assert.match(names.ssc1,/mini mock/i);
 assert.match(names.ssc2,/mini mock/i);
 const report=auditBank(bank);
 for(const r of report.results.filter(r=>['ssc1','ssc2'].includes(r.id))){
  assert.ok(r.questions<100,'mini mock must never be counted as a full 100-question paper');
  assert.ok(r.issues.length>0,'mini mock must keep failing the full-mock checklist');
 }
});
