'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {buildAnalytics}=require('../src/services/exam-analytics');
const snap={minutes:5,marksPerCorrect:2,negativeMarks:0.5,
  sections:[{name:'Math'},{name:'English'}],
  questions:[
    {id:'a',topic:'quant',topicName:'Quant',section:0},
    {id:'b',topic:'quant',topicName:'Quant',section:0},
    {id:'c',topic:'verbal',topicName:'Verbal',section:1},
  ]};
const result={score:1.5,total:6,percentage:25,correct:1,incorrect:1,
  review:[{id:'a',selected:0,correct:true},{id:'b',selected:1,correct:false},{id:'c',selected:-1,correct:false}]};
test('server-grade analytics do not infer unseen student behavior',()=>{
 const a=buildAnalytics(snap,result,'2026-01-01T00:00:00Z','2026-01-01T00:02:00Z');
 assert.equal(a.elapsedSeconds,120);
 assert.equal(a.sections[0].score,1.5);
 assert.equal(a.sections[0].accuracy,50);
 assert.equal(a.sections[1].accuracy,null);
 assert.equal(a.weakTopics.length,2);
 assert.equal(a.topics.find(x=>x.topicId==='quant').incorrect,1);
 assert.equal(JSON.stringify(a).includes('correctAnswer'),false);
 assert.equal(JSON.stringify(a).includes('explanation'),false);
});
test('rejects unsubmitted or incomplete grades',()=>{
 assert.throws(()=>buildAnalytics({},null,new Date(),new Date()),{statusCode:409});
});
