'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const db=require('../src/config/database');
const quality=require('../src/services/mock-quality.service');
const accommodations=require('../src/services/ssc-accommodations.service');
const {eligible,sectionTiming,lockedResponses}=require('../src/services/ssc-section-timing');
const fs=require('node:fs');
const path=require('node:path');

const testId='ssc-cgl-2026-mock-01';
const topics=['ssc26-m01-reasoning','ssc26-m01-awareness','ssc26-m01-quant','ssc26-m01-english'];
const sectionNames=['General Intelligence and Reasoning','General Awareness','Quantitative Aptitude','English Comprehension'];
const parts=topics.map((topic,i)=>({name:sectionNames[i],parts:[{topic,from:0,to:25}]}));
const questions=topics.flatMap((topic_id,g)=>Array.from({length:25},(_,position)=>({
 id:`00000000-0000-4000-8000-${String(g*25+position+1).padStart(12,'0')}`,
 topic_id,position,active:true,difficulty:'Moderate',
 question:`Human review sample ${g*25+position+1}?`,
 options:['one','two','three','four'],answer:1,explanation:'Rationale reviewed separately',
})));
const mockDb=()=>{
 const calls=[];
 db.query=async(sql,params=[])=>{
  calls.push({sql,params});
  if(sql.includes('FROM mock_tests'))return {rows:[{id:testId,name:'SSC CGL 2026 Tier-I Full Mock 01',sections:parts,active:false}],rowCount:1};
  if(sql.includes('FROM mock_questions'))return {rows:questions,rowCount:questions.length};
  if(sql.includes('FROM mock_question_reviews'))return {rows:[],rowCount:0};
  if(sql.includes('INSERT INTO mock_question_reviews'))return {rows:[],rowCount:1};
  throw Error('Unexpected review SQL: '+sql);
 };
 return calls;
};

test('100 review entries all start unapproved; Hindi required for only first 75',async t=>{
 const old=db.query,calls=mockDb();t.after(()=>{db.query=old});
 const report=await quality.list(testId);
 assert.equal(report.expected,100);
 assert.equal(report.actual,100);
 assert.equal(report.academicApproved,0);
 assert.equal(report.hindiRequired,75);
 assert.equal(report.hindiVerified,0);
 assert.equal(report.ready,false);
 assert.equal(report.entries.every(e=>e.academicStatus==='pending'),true);
 assert.equal(calls.some(c=>/INSERT|UPDATE|DELETE/.test(c.sql)),false,'reading reviews is read only');
});

test('changed source hash invalidates previously recorded academic and Hindi approvals',async t=>{
 const old=db.query;t.after(()=>{db.query=old});
 const first=questions[0];
 const recorded={question_id:first.id,content_hash:quality.sourceHash({...first,question:'Previous question?'}),
  academic_status:'approved',academic_reviewer:'teacher@example.com',academic_notes:'approved',
  hindi_status:'verified',hindi_question:'कौन सा उत्तर सही है?',
  hindi_options:['एक','दो','तीन','चार'],hindi_explanation:'दूसरा उत्तर सही है।',
  hindi_reviewer:'teacher@example.com'};
 db.query=async sql=>{
  if(sql.includes('FROM mock_tests'))return {rows:[{name:'Mock',sections:parts,active:false}]};
  if(sql.includes('FROM mock_questions'))return {rows:questions};
  if(sql.includes('FROM mock_question_reviews'))return {rows:[recorded]};
  throw Error('Unexpected query');
 };
 const report=await quality.list(testId);
 assert.equal(report.entries[0].stale,true);
 assert.equal(report.entries[0].academicStatus,'pending');
 assert.equal(report.entries[0].hindiStatus,'pending');
 assert.equal(report.ready,false);
});

test('review submission refuses empty machine-style Hindi, allows real manual fields and records reviewer',async t=>{
 const old=db.query,calls=mockDb();t.after(()=>{db.query=old});
 const id=questions[0].id;
 await assert.rejects(quality.update(testId,id,{
   academicStatus:'approved',hindiStatus:'verified',
   hindiQuestion:'',hindiOptions:[],hindiExplanation:'',
 },'teacher@example.com'),e=>e.statusCode===400);
 await assert.rejects(quality.update(testId,id,{
   academicStatus:'approved',hindiStatus:'not_required',
 },'teacher@example.com'),e=>e.statusCode===400);
 const saved=await quality.update(testId,id,{
  academicStatus:'approved',academicNotes:'Answer and explanation checked against sources.',
  hindiStatus:'verified',hindiQuestion:'सही उत्तर कौन सा है?',
  hindiOptions:['एक','दो','तीन','चार'],hindiExplanation:'सही उत्तर दूसरा है।',
 },'teacher@example.com');
 assert.equal(saved.success,true);
 const write=calls.find(c=>c.sql.includes('INSERT INTO mock_question_reviews'));
 assert.ok(write);
 assert.equal(write.params[4],'teacher@example.com');
 assert.equal(write.params[10],'teacher@example.com');
});

