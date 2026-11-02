'use strict';
const crypto=require('node:crypto');
const db=require('../config/database');
const mocks=require('./mocks.service');
const {checkQuestion}=require('./content.service');
const columns='id, position, question, options, answer, explanation, difficulty, active, review_status, reviewed_at, access_tier';
const actions=['review','review_publish','publish','draft','access','retire','restore'];
const fail=(message,statusCode=409)=>Object.assign(new Error(message),{statusCode});
function revision(q){
 return crypto.createHash('sha256').update(JSON.stringify([
  q.question,q.options,q.answer,q.explanation,q.difficulty,q.active,q.review_status,
  q.reviewed_at?new Date(q.reviewed_at).toISOString():null,q.access_tier,
 ])).digest('hex');
}
function present(q){return {...q,revision:revision(q)};}
async function apply(id,input,actor){
 if(!actor)throw fail('A verified human reviewer is required.',403);
 if(!actions.includes(input?.action)||!/^[a-f0-9]{64}$/.test(String(input?.revision||'')))
  throw fail('Refresh this topic before changing a question.',400);
 if(['review','review_publish'].includes(input.action)&&input.acknowledged!==true)
  throw fail('Confirm that you checked the question, correct answer and explanation.',400);
 if(input.action==='access'&&!['free','premium'].includes(input.tier))throw fail('Choose Free practice or Pro only.',400);
 const client=await db.getClient();
 try{
  await client.query('BEGIN');
  const {rows}=await client.query(`SELECT ${columns} FROM mock_questions WHERE id=$1 FOR UPDATE`,[id]);
  if(!rows.length)throw fail('Question not found.',404);
  const q=rows[0];
  if(revision(q)!==input.revision)throw fail('This question changed in another window. Refresh the topic and check the latest version.');
  const action=input.action;
  if(['review','review_publish','publish'].includes(action)&&!q.active)throw fail('Restore this retired question before reviewing or publishing it.');
  if(['review','review_publish'].includes(action)){
   const checked=checkQuestion(q);
   if(!checked.ok)throw fail('Correct this question before review: '+checked.error);
  }
  if(action==='publish'&&(!['reviewed','published'].includes(q.review_status)||!q.reviewed_at))
   throw fail('Review this question before publishing it.');
  const unchanged=(action==='access'&&input.tier===q.access_tier)||
   (action==='retire'&&!q.active)||(action==='restore'&&q.active)||
   (action==='publish'&&q.review_status==='published'&&q.reviewed_at);
  if(unchanged){await client.query('COMMIT');return {question:present(q),changed:false};}
  let sql,params=[id];
  if(action==='review'||action==='review_publish'){
   sql=`UPDATE mock_questions SET review_status=$2, reviewed_at=NOW(), reviewed_by=$3, updated_at=NOW() WHERE id=$1 RETURNING ${columns}`;
   params=[id,action==='review_publish'?'published':'reviewed',actor];
  }else if(action==='publish'){
   sql=`UPDATE mock_questions SET review_status='published', updated_at=NOW() WHERE id=$1 RETURNING ${columns}`;
  }else if(action==='draft'||action==='access'){
   sql=`UPDATE mock_questions SET review_status='draft', reviewed_at=NULL, reviewed_by=NULL,
     access_tier=$2, updated_at=NOW() WHERE id=$1 RETURNING ${columns}`;
   params=[id,action==='access'?input.tier:q.access_tier];
  }else{
   sql=`UPDATE mock_questions SET active=$2, updated_at=NOW() WHERE id=$1 RETURNING ${columns}`;
   params=[id,action==='restore'];
  }
  const result=await client.query(sql,params);
  await client.query('COMMIT');mocks.invalidate();
  return {question:present(result.rows[0]),changed:true};
 }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}
 finally{client.release();}
}
module.exports={apply,revision,present};
