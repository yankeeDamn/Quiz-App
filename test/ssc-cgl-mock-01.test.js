'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {validate,csvFor,normalized}=require('../scripts/ssc-cgl-mock-01');
const {inspect}=require('../src/services/question-import');
const {grade,cleanResponses,visibleAttempt}=require('../src/services/exam-grade');
const {eligible}=require('../src/services/ssc-section-timing');

test('Mock 01 contains exactly 100 unique original draft stems and canonical admin CSV files',()=>{
 const report=validate();
 assert.deepEqual(report.errors,[]);
 assert.equal(report.questionCount,100);
 assert.equal(report.manifest.mock.active,false);
 assert.equal(report.manifest.publicationAllowed,false);
 assert.equal(report.reviewed,0);
 assert.equal(report.allQuestionRows.length,4);
 for(const section of report.allQuestionRows){
   assert.equal(section.topic.active,false,'no public topic quiz before review');
   assert.equal(section.rows.length,25);
   const checked=inspect(section.rows,[]);
   assert.equal(checked.errors.length,0,JSON.stringify(checked.errors));
   assert.equal(checked.values.length,25);
 }
 assert.equal(report.built.sections.length,4);
 assert.deepEqual(report.sections.map(s=>s.questions),[25,25,25,25]);
 assert.equal(report.manifest.mock.minutes,60);
 assert.equal(report.manifest.mock.marksPerCorrect,2);
 assert.equal(report.manifest.mock.negativeMarks,0.5);
});

test('Full Mock 01 is eligible for server SSC section locks only after it is published',()=>{
 const report=validate();
 assert.equal(eligible(report.built),true,'built full paper matches the existing section timing policy');
 assert.equal(report.built.questions.length,100);
 const ids=new Set(report.built.questions.map(q=>q.id));
 assert.equal(ids.size,100,'question IDs must be stable and unique');
 for(let i=0;i<100;i++){
   assert.equal(report.built.questions[i].section,Math.floor(i/25));
 }
});

test('Answer keys produce 200 points for a perfect paper and correct negative marking',()=>{
 const {built}=validate();
 const responses=Object.fromEntries(built.questions.map(q=>[q.id,q.answer]));
 const full=grade(built,cleanResponses(built,responses));
 assert.equal(full.correct,100);
 assert.equal(full.incorrect,0);
 assert.equal(full.skipped,0);
 assert.equal(full.score,200);
 assert.equal(full.total,200);
 const first=built.questions[0];
 const wrong={...responses,[first.id]:(first.answer+1)%4};
 const gradedWrong=grade(built,cleanResponses(built,wrong));
 assert.equal(gradedWrong.correct,99);
 assert.equal(gradedWrong.incorrect,1);
 assert.equal(gradedWrong.score,197.5);
 const skipped={...responses};delete skipped[first.id];
 const gradedSkip=grade(built,cleanResponses(built,skipped));
 assert.equal(gradedSkip.correct,99);
 assert.equal(gradedSkip.skipped,1);
 assert.equal(gradedSkip.score,198);
 const row={id:'draft-test',test_id:built.id,snapshot:built,
   started_at:new Date(),deadline_at:new Date(),submitted_at:null,responses:{},result:null};
 const visible=visibleAttempt(row);
 assert.equal(visible.result,null);
 assert.equal(visible.test.questions[0].answer,undefined,'keys are server only');
 assert.equal(visible.test.questions[0].explanation,undefined);
});

test('Duplicate question import is rejected before any database writes',()=>{
 const {allQuestionRows}=validate();
 const question=allQuestionRows[0].rows[0];
 const twice=inspect([question,{...question}],[]);
 assert.equal(twice.errors.length,1);
 assert.match(twice.errors[0].message,/Duplicate/);
 const conflict=inspect([question],[question.question]);
 assert.equal(conflict.errors.length,1);
 assert.equal(conflict.values.length,0);
});

test('CSV export escapes punctuation and retains exact eight admin column headers',()=>{
 const row={question:'Which word contains "double" quotes, here?',options:['one, two','"three"','four','five'],
   answer:1,explanation:'The quoted expression names the second option.',difficulty:'Moderate'};
 const csv=csvFor([row]);
 assert.match(csv,/^"question","option_a","option_b","option_c","option_d","correct_option","explanation","difficulty"\r\n/);
 assert.match(csv,/"Which word contains ""double"" quotes, here\?"/);
 assert.match(csv,/"one, two"/);
 assert.match(csv,/"B"/);
 assert.equal(normalized('  A—B  '),normalized('a b'));
});
