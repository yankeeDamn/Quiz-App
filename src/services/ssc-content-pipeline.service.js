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
module.exports={sections,key,inspect,preview,dashboard};
