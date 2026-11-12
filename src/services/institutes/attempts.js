'use strict';
const p=require('./policy'),v=require('./content-policy'),f=require('./foundation');
const {cleanResponses,grade}=require('../exam-grade');
async function clock(c) { return (await c.query('SELECT clock_timestamp() AS now')).rows[0].now; }
async function eligible(c,t,id) {
 p.uuid(id);
 const e=(await c.query("SELECT * FROM pilot_exams WHERE institute_id=$1 AND id=$2 AND status='published' AND snapshot IS NOT NULL FOR SHARE",[t.institute.id,id])).rows[0];
 if(!e)throw p.fail('Assigned exam unavailable',404);
 const access=await c.query(`SELECT ea.batch_id FROM pilot_exam_assignments ea JOIN pilot_batch_students bs ON bs.institute_id=ea.institute_id AND bs.batch_id=ea.batch_id
  WHERE ea.institute_id=$1 AND ea.exam_id=$2 AND bs.user_id=$3 FOR SHARE OF ea,bs`,[t.institute.id,id,t.user.id]);
 if(!access.rowCount)throw p.fail('Assigned exam unavailable',404);return e;
}
function visible(a,now) {
 const s=a.snapshot;
 const result=a.submitted_at?{...a.result}:null;
 // Explain answers only when the shared exam window has closed, even after early submission.
 if(result&&now<new Date(s.endsAt))delete result.review;
 return {id:a.id,examId:a.exam_id,title:s.name,startedAt:a.started_at,deadlineAt:a.deadline_at,serverNow:now,submittedAt:a.submitted_at,revision:a.revision,responses:a.responses,result,
  test:{minutes:s.minutes,sections:s.sections,marksPerCorrect:s.marksPerCorrect,negativeMarks:s.negativeMarks,questions:s.questions.map(q=>({id:q.id,topic:q.topic,section:q.section,question:q.question,options:q.options,language:q.language}))}};
}
async function finish(c,t,a) {
 const result=grade(a.snapshot,a.responses);
 const row=(await c.query(`UPDATE pilot_attempts SET submitted_at=clock_timestamp(),score=$3,total=$4,result=$5,answers=responses,revision=revision+1
  WHERE institute_id=$1 AND id=$2 AND submitted_at IS NULL RETURNING *`,[t.institute.id,a.id,result.correct,a.snapshot.questions.length,JSON.stringify(result)])).rows[0];
 await f.audit(c,t.institute.id,t.user,'attempt.submitted',a.id);return row;
}
async function assigned(user,slug) {
 return f.within(user,slug,'assigned:take',async(c,t)=>(await c.query(`SELECT e.id,e.title,e.duration_minutes,e.starts_at,e.ends_at,jsonb_array_length(e.snapshot->'questions') AS question_count,
  a.id AS attempt_id,a.submitted_at FROM pilot_exams e LEFT JOIN pilot_attempts a ON a.institute_id=e.institute_id AND a.exam_id=e.id AND a.student_id=$2
  WHERE e.institute_id=$1 AND e.status='published' AND e.snapshot IS NOT NULL AND EXISTS
  (SELECT 1 FROM pilot_exam_assignments ea JOIN pilot_batch_students bs ON bs.institute_id=ea.institute_id AND bs.batch_id=ea.batch_id
   WHERE ea.institute_id=e.institute_id AND ea.exam_id=e.id AND bs.user_id=$2) ORDER BY e.starts_at DESC LIMIT 100`,[t.institute.id,user.id])).rows);
}
async function start(user,slug,id) {
 return f.within(user,slug,'assigned:take',async(c,t)=>{
  const e=await eligible(c,t,id),now=await clock(c);
  let a=(await c.query('SELECT * FROM pilot_attempts WHERE institute_id=$1 AND exam_id=$2 AND student_id=$3 FOR UPDATE',[t.institute.id,id,user.id])).rows[0];
  if(!a) {
   if(now<e.starts_at||now>=e.ends_at)throw p.fail('Exam is outside its scheduled window',409);
   const deadline=new Date(Math.min(+now+e.duration_minutes*60000,+e.ends_at));
   const inserted=await c.query(`INSERT INTO pilot_attempts(institute_id,exam_id,student_id,started_at,deadline_at,snapshot)
    VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(exam_id,student_id) DO NOTHING RETURNING *`,[t.institute.id,id,user.id,now,deadline,JSON.stringify(e.snapshot)]);
   a=inserted.rows[0]||(await c.query('SELECT * FROM pilot_attempts WHERE institute_id=$1 AND exam_id=$2 AND student_id=$3 FOR UPDATE',[t.institute.id,id,user.id])).rows[0];
   if(inserted.rowCount)await f.audit(c,t.institute.id,user,'attempt.started',a.id);
  }
  if(!a.snapshot)throw p.fail('Legacy attempt is not supported by this runner',409);
  const current=await clock(c);if(!a.submitted_at&&current>=a.deadline_at)a=await finish(c,t,a);
  return visible(a,current);
 });
}
async function attempt(user,slug,id,raw,submit=false) {
 p.uuid(id);
 return f.within(user,slug,'own:results',async(c,t)=>{
  const hint=(await c.query('SELECT exam_id FROM pilot_attempts WHERE institute_id=$1 AND id=$2 AND student_id=$3',[t.institute.id,id,user.id])).rows[0];
  if(!hint)throw p.fail('Attempt unavailable',404);
  // Match start's lock order. Membership revocation or assignment removal blocks ongoing delivery.
  const e=(await c.query('SELECT id FROM pilot_exams WHERE institute_id=$1 AND id=$2 FOR SHARE',[t.institute.id,hint.exam_id])).rows[0];
  let a=(await c.query('SELECT * FROM pilot_attempts WHERE institute_id=$1 AND id=$2 AND student_id=$3 FOR UPDATE',[t.institute.id,id,user.id])).rows[0];
  if(!e||!a?.snapshot)throw p.fail('Attempt unavailable',404);
  if(a.submitted_at)return visible(a,await clock(c)); // Duplicate submit is idempotent, cannot alter a grade.
  await eligible(c,t,hint.exam_id);
  const now=await clock(c);
  if(now>=a.deadline_at) {a=await finish(c,t,a);return visible(a,now);} // Late client answers are ignored.
  if(raw) {
   v.number(raw.revision,0,2147483646,true);
   if(raw.revision!==a.revision)throw p.fail('Answers changed on another device; reload before saving',409);
   const responses=cleanResponses(a.snapshot,raw.responses);
   a=(await c.query('UPDATE pilot_attempts SET responses=$3,revision=revision+1 WHERE institute_id=$1 AND id=$2 RETURNING *',[t.institute.id,id,JSON.stringify(responses)])).rows[0];
  }
  if(submit)a=await finish(c,t,a);
  return visible(a,now);
 });
}
async function results(user,slug) {
 return f.within(user,slug,'own:results',async(c,t)=>(await c.query(`SELECT id,exam_id,started_at,submitted_at,snapshot->>'name' AS title,
  result-'review' AS result FROM pilot_attempts WHERE institute_id=$1 AND student_id=$2 AND snapshot IS NOT NULL ORDER BY started_at DESC LIMIT 100`,[t.institute.id,user.id])).rows);
}
async function report(user,slug,batchId) {
 p.uuid(batchId);
 return f.within(user,slug,'workspace:read',async(c,t)=>{
  if(!p.can(t.role,'reports:read')&&!p.can(t.role,'assigned:reports'))throw p.fail('Permission denied',403);
  const batch=await c.query('SELECT id FROM pilot_batches WHERE institute_id=$1 AND id=$2 FOR SHARE',[t.institute.id,batchId]);
  if(!batch.rowCount)throw p.fail('Batch unavailable',404);
  if(t.role==='teacher'&&!(await c.query('SELECT 1 FROM pilot_batch_teachers WHERE institute_id=$1 AND batch_id=$2 AND user_id=$3 FOR SHARE',[t.institute.id,batchId,user.id])).rowCount)throw p.fail('Batch unavailable',404);
  return (await c.query(`SELECT a.id,a.student_id,u.name,a.exam_id,e.title,a.submitted_at,a.result-'review' AS result
   FROM pilot_attempts a JOIN pilot_batch_students bs ON bs.institute_id=a.institute_id AND bs.user_id=a.student_id
   JOIN pilot_exam_assignments ea ON ea.institute_id=a.institute_id AND ea.exam_id=a.exam_id AND ea.batch_id=bs.batch_id
   JOIN pilot_memberships m ON m.institute_id=a.institute_id AND m.user_id=a.student_id AND m.status='active'
   JOIN users u ON u.id=a.student_id JOIN pilot_exams e ON e.institute_id=a.institute_id AND e.id=a.exam_id
   WHERE a.institute_id=$1 AND bs.batch_id=$2 AND a.submitted_at IS NOT NULL AND a.snapshot IS NOT NULL
   ORDER BY a.submitted_at DESC LIMIT 100`,[t.institute.id,batchId])).rows;
 });
}
module.exports={assigned,start,attempt,results,report,visible};
