'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const db=require('../src/config/database');
const content=require('../src/services/content.service');
const {validate}=require('../scripts/ssc-cgl-mock-01');

test('inactive topics can be created safely by the existing admin service',async t=>{
 const queries=[];
 t.mock.method(db,'query',async(sql,params)=>{
   queries.push({sql,params});
   if(sql.startsWith('SELECT 1'))return {rows:[],rowCount:0};
   if(sql.startsWith('INSERT INTO mock_topics'))return {rows:[],rowCount:1};
   throw Error('Unexpected SQL '+sql);
 });
 const response=await content.createTopic({id:'ssc26-m01-qa-draft',name:'QA Draft',category:'SSC',active:false});
 assert.equal(response.ok,true);
 const insert=queries.find(x=>x.sql.startsWith('INSERT INTO mock_topics'));
 assert.ok(insert);
 assert.match(insert.sql,/active/);
 assert.equal(insert.params[3],false);
});

test('admin preview includes inactive draft topics without publishing them',async t=>{
 const {allQuestionRows,manifest}=validate();
 const topics=allQuestionRows.map(x=>({id:x.topic.id,name:x.topic.name,category:'SSC',active:false}));
 const questions=allQuestionRows.flatMap(x=>x.rows.map((q,position)=>({
   topic_id:x.topic.id,position,question:q.question,options:q.options,
   answer:q.answer,explanation:q.explanation,active:true
 })));
 let calls=0;
 t.mock.method(db,'query',async(sql,params)=>{
   calls++;
   const ids=params[0];
   assert.equal(ids.length,4);
   assert.deepEqual(ids,manifest.topics.map(x=>x.id));
   if(sql.includes('FROM mock_topics'))return {rows:topics,rowCount:4};
   if(sql.includes('FROM mock_questions'))return {rows:questions,rowCount:100};
   throw Error('Unexpected admin preview query '+sql);
 });
 const preview=await content.previewTest(manifest.mock);
 assert.equal(preview.questionCount,100);
 assert.equal(preview.questions.length,100);
 assert.equal(preview.questionIds.length,100);
 assert.equal(calls,2);
 assert.equal(JSON.stringify(preview).includes('correctAnswer'),false);
 assert.equal(JSON.stringify(preview).includes('explanation'),false);
});

test('creation rejects nonboolean active value before the insert',async t=>{
 let inserts=0;
 t.mock.method(db,'query',async(sql)=>{
   if(sql.startsWith('SELECT 1'))return {rows:[],rowCount:0};
   if(sql.startsWith('INSERT'))inserts++;
   return {rows:[],rowCount:0};
 });
 const response=await content.createTopic({id:'draft-boolean-test',name:'Draft',category:'SSC',active:'false'});
 assert.equal(response.ok,false);
 assert.equal(inserts,0);
});
