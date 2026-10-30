'use strict';
// Deterministic, read-only staging content planning for Mock 02–10.
// Never writes, activates topics, grants academic approval or publishes tests.
const db=require('../config/database');
const gate=require('./draft-testing-gate');
const content=require('./content.service');
const crypto=require('node:crypto');
const sections=['reasoning','general-awareness','quant','english'];
const bad=(message,statusCode=400)=>Object.assign(new Error(message),{statusCode});
function key(s){return String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');}
function inspect(number,questions,existing=[]){
 if(!Number.isInteger(number)||number<2||number>10)throw bad('Select mock number 02–10.');
 if(!questions||typeof questions!=='object'||Array.isArray(questions))throw bad('Four section question arrays required.');
 const issues=[],seen=new Set(existing.map(key)),hashes=new Set(),counts={};
 for(const section of sections){
  const rows=questions[section];
  counts[section]=Array.isArray(rows)?rows.length:0;
  if(!Array.isArray(rows)||rows.length!==25){issues.push({section,row:0,message:'Exactly 25 questions required.'});continue;}
  for(let i=0;i<rows.length;i++){
   const validation=content.checkQuestion(rows[i]);
   if(!validation.ok){issues.push({section,row:i+1,message:validation.error});continue;}
   const v=validation.value;
   const canonical=key(v.question);
   const fingerprint=crypto.createHash('sha256').update(canonical).digest('hex');
   if(seen.has(canonical)||hashes.has(fingerprint))issues.push({section,row:i+1,message:'Duplicate question found across mocks or sections.'});
   hashes.add(fingerprint);
   if(section!=='english'&&rows[i].hindiStatus==='verified')
    issues.push({section,row:i+1,message:'Imported machine translations cannot claim human-verified Hindi status.'});
   if(v.explanation.length<15)issues.push({section,row:i+1,message:'Explanation needs at least 15 characters for editorial QA.'});
  }
 }
 return {number,draftOnly:true,valid:issues.length===0,counts,expected:100,issues,
  academicApproved:0,hindiRequired:75,hindiVerified:0,canPublish:false};
}
async function preview(number,questions){
 if(!gate.enabled())throw bad('Content pipeline is enabled only on isolated staging.',404);
 // Full-bank duplicate search, including unpublished topics; no writes.
 const r=await db.query('SELECT question FROM mock_questions');
 return inspect(number,questions,r.rows.map(x=>x.question));
}
async function stage(number,questions){
 if(!gate.enabled())throw bad('Draft creation is enabled only on isolated staging.',404);
 const client=await db.getClient();
 let committed=false;
 try{
  await client.query('BEGIN');
  // Serialize pipeline writers across Mock 02–10 on this database.
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['exampro-ssc-content-pipeline']);
  const testId='ssc-cgl-2026-mock-'+String(number).padStart(2,'0');
  const existingTest=await client.query('SELECT id FROM mock_tests WHERE id=$1',[testId]);
  if(existingTest.rowCount)throw bad('This mock already exists. Refusing to overwrite existing drafts.',409);
  const prior=await client.query('SELECT question FROM mock_questions');
  const checked=inspect(number,questions,prior.rows.map(r=>r.question));
  if(!checked.valid)throw Object.assign(bad('Draft validation failed.',422),{issues:checked.issues});
  const sectionsForTest=[];
  for(const section of sections){
   const topicId='ssc26-m'+String(number).padStart(2,'0')+'-'+(section==='general-awareness'?'gk':section);
   const existingTopic=await client.query('SELECT id FROM mock_topics WHERE id=$1',[topicId]);
   if(existingTopic.rowCount)throw bad('Draft source topic already exists: '+topicId,409);
   const title=section==='general-awareness'?'General Awareness':section[0].toUpperCase()+section.slice(1);
   await client.query('INSERT INTO mock_topics(id,name,category,active) VALUES($1,$2,$3,false)',
     [topicId,'SSC CGL 2026 Mock '+String(number).padStart(2,'0')+' '+title,'SSC CGL']);
   for(let index=0;index<25;index++){
    const v=content.checkQuestion(questions[section][index]).value;
    await client.query(`INSERT INTO mock_questions(topic_id,position,question,options,answer,explanation,difficulty,active)
      VALUES($1,$2,$3,$4::jsonb,$5,$6,$7,true)`,
      [topicId,index,v.question,JSON.stringify(v.options),v.answer,v.explanation,v.difficulty]);
   }
   sectionsForTest.push({name:title,parts:[{topic:topicId,from:0,to:25}]});
  }
  await client.query(`INSERT INTO mock_tests
   (id,name,exam,minutes,marks_per_correct,negative_marks,level,tier,sections,pass_percent,active)
   VALUES($1,$2,$3,60,2,0.5,'Moderate','free',$4::jsonb,50,false)`,
   [testId,'SSC CGL 2026 Mock '+String(number).padStart(2,'0'),'SSC',JSON.stringify(sectionsForTest)]);
  await client.query('COMMIT');committed=true;
  require('./mocks.service').invalidate();
  return {testId,created:true,active:false,topicsActive:false,questions:100,
   academicApproved:0,hindiVerified:0,hindiRequired:75};
 }catch(error){
  if(!committed)await client.query('ROLLBACK').catch(()=>{});
  throw error;
 }finally{client.release();}
}
async function dashboard(){
 if(!gate.enabled())throw bad('Content dashboard is enabled only on isolated staging.',404);
 const r=await db.query(`SELECT id,name,active FROM mock_tests
 WHERE id ~ '^ssc-cgl-20[0-9]{2}-mock-(0[2-9]|10)$' ORDER BY id`);
 const tests=[];
 const quality=require('./mock-quality.service');
 for(const t of r.rows){
  const review=await quality.list(t.id);
  tests.push({id:t.id,name:t.name,draft:!t.active,expected:review.expected,actual:review.actual,
   academicApproved:review.academicApproved,hindiRequired:review.hindiRequired,
   hindiVerified:review.hindiVerified,ready:review.ready});
 }
 return {draftOnly:true,tests,target:9,missing:9-tests.length};
}
module.exports={sections,key,inspect,preview,stage,dashboard};
