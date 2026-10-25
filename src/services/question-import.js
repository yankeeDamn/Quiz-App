'use strict';
const db = require('../config/database');
const content = require('./content.service');
const mocks = require('./mocks.service');

function normalize(value) { return String(value||'').trim().toLocaleLowerCase('en'); }

function inspect(rows, existing) {
  const errors = [], values = [], seen = new Set(existing.map(normalize));
  if (!Array.isArray(rows)||rows.length<1||rows.length>200) return {errors:[{row:0,message:'Send 1 to 200 questions'}],values:[]};
  rows.forEach((row,i)=>{
    const checked=content.checkQuestion(row);
    if(!checked.ok){errors.push({row:i+2,message:checked.error});return}
    const key=normalize(checked.value.question);
    if(seen.has(key)){errors.push({row:i+2,message:'Duplicate question (existing or repeated in file)'});return}
    seen.add(key);values.push(checked.value);
  });
  return {errors,values};
}
async function preview(topicId,rows) {
  const r=await db.query('SELECT question FROM mock_questions WHERE topic_id=$1',[topicId]);
  const result=inspect(rows,r.rows.map(x=>x.question));
  return {valid:result.errors.length===0,count:result.values.length,errors:result.errors};
}
async function importRows(topicId,rows) {
  const client=await db.getClient();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[topicId]);
    const topic=await client.query('SELECT id FROM mock_topics WHERE id=$1 FOR UPDATE',[topicId]);
    if(!topic.rowCount)throw Object.assign(new Error('Topic not found'),{statusCode:404});
    const existing=await client.query('SELECT question FROM mock_questions WHERE topic_id=$1',[topicId]);
    const checked=inspect(rows,existing.rows.map(x=>x.question));
    if(checked.errors.length){await client.query('ROLLBACK');return {valid:false,errors:checked.errors,added:0}}
    const position=await client.query('SELECT COALESCE(MAX(position),-1)::int AS last FROM mock_questions WHERE topic_id=$1',[topicId]);
    let next=position.rows[0].last+1;
    for(const v of checked.values)await client.query(
      'INSERT INTO mock_questions(topic_id,position,question,options,answer,explanation,difficulty) VALUES($1,$2,$3,$4::jsonb,$5,$6,$7)',
      [topicId,next++,v.question,JSON.stringify(v.options),v.answer,v.explanation,v.difficulty]
    );
    await client.query('COMMIT');
    mocks.invalidate();
    return {valid:true,errors:[],added:checked.values.length};
  }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error}
  finally{client.release()}
}
module.exports={inspect,preview,importRows};