test('approved Hindi is delivered only with matching source hash',async t=>{
 const old=db.query;t.after(()=>{db.query=old});
 const q=questions[0];
 db.query=async sql=>{
  if(sql.includes('FROM mock_tests'))return {rows:[{name:'Mock',sections:parts,active:false}]};
  if(sql.includes('FROM mock_questions'))return {rows:questions};
  if(sql.includes('FROM mock_question_reviews'))return {rows:[{
   question_id:q.id,content_hash:quality.sourceHash(q),hindi_status:'verified',
   hindi_question:'सही उत्तर कौन सा है?',hindi_options:['एक','दो','तीन','चार']
  }]};
  throw Error('Unexpected query');
 };
 const question={id:q.topic_id+':'+q.position,question:q.question,options:q.options,section:0};
 const localized=await quality.attachApprovedHindi(testId,{questions:[question]});
 assert.equal(localized.questions[0].hindi.question,'सही उत्तर कौन सा है?');
 assert.equal(localized.questions[0].hindi.options.length,4);
});

test('20-minute accommodation follows the official four-section cutoffs',()=>{
 const sample={kind:'mock',exam:'SSC',name:'SSC CGL Full Mock',minutes:60,marksPerCorrect:2,negativeMarks:0.5,
  sections:sectionNames.map((name,i)=>({name,from:i*25,to:i*25+25})),
  questions:Array.from({length:100},(_,i)=>({id:'q'+i,section:Math.floor(i/25)}))};
 assert.equal(eligible(sample),true);
 const stamp='2026-10-29T08:00:00.000Z';
 const snap={...sample,sectionTimingMinutes:20};
 const clock=mins=>sectionTiming(snap,stamp,Date.parse(stamp)+mins*60000);
 assert.equal(clock(19).sectionIndex,0);
 assert.equal(clock(20).sectionIndex,1);
 assert.equal(clock(40).sectionIndex,2);
 assert.equal(clock(60).sectionIndex,3);
 assert.equal(clock(80).finished,true);
 assert.equal(clock(80).sectionIndex,4);
 assert.throws(()=>lockedResponses(snap,{q0:2},{q0:3},clock(20)),e=>e.statusCode===409);
 assert.throws(()=>lockedResponses(snap,{q0:2},{q50:1},clock(20)),e=>e.statusCode===409);
 assert.deepEqual(lockedResponses(snap,{q0:2},{q25:1},clock(20)),{q0:2,q25:1});
 assert.equal(sectionTiming({...snap,sectionTimingMinutes:15},stamp,Date.parse(stamp)+15*60000).sectionIndex,1);
});

test('accommodation is granted only by server-side account lookup and admin writes',async t=>{
 const old=db.query;t.after(()=>{db.query=old});
 const recorded=[];
 db.query=async(sql,params=[])=>{
  recorded.push({sql,params});
  if(sql.includes('SELECT id,active FROM mock_tests'))return {rows:[{id:testId,active:false}]};
  if(sql.includes('SELECT id FROM users'))return {rows:[{id:'a0000000-0000-4000-8000-000000000001'}]};
  if(sql.includes('FROM exam_time_accommodations'))return {rows:[{mode:'scribe_compensatory'}]};
  if(sql.includes('INSERT INTO exam_time_accommodations'))return {rowCount:1};
  if(sql.includes('DELETE FROM exam_time_accommodations'))return {rowCount:1};
  throw Error('Unexpected query: '+sql);
 };
 assert.equal(await accommodations.approvedMode('user',testId),'scribe_compensatory');
 const grant=await accommodations.setApproved(testId,'Candidate@example.com',true,'reviewer@example.com');
 assert.equal(grant.minutesPerSection,20);
 assert.equal(recorded.some(c=>c.sql.includes('INSERT INTO exam_time_accommodations')),true);
 await accommodations.setApproved(testId,'Candidate@example.com',false,'reviewer@example.com');
 assert.equal(recorded.some(c=>c.sql.includes('DELETE FROM exam_time_accommodations')),true);
});

test('review approval and compensatory time routes require human identity and offline verification',()=>{
 const r=fs.readFileSync(path.resolve(__dirname,'../src/routes/admin.js'),'utf8');
 assert.match(r,/router\.put\('\/tests\/:id\/reviews\/:questionId',requireHumanReviewer/);
 assert.match(r,/router\.put\('\/tests\/:id\/accommodations',requireHumanReviewer/);
 assert.match(r,/req\.body\.eligibilityChecked!==true/);
 assert.match(r,/quality\.readiness\(req\.params\.id\)/);
});
