'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const pipeline=require('../src/services/ssc-content-pipeline.service');
function question(section,i){return {question:`${section} unique question ${i}: which option is correct?`,options:['Option A','Option B','Option C','Option D'],answer:1,explanation:'Option B is correct because it meets the given rule.',difficulty:'Moderate'};}
function bank(){return Object.fromEntries(pipeline.sections.map(s=>[s,Array.from({length:25},(_,i)=>question(s,i))]));}
test('Mock 02–10 exact four by 25 validation and clean draft-only report',()=>{
 const r=pipeline.inspect(2,bank());
 assert.equal(r.valid,true);
 assert.equal(r.expected,100);
 assert.equal(r.academicApproved,0);
 assert.equal(r.hindiVerified,0);
 assert.equal(r.hindiRequired,75);
 assert.equal(r.canPublish,false);
 assert.equal(r.draftOnly,true);
});
test('rejects outside 02–10 and incomplete section counts',()=>{
 assert.throws(()=>pipeline.inspect(1,bank()),/02–10/);
 assert.throws(()=>pipeline.inspect(11,bank()),/02–10/);
 const b=bank();b.english.pop();
 const r=pipeline.inspect(4,b);
 assert.equal(r.valid,false);
 assert.ok(r.issues.some(x=>x.section==='english'&&/25/.test(x.message)));
});
test('catches normalized duplicates within a batch and across existing bank',()=>{
 const b=bank();
 b.quant[0].question='  REASONING --- unique question 0: which option is correct? ';
 const r=pipeline.inspect(6,b,['General awareness unique question 10: which option is correct?']);
 assert.equal(r.valid,false);
 assert.ok(r.issues.filter(x=>/Duplicate/.test(x.message)).length>=2);
});
test('requires meaningful explanations and ignores untrusted verified Hindi claims',()=>{
 const b=bank();
 b.reasoning[3].explanation='yes';
 b.quant[4].hindiStatus='verified';
 const r=pipeline.inspect(8,b);
 assert.ok(r.issues.some(x=>/Explanation/.test(x.message)));
 assert.ok(r.issues.some(x=>/cannot claim human-verified/.test(x.message)));
});
test('pipeline routes have human-auth and staging-only read-only previews',()=>{
 const routes=fs.readFileSync(path.resolve(__dirname,'../src/routes/admin.js'),'utf8');
 const service=fs.readFileSync(path.resolve(__dirname,'../src/services/ssc-content-pipeline.service.js'),'utf8');
 assert.match(routes,/router\.post\('\/content-pipeline\/preview',requireHumanReviewer/);
 assert.match(routes,/router\.get\('\/content-pipeline\/dashboard',requireHumanReviewer/);
 assert.match(service,/gate\.enabled\(\)/);
 assert.doesNotMatch(service,/INSERT INTO|UPDATE mock_|DELETE FROM/);
});
