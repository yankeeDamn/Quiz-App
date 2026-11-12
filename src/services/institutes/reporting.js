'use strict';
const f = require('./foundation'), p = require('./policy');

async function scope(c,t,batchId) {
  p.uuid(batchId);
  if (!p.can(t.role,'reports:read') && !p.can(t.role,'assigned:reports')) throw p.fail('Permission denied',403);
  if (!(await c.query('SELECT id FROM pilot_batches WHERE institute_id=$1 AND id=$2 FOR SHARE',[t.institute.id,batchId])).rowCount) throw p.fail('Batch unavailable',404);
  if (t.role === 'teacher' && !(await c.query('SELECT 1 FROM pilot_batch_teachers WHERE institute_id=$1 AND batch_id=$2 AND user_id=$3 FOR SHARE',[t.institute.id,batchId,t.user.id])).rowCount) throw p.fail('Batch unavailable',404);
}
// Each current active student and assigned published exam appears once. Legacy
// snapshots are excluded; reports never consume client-reported practice scores.
const population = `WITH population AS (
 SELECT e.id exam_id,e.title,bs.user_id student_id,a.id attempt_id,a.submitted_at,a.result,a.snapshot,a.responses
 FROM pilot_exam_assignments ea
 JOIN pilot_exams e ON e.institute_id=ea.institute_id AND e.id=ea.exam_id AND e.status='published' AND e.snapshot IS NOT NULL
 JOIN pilot_batch_students bs ON bs.institute_id=ea.institute_id AND bs.batch_id=ea.batch_id
 JOIN pilot_memberships m ON m.institute_id=bs.institute_id AND m.user_id=bs.user_id AND m.status='active' AND m.role='student'
 LEFT JOIN pilot_attempts a ON a.institute_id=e.institute_id AND a.exam_id=e.id AND a.student_id=bs.user_id AND a.snapshot IS NOT NULL
 WHERE ea.institute_id=$1 AND ea.batch_id=$2
)`;
function offset(value=0) {
  const n=Number(value);if(!Number.isInteger(n)||n<0||n>100000)throw p.fail('Invalid report page');return n;
}
async function analytics(user,slug,batchId) {
  return f.within(user,slug,'workspace:read',async(c,t)=>{
    await scope(c,t,batchId);const params=[t.institute.id,batchId];
    const summary=(await c.query(population+` SELECT count(*)::int AS eligible_assignments,
      count(DISTINCT student_id)::int AS students,count(DISTINCT exam_id)::int AS exams,
      count(attempt_id)::int AS started,count(submitted_at)::int AS submitted,
      COALESCE(round(avg((result->>'percentage')::numeric) FILTER (WHERE submitted_at IS NOT NULL),2),0)::float8 AS average_percentage,
      COALESCE(round(100.0*count(submitted_at)/NULLIF(count(*),0),2),0)::float8 AS completion_percentage FROM population`,params)).rows[0];
    const performance=(await c.query(population+`, answers AS (
      SELECT COALESCE(q->>'topic','Uncategorized') AS topic,COALESCE(q->>'section','Uncategorized') AS section,
      CASE WHEN responses ? (q->>'id') THEN CASE WHEN (responses->>(q->>'id'))::int=(q->>'answer')::int THEN 'correct' ELSE 'incorrect' END ELSE 'skipped' END AS outcome
      FROM population CROSS JOIN LATERAL jsonb_array_elements(snapshot->'questions') q WHERE submitted_at IS NOT NULL
    ), grouped AS (
      SELECT 'topic' AS kind,topic AS name,count(*)::int AS questions,
       count(*) FILTER(WHERE outcome='correct')::int AS correct,count(*) FILTER(WHERE outcome='incorrect')::int AS incorrect,count(*) FILTER(WHERE outcome='skipped')::int AS skipped FROM answers GROUP BY topic
      UNION ALL SELECT 'section',section,count(*)::int,count(*) FILTER(WHERE outcome='correct')::int,count(*) FILTER(WHERE outcome='incorrect')::int,count(*) FILTER(WHERE outcome='skipped')::int FROM answers GROUP BY section
    ) SELECT * FROM grouped ORDER BY kind,name`,params)).rows;
    return {summary,performance,scope:'Current active batch members and assigned published exams',generatedAt:new Date().toISOString()};
  });
}
function csvCell(value) {
  let s=String(value??'');
  // Quote alone does not prevent spreadsheet formula injection (including hidden whitespace).
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s)) s="'"+s;
  return '"'+s.replaceAll('"','""')+'"';
}
async function exportPage(user,slug,batchId,rawOffset) {
  const page=offset(rawOffset);
  return f.within(user,slug,'workspace:read',async(c,t)=>{
    await scope(c,t,batchId);
    const rows=(await c.query(population+` SELECT p.attempt_id,p.exam_id,p.title,u.name,p.result,p.submitted_at
      FROM population p JOIN users u ON u.id=p.student_id WHERE p.submitted_at IS NOT NULL
      ORDER BY p.submitted_at,p.attempt_id LIMIT 501 OFFSET $3`,[t.institute.id,batchId,page])).rows;
    const exported=rows.slice(0,500);
    const header=['Attempt ID','Exam ID','Exam','Student','Score','Total','Percentage','Submitted (UTC)'];
    const csv=[header,...exported.map(r=>[r.attempt_id,r.exam_id,r.title,r.name||'Student',r.result.score,r.result.total,r.result.percentage,r.submitted_at.toISOString()])].map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n';
    await f.audit(c,t.institute.id,user,'report.exported',batchId);
    return {csv,filename:`batch-report-${batchId}-${page}.csv`,count:exported.length,nextOffset:rows.length>500?page+500:null};
  });
}
module.exports={analytics,exportPage,csvCell,offset};
