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
