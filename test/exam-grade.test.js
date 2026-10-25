'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanResponses, grade, visibleAttempt } = require('../src/services/exam-grade');
const snapshot = { name:'Test', minutes:10, tier:'free', marksPerCorrect:2, negativeMarks:0.5, passPercent:50,
 sections:[{name:'One',from:0,to:3}], questions:[
  {id:'q1',question:'First',options:['A','B','C','D'],answer:1,explanation:'B',section:0},
  {id:'q2',question:'Second',options:['A','B','C','D'],answer:3,explanation:'D',section:0},
  {id:'q3',question:'Third',options:['A','B','C','D'],answer:0,explanation:'A',section:0}
 ] };
test('grades correct incorrect skipped with negative marking and pass threshold',()=>{
 const result=grade(snapshot,cleanResponses(snapshot,{q1:1,q2:2}));
 assert.equal(result.correct,1);assert.equal(result.incorrect,1);assert.equal(result.skipped,1);
 assert.equal(result.score,1.5);assert.equal(result.total,6);assert.equal(result.percentage,25);assert.equal(result.passed,false);
});
test('rejects tampered or unknown responses',()=>{
 for (const input of [{q100:1},{q1:4},{q1:1.5},{q1:'1'},[]]) assert.throws(()=>cleanResponses(snapshot,input));
});
test('review stays hidden until submitted; test never leaks correct answer or explanation',()=>{
 const row={id:'x',test_id:'test',snapshot,responses:{q1:1},started_at:new Date(),deadline_at:new Date(),submitted_at:null,result:null};
 const draft=visibleAttempt(row);
 assert.equal(draft.test.questions[0].answer,undefined);
 assert.equal(draft.test.questions[0].explanation,undefined);
 assert.equal(draft.result,null);
 const finished=visibleAttempt({...row,submitted_at:new Date(),result:grade(snapshot,{q1:1})});
 assert.equal(finished.result.review[0].correctAnswer,1);
});
