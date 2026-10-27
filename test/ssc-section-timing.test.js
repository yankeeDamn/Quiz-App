'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { eligible, sectionTiming, lockedResponses } = require('../src/services/ssc-section-timing');

const base = {
  id:'ssc-cgl-2026-full-01', name:'SSC CGL 2026 Tier I Full Mock', exam:'SSC', kind:'mock',
  minutes:60, marksPerCorrect:2, negativeMarks:0.5,
  sections:[
    {name:'General Intelligence and Reasoning',from:0,to:25},
    {name:'General Awareness',from:25,to:50},
    {name:'Quantitative Aptitude',from:50,to:75},
    {name:'English Comprehension',from:75,to:100},
  ],
  questions:Array.from({length:100},(_,i)=>({id:'q'+i,section:Math.floor(i/25)})),
};

test('only complete SSC CGL Tier-I patterns opt in; existing mini mocks keep global timer',()=>{
  assert.equal(eligible(base),true);
  assert.equal(eligible({...base,questions:base.questions.slice(0,33)}),false);
  assert.equal(eligible({...base,kind:'topic'}),false);
  assert.equal(eligible({...base,minutes:30}),false);
  assert.equal(eligible({...base,marksPerCorrect:1}),false);
  assert.equal(eligible({...base,sections:[...base.sections.slice(0,3),{...base.sections[3],to:99}]}),false);
  assert.equal(eligible({...base,questions:base.questions.map((q,i)=>i===50?{...q,section:1}:q)}),false);
  assert.equal(eligible({...base,questions:base.questions.map((q,i)=>i===99?{...q,id:'q98'}:q)}),false);
  assert.equal(eligible({...base,name:'SSC CHSL Full Mock'}),false);
});

test('SSC CGL sectional boundaries are 15 minutes and include exact expiry',()=>{
  const start='2026-10-27T06:00:00.000Z';
  const snapshot={...base,sectionTimingMinutes:15};
  assert.equal(sectionTiming({...snapshot,sectionTimingMinutes:null},start),null);
  const at=seconds=>sectionTiming(snapshot,start,Date.parse(start)+seconds*1000);
  assert.equal(at(0).sectionIndex,0);
  assert.equal(at(899.999).sectionIndex,0);
  assert.equal(at(900).sectionIndex,1);
  assert.equal(at(1800).sectionIndex,2);
  assert.equal(at(2700).sectionIndex,3);
  assert.equal(at(3599.999).finished,false);
  assert.equal(at(3600).sectionIndex,4);
  assert.equal(at(3600).finished,true);
  assert.equal(at(3601).finished,true);
  assert.equal(at(-100).sectionIndex,0);
  assert.equal(at(900).sectionEndsAt,'2026-10-27T06:30:00.000Z');
});

test('server accepts active-section answers while preserving locked past answers',()=>{
  const snapshot={...base,sectionTimingMinutes:15};
  const clock={sectionIndex:1,finished:false};
  const persisted={q0:2,q1:3,q25:1};
  const merged=lockedResponses(snapshot,persisted,{q0:2,q1:3,q25:0,q26:2},clock);
  assert.deepEqual(merged,{q0:2,q1:3,q25:0,q26:2});
  assert.deepEqual(persisted,{q0:2,q1:3,q25:1});
  assert.deepEqual(lockedResponses(snapshot,persisted,{q26:0},clock),{q0:2,q1:3,q26:0});
});

test('server rejects expired/premature section writes and tampered earlier-section choices',()=>{
  const snapshot={...base,sectionTimingMinutes:15};
  const saved={q0:2,q1:3};
  const active={sectionIndex:1,finished:false};
  assert.throws(()=>lockedResponses(snapshot,saved,{q0:0,q25:1},active),err=>err.statusCode===409);
  assert.throws(()=>lockedResponses(snapshot,saved,{q50:1},active),err=>err.statusCode===409);
  assert.throws(()=>lockedResponses(snapshot,saved,{q999:1},active),err=>err.statusCode===409);
  assert.throws(()=>lockedResponses(snapshot,saved,{q75:1},{sectionIndex:4,finished:true}),err=>err.statusCode===409);
  assert.deepEqual(saved,{q0:2,q1:3});
});
