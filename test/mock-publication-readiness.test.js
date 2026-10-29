'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/config/database');
const content = require('../src/services/content.service');
const fs = require('node:fs');
const path = require('node:path');

const ids = [
  'ssc26-m01-reasoning', 'ssc26-m01-awareness',
  'ssc26-m01-quant', 'ssc26-m01-english',
];
const names = [
  'General Intelligence and Reasoning', 'General Awareness',
  'Quantitative Aptitude', 'English Comprehension',
];
const definition = () => ({
  id:'ssc-cgl-2026-mock-01',
  name:'SSC CGL 2026 Tier-I Full Mock 01',
  exam:'SSC', minutes:60, marksPerCorrect:2, negativeMarks:0.5,
  passPercent:50, tier:'free', level:'Moderate',
  sections: names.map((name,i)=>({
    name,parts:[{topic:ids[i],from:0,to:25}],
  })),
});
const allTopics = () => ids.map(id => ({id,name:id,category:'SSC',active:true}));
const allQuestions = () => ids.flatMap(topic_id=>
  Array.from({length:25},(_,position)=>({
    topic_id,position,
    question: 'Verified question '+topic_id+' #'+position,
    options:['A','B','C','D'],answer:1,explanation:'Verified explanation',
  }))
);

test('public mocks require active topics, complete positions, and official pattern',async t=>{
 const old=db.query;
 let topics=allTopics(),questions=allQuestions(),reads=0;
 db.query=async(sql,params=[])=>{
   reads++;
   assert.deepEqual(params,[ids]);
   if(sql.includes('FROM mock_topics'))return {rows:topics,rowCount:topics.length};
   if(sql.includes('FROM mock_questions'))return {rows:questions,rowCount:questions.length};
   throw Error('Unexpected SQL in read-only publish check: '+sql);
 };
 t.after(()=>{db.query=old});
 const good=await content.publicationReadiness(definition());
 assert.deepEqual(good,{ok:true,questionCount:100});
 assert.equal(reads,2,'readiness only performs reads and never mutates data');
 
 topics=allTopics().map((x,i)=>i===2?{...x,active:false}:x);
 let r=await content.publicationReadiness(definition());
 assert.equal(r.ok,false);assert.match(r.error,/active|activated/i);
 
 topics=allTopics().slice(0,3);
 r=await content.publicationReadiness(definition());
 assert.equal(r.ok,false);assert.match(r.error,/do not exist/i);
 
 topics=allTopics();
 questions=allQuestions().filter(x=>!(x.topic_id===ids[3]&&x.position===24));
 r=await content.publicationReadiness(definition());
 assert.equal(r.ok,false);assert.match(r.error,/99 of 100/i);
 
 questions=allQuestions();
 questions.push({...questions[0]});
 r=await content.publicationReadiness(definition());
 assert.equal(r.ok,false);assert.match(r.error,/duplicate/i);
 
 questions=allQuestions();
 for(const [change,expression] of [
   [d=>{d.minutes=30},/100 questions|60 minutes/],
   [d=>{d.marksPerCorrect=1},/100 questions|60 minutes/],
   [d=>{d.negativeMarks=0.05},/100 questions|60 minutes/],
   [d=>{d.sections[3].name='Other'},/100 questions|60 minutes/],
 ]) {
   const d=definition();change(d);
   const bad=await content.publicationReadiness(d);
   assert.equal(bad.ok,false);assert.match(bad.error,expression);
 }
});

test('publication guard rejects empty or malformed sections without DB access',async()=>{
 assert.equal((await content.publicationReadiness({sections:[]})).ok,false);
 assert.equal((await content.publicationReadiness({sections:[{parts:[]}]})).ok,false);
 assert.equal((await content.publicationReadiness({sections:[{parts:[{topic:'x',from:25,to:0}]}]})).ok,false);
});

test('a normal short practice mock remains publishable when content is complete',async t=>{
 const old=db.query;
 db.query=async sql=>{
   if(sql.includes('FROM mock_topics'))return {rows:[{id:'percent',name:'Percentages',category:'SSC',active:true}]};
   if(sql.includes('FROM mock_questions'))return {rows:Array.from({length:5},(_,position)=>({
     topic_id:'percent',position,question:'Question '+position,options:['A','B','C','D'],answer:1,explanation:'Explanation',
   }))};
   throw Error('Unexpected SQL');
 };
 t.after(()=>{db.query=old});
 const r=await content.publicationReadiness({
   name:'SSC CGL Practice Set 1',exam:'SSC',minutes:10,marksPerCorrect:1,
   negativeMarks:0.25,tier:'free',
   sections:[{name:'Practice',parts:[{topic:'percent',from:0,to:5}]}],
 });
 assert.equal(r.ok,true);assert.equal(r.questionCount,5);
});

test('admin publish route invokes publication readiness instead of draft preview',()=>{
 const route=fs.readFileSync(path.resolve(__dirname,'../src/routes/admin.js'),'utf8');
 const update=route.slice(route.indexOf("router.put('/tests/:id'"));
 assert.match(update,/await content\.publicationReadiness/);
 assert.match(update,/return bad\(res,readiness\.error,409\)/);
 assert.doesNotMatch(update,/await content\.previewTest/);
});

test('admin UI requires explicit confirmation before publishing',()=>{
 const src=fs.readFileSync(path.resolve(__dirname,'../exam-practice-pro/components/admin/tests-tab.tsx'),'utf8');
 assert.match(src,/window\.confirm\('Publish this mock/);
 assert.match(src,/window\.confirm\('Publish "'/);
 assert.match(src,/Test Draft/);
});
