'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {generate}=require('../src/services/study-plan-generator');
test('covers every day and revisits resources in order',()=>{const rows=generate({duration:5,dailyMinutes:60,resources:[{id:'a',title:'A'},{id:'b',title:'B'}]});assert.deepEqual(rows.map(r=>r.day),[1,2,3,4,5]);assert.deepEqual(rows.map(r=>r.resource_id),['a','b','a','b','a']);assert.equal(rows[2].kind,'revision');assert.ok(rows.every(r=>r.minutes===60&&!r.preview));});
test('rejects invalid allocation',()=>assert.throws(()=>generate({duration:1,dailyMinutes:30,resources:[]}),/Choose/));
