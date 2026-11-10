'use strict';
const p=require('./policy');
const v=require('./content-policy');
const f=require('./foundation');

async function bank(c,t,id) {
 p.uuid(id);
 const row=(await c.query('SELECT * FROM pilot_question_banks WHERE institute_id=$1 AND id=$2 FOR SHARE',[t.institute.id,id])).rows[0];
 if(!row||(t.role==='teacher'&&row.created_by!==t.user.id)) throw p.fail('Question bank unavailable',404);
 return row;
}
async function banks(user,slug,raw) {
 return f.within(user,slug,'banks:write',async(c,t)=>{
  if(raw) {
   const row=(await c.query('INSERT INTO pilot_question_banks(institute_id,title,exam_code,created_by) VALUES($1,$2,$3,$4) RETURNING id,title,exam_code',[t.institute.id,p.text(raw.title,160),p.text(raw.examCode,80),user.id])).rows[0];
   await f.audit(c,t.institute.id,user,'bank.created',row.id);return row;
  }
  return (await c.query('SELECT id,title,exam_code,created_by FROM pilot_question_banks WHERE institute_id=$1 AND ($2::uuid IS NULL OR created_by=$2) ORDER BY created_at DESC LIMIT 100',[t.institute.id,t.role==='teacher'?user.id:null])).rows;
 });
}
async function history(c,t,row) {
 await c.query('INSERT INTO pilot_question_versions(institute_id,question_id,version,changed_by,content) VALUES($1,$2,$3,$4,$5)',[t.institute.id,row.id,row.version,t.user.id,JSON.stringify(row)]);
}
async function insertQuestion(c,t,bankId,q) {
 const row=(await c.query(`INSERT INTO pilot_questions(institute_id,bank_id,external_id,topic,difficulty,prompt,options,correct_option,explanation,language,fingerprint,author_id)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,[t.institute.id,bankId,q.external_id,q.topic,q.difficulty,q.prompt,JSON.stringify(q.options),q.correct_option,q.explanation,q.language,q.fingerprint,t.user.id])).rows[0];
 await history(c,t,row);return row;
}
async function questions(user,slug,bankId,query={}) {
 const offset=query.offset===undefined?0:Number(query.offset);v.number(offset,0,100000,true);
 return f.within(user,slug,'questions:write',async(c,t)=>{
  await bank(c,t,bankId);
  return (await c.query('SELECT * FROM pilot_questions WHERE institute_id=$1 AND bank_id=$2 ORDER BY created_at,id LIMIT 50 OFFSET $3',[t.institute.id,bankId,offset])).rows;
 });
}
async function createQuestion(user,slug,bankId,raw) {
 const q=v.question(raw);
 return f.within(user,slug,'questions:write',async(c,t)=>{
  await bank(c,t,bankId);const row=await insertQuestion(c,t,bankId,q);
  await f.audit(c,t.institute.id,user,'question.created',row.id);return row;
 });
}
async function importCsv(user,slug,bankId,source) {
 const rows=v.csv(source);
 return f.within(user,slug,'questions:write',async(c,t)=>{
  await bank(c,t,bankId);const ids=[];
  // All rows validated before the first insert. Duplicate ID/content rolls back the whole import.
  for(const row of rows)ids.push((await insertQuestion(c,t,bankId,row)).id);
  await f.audit(c,t.institute.id,user,'questions.imported',bankId);return {ids,count:ids.length};
 });
}
async function changeQuestion(user,slug,id,raw,action='edit') {
 p.uuid(id);const q=action==='edit'?v.question(raw):null;
 if(!['edit','approve','reject','retire'].includes(action))throw p.fail('Invalid question action');
 return f.within(user,slug,action==='approve'||action==='reject'?'questions:review':'questions:write',async(c,t)=>{
  const old=(await c.query('SELECT * FROM pilot_questions WHERE institute_id=$1 AND id=$2 FOR UPDATE',[t.institute.id,id])).rows[0];
  if(!old)throw p.fail('Question unavailable',404);await bank(c,t,old.bank_id);
  if(old.retired_at)throw p.fail('Retired questions cannot be edited',409);
  if((action==='approve'||action==='reject')&&(!old.author_id||old.author_id===user.id))throw p.fail('A different reviewer must review authored content',409);
  // Preserve the previous version, including imported provenance, before the first change.
  await c.query('INSERT INTO pilot_question_versions(institute_id,question_id,version,changed_by,content) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[t.institute.id,id,old.version,user.id,JSON.stringify(old)]);
  let row;
  if(q) {
   if(q.external_id!==old.external_id)throw p.fail('External question ID is immutable');
   row=(await c.query(`UPDATE pilot_questions SET topic=$3,difficulty=$4,prompt=$5,options=$6,correct_option=$7,explanation=$8,language=$9,fingerprint=$10,
    author_id=$11,review_status='needs_review',reviewer_id=NULL,reviewed_at=NULL,version=version+1 WHERE institute_id=$1 AND id=$2 RETURNING *`,[t.institute.id,id,q.topic,q.difficulty,q.prompt,JSON.stringify(q.options),q.correct_option,q.explanation,q.language,q.fingerprint,user.id])).rows[0];
  } else if(action==='retire') {
   row=(await c.query('UPDATE pilot_questions SET retired_at=now(),version=version+1 WHERE institute_id=$1 AND id=$2 RETURNING *',[t.institute.id,id])).rows[0];
  } else {
   row=(await c.query('UPDATE pilot_questions SET review_status=$3,reviewer_id=$4,reviewed_at=now(),version=version+1 WHERE institute_id=$1 AND id=$2 RETURNING *',[t.institute.id,id,action==='approve'?'approved':'rejected',user.id])).rows[0];
  }
  await history(c,t,row);await f.audit(c,t.institute.id,user,'question.'+action,id);return row;
 });
}
async function versions(user,slug,id) {
 p.uuid(id);return f.within(user,slug,'questions:write',async(c,t)=>{
  const q=(await c.query('SELECT bank_id FROM pilot_questions WHERE institute_id=$1 AND id=$2',[t.institute.id,id])).rows[0];
  if(!q)throw p.fail('Question unavailable',404);await bank(c,t,q.bank_id);
  return (await c.query('SELECT version,content,created_at FROM pilot_question_versions WHERE institute_id=$1 AND question_id=$2 ORDER BY version DESC LIMIT 100',[t.institute.id,id])).rows;
 });
}
async function batches(user,slug,raw) {
 return f.within(user,slug,raw?'batches:write':'workspace:read',async(c,t)=>{
  if(raw){const row=(await c.query('INSERT INTO pilot_batches(institute_id,name) VALUES($1,$2) RETURNING id,name',[t.institute.id,p.text(raw.name,160)])).rows[0];await f.audit(c,t.institute.id,user,'batch.created',row.id);return row;}
  if(!['owner','admin','teacher'].includes(t.role))throw p.fail('Permission denied',403);
  return (await c.query(`SELECT b.id,b.name FROM pilot_batches b WHERE b.institute_id=$1 AND ($2::uuid IS NULL OR EXISTS
   (SELECT 1 FROM pilot_batch_teachers bt WHERE bt.institute_id=b.institute_id AND bt.batch_id=b.id AND bt.user_id=$2)) ORDER BY b.name LIMIT 100`,[t.institute.id,t.role==='teacher'?user.id:null])).rows;
 });
}
async function batchMember(user,slug,batchId,memberId,role,remove=false) {
 p.uuid(batchId);p.uuid(memberId);if(!['student','teacher'].includes(role))throw p.fail('Invalid batch role');
 return f.within(user,slug,'batches:write',async(c,t)=>{
  const b=await c.query('SELECT id FROM pilot_batches WHERE institute_id=$1 AND id=$2 FOR UPDATE',[t.institute.id,batchId]);
  if(!b.rowCount)throw p.fail('Batch unavailable',404);
  const m=await c.query("SELECT 1 FROM pilot_memberships WHERE institute_id=$1 AND user_id=$2 AND role=$3 AND status='active' FOR SHARE",[t.institute.id,memberId,role]);
  if(!remove&&!m.rowCount)throw p.fail('Active member with the selected role required',404);
  const table=role==='student'?'pilot_batch_students':'pilot_batch_teachers'; // fixed allowlist, never caller SQL
  if(remove)await c.query(`DELETE FROM ${table} WHERE institute_id=$1 AND batch_id=$2 AND user_id=$3`,[t.institute.id,batchId,memberId]);
  else await c.query(`INSERT INTO ${table}(institute_id,batch_id,user_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`,[t.institute.id,batchId,memberId]);
  await f.audit(c,t.institute.id,user,'batch.'+role+(remove?'.removed':'.added'),batchId);return {updated:true};
 });
}
async function batchMembers(user,slug,batchId) {
 p.uuid(batchId);return f.within(user,slug,'workspace:read',async(c,t)=>{
  if(!['owner','admin','teacher'].includes(t.role))throw p.fail('Permission denied',403);
  const b=await c.query('SELECT id FROM pilot_batches WHERE institute_id=$1 AND id=$2 FOR SHARE',[t.institute.id,batchId]);
  if(!b.rowCount)throw p.fail('Batch unavailable',404);
  if(t.role==='teacher'&&!(await c.query('SELECT 1 FROM pilot_batch_teachers WHERE institute_id=$1 AND batch_id=$2 AND user_id=$3 FOR SHARE',[t.institute.id,batchId,user.id])).rowCount)throw p.fail('Batch unavailable',404);
  return (await c.query(`SELECT m.user_id,u.name,u.email,m.role,m.status FROM pilot_memberships m JOIN users u ON u.id=m.user_id
   WHERE m.institute_id=$1 AND m.status='active' AND ((m.role='student' AND EXISTS(SELECT 1 FROM pilot_batch_students b WHERE b.institute_id=m.institute_id AND b.batch_id=$2 AND b.user_id=m.user_id))
   OR (m.role='teacher' AND EXISTS(SELECT 1 FROM pilot_batch_teachers b WHERE b.institute_id=m.institute_id AND b.batch_id=$2 AND b.user_id=m.user_id))) ORDER BY u.name,m.user_id LIMIT 200`,[t.institute.id,batchId])).rows;
 });
}
async function exam(c,t,id,lock='SHARE') {
 p.uuid(id);const e=(await c.query(`SELECT * FROM pilot_exams WHERE institute_id=$1 AND id=$2 FOR ${lock}`,[t.institute.id,id])).rows[0];
 if(!e||(t.role==='teacher'&&e.created_by!==t.user.id))throw p.fail('Exam unavailable',404);return e;
}
async function exams(user,slug) {
 return f.within(user,slug,'exams:write',async(c,t)=>(await c.query('SELECT id,title,status,duration_minutes,starts_at,ends_at,definition FROM pilot_exams WHERE institute_id=$1 AND ($2::uuid IS NULL OR created_by=$2) ORDER BY created_at DESC LIMIT 100',[t.institute.id,t.role==='teacher'?user.id:null])).rows);
}
async function saveExam(user,slug,raw,id) {
 const d=v.definition(raw);if(id)p.uuid(id);
 return f.within(user,slug,'exams:write',async(c,t)=>{
  await bank(c,t,d.bankId);
  if(id){const old=await exam(c,t,id,'UPDATE');if(old.status!=='draft')throw p.fail('Only drafts can be edited',409);}
  const ids=d.sections.flatMap(s=>s.questionIds);
  const count=await c.query('SELECT id FROM pilot_questions WHERE institute_id=$1 AND bank_id=$2 AND id=ANY($3::uuid[]) AND retired_at IS NULL FOR SHARE',[t.institute.id,d.bankId,ids]);
  if(count.rowCount!==ids.length)throw p.fail('Question selection unavailable',404);
  const values=[t.institute.id,d.bankId,d.title,d.minutes,d.startsAt,d.endsAt,JSON.stringify(d),user.id];
  const row=(await c.query(id?`UPDATE pilot_exams SET bank_id=$2,title=$3,duration_minutes=$4,starts_at=$5,ends_at=$6,definition=$7 WHERE institute_id=$1 AND id=$8 RETURNING id,title,status`:
   `INSERT INTO pilot_exams(institute_id,bank_id,title,duration_minutes,starts_at,ends_at,definition,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,title,status`,id?[...values.slice(0,7),id]:values)).rows[0];
  await c.query('DELETE FROM pilot_exam_questions WHERE institute_id=$1 AND exam_id=$2',[t.institute.id,row.id]);
  for(let n=0;n<ids.length;n++)await c.query('INSERT INTO pilot_exam_questions(institute_id,exam_id,question_id,position) VALUES($1,$2,$3,$4)',[t.institute.id,row.id,ids[n],n+1]);
  await f.audit(c,t.institute.id,user,'exam.draft.saved',row.id);return row;
 });
}
async function assign(user,slug,id,batchId,remove=false) {
 p.uuid(batchId);return f.within(user,slug,'exams:publish',async(c,t)=>{
  await exam(c,t,id,'UPDATE');
  const b=await c.query('SELECT id FROM pilot_batches WHERE institute_id=$1 AND id=$2 FOR SHARE',[t.institute.id,batchId]);if(!b.rowCount)throw p.fail('Batch unavailable',404);
  if(remove)await c.query('DELETE FROM pilot_exam_assignments WHERE institute_id=$1 AND exam_id=$2 AND batch_id=$3',[t.institute.id,id,batchId]);
  else await c.query('INSERT INTO pilot_exam_assignments(institute_id,exam_id,batch_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[t.institute.id,id,batchId]);
  await f.audit(c,t.institute.id,user,remove?'exam.unassigned':'exam.assigned',id);return {updated:true};
 });
}
async function publish(user,slug,id) {
 return f.within(user,slug,'exams:publish',async(c,t)=>{
  const e=await exam(c,t,id,'UPDATE');if(e.status!=='draft'||!e.definition)throw p.fail('A configured draft is required',409);
  const d=v.definition(e.definition),ids=d.sections.flatMap(s=>s.questionIds);
  const rows=(await c.query("SELECT * FROM pilot_questions WHERE institute_id=$1 AND bank_id=$2 AND id=ANY($3::uuid[]) AND retired_at IS NULL AND review_status='approved' AND reviewer_id IS NOT NULL AND author_id<>reviewer_id FOR SHARE",[t.institute.id,e.bank_id,ids])).rows;
  if(rows.length!==ids.length)throw p.fail('All questions need independent human approval',409);
  if(!(await c.query('SELECT 1 FROM pilot_exam_assignments WHERE institute_id=$1 AND exam_id=$2',[t.institute.id,id])).rowCount)throw p.fail('Assign at least one batch before publication',409);
  const now=(await c.query('SELECT now() AS now')).rows[0].now;if(new Date(d.endsAt)<=now)throw p.fail('Exam window has already ended',409);
  const byId=new Map(rows.map(q=>[q.id,q]));
  const snapshot={name:d.title,minutes:d.minutes,marksPerCorrect:d.marksPerCorrect,negativeMarks:d.negativeMarks,passPercent:d.passPercent,endsAt:d.endsAt,sections:d.sections.map(s=>s.name),questions:d.sections.flatMap(s=>s.questionIds.map(id=>{const q=byId.get(id);return {id,version:q.version,topic:q.topic,section:s.name,question:q.prompt,options:q.options,answer:'ABCD'.indexOf(q.correct_option),explanation:q.explanation,language:q.language};}))};
  await c.query("UPDATE pilot_exams SET status='published',snapshot=$3,published_at=now() WHERE institute_id=$1 AND id=$2",[t.institute.id,id,JSON.stringify(snapshot)]);
  await f.audit(c,t.institute.id,user,'exam.published',id);return {id,status:'published',questionCount:ids.length};
 });
}
module.exports={banks,questions,createQuestion,importCsv,changeQuestion,versions,batches,batchMember,batchMembers,exams,saveExam,assign,publish};
