'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {csvCell,offset}=require('../src/services/institutes/reporting');
const {startExpiryWorker,finalizeExpired}=require('../src/services/institutes/expiry');
test('CSV neutralizes spreadsheet formulas, quotes and embedded line breaks',()=>{
 for(const value of ['=1+1',' +1','-1','@SUM(A1)','\t=1','\nformula'])assert.ok(csvCell(value).startsWith('"\''));
 assert.equal(csvCell('A "quote"'),'"A ""quote"""');assert.equal(csvCell(null),'""');assert.equal(csvCell(12.5),'"12.5"');
});
test('report export page validation rejects unbounded or fractional offsets',()=>{
 assert.equal(offset(),0);assert.equal(offset('500'),500);
 for(const value of [-1,1.5,'invalid',100001])assert.throws(()=>offset(value));
});
test('expiry worker is disabled by default and validates its internal batch bound',async()=>{
 const previous=process.env.INSTITUTE_EXPIRY_WORKER_ENABLED;delete process.env.INSTITUTE_EXPIRY_WORKER_ENABLED;
 try{await startExpiryWorker({error(){throw Error('No job should run');}})();await assert.rejects(finalizeExpired(101));}
 finally{if(previous!==undefined)process.env.INSTITUTE_EXPIRY_WORKER_ENABLED=previous;}
});
