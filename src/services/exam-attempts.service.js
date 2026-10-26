'use strict';
const db = require('../config/database');
const mocks = require('./mocks.service');
const { isPlanActive } = require('./plan.service');
const { cleanResponses, grade, visibleAttempt } = require('./exam-grade');

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const VALID_ID = /^[a-z0-9-]{1,60}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function start(user, testId) {
  if (!VALID_ID.test(testId)) throw fail('Invalid test ID');
  const found = await mocks.findMock(testId);
  if (!found) throw fail('Published test not found', 404);
  if (found.tier === 'premium' && !isPlanActive(user.plan, user.planExpiresAt)) throw fail('Pro plan required', 403);
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    // Serialize starts per (user,test) without races across Render instances.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [user.id, testId]);
    let existing = await client.query(
      'SELECT * FROM exam_attempts_v2 WHERE user_id=$1 AND test_id=$2 AND submitted_at IS NULL FOR UPDATE',
      [user.id, testId]
    );
    if (existing.rowCount) {
      await client.query('COMMIT');
      return visibleAttempt(existing.rows[0]);
    }
    const test = found.build();
    // Include stable text and key snapshot for reviews after edits or retirements.
    const snapshot = { name: test.name, minutes: test.minutes, tier: test.tier,
      marksPerCorrect: test.marksPerCorrect, negativeMarks: test.negativeMarks,
      passPercent: test.passPercent ?? 50, sections: test.sections, questions: test.questions };
    const saved = await client.query(
      `INSERT INTO exam_attempts_v2 (user_id,test_id,snapshot,deadline_at)
       VALUES ($1,$2,$3::jsonb,NOW()+($4*INTERVAL '1 minute')) RETURNING *`,
      [user.id,testId,JSON.stringify(snapshot),test.minutes]
    );
    await client.query('COMMIT');
    return visibleAttempt(saved.rows[0]);
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

async function get(userId, id) {
  if (!UUID.test(id)) throw fail('Invalid attempt ID');
  const r = await db.query('SELECT * FROM exam_attempts_v2 WHERE id=$1 AND user_id=$2', [id,userId]);
  if (!r.rowCount) throw fail('Attempt not found',404);
  return visibleAttempt(r.rows[0]);
}

async function save(userId, id, source, submit = false) {
  if (!UUID.test(id)) throw fail('Invalid attempt ID');
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const r = await client.query('SELECT * FROM exam_attempts_v2 WHERE id=$1 AND user_id=$2 FOR UPDATE', [id,userId]);
    if (!r.rowCount) throw fail('Attempt not found',404);
    const row = r.rows[0];
    if (row.submitted_at) { await client.query('COMMIT'); return visibleAttempt(row); }
    const expired = Date.now() >= new Date(row.deadline_at).getTime();
    // When time expires, grade only previously persisted choices, not late incoming answers.
    if (!submit && expired) throw fail('Exam time expired: submit your saved answers',409);
    const responses = expired ? row.responses : cleanResponses(row.snapshot, source);
    const result = submit ? grade(row.snapshot,responses) : null;
    const updated = await client.query(
      `UPDATE exam_attempts_v2 SET responses=$2::jsonb, submitted_at=CASE WHEN $3 THEN NOW() ELSE NULL END,
       result=$4::jsonb WHERE id=$1 RETURNING *`,
      [id, JSON.stringify(responses), submit, result ? JSON.stringify(result) : null]
    );
    await client.query('COMMIT');
    return visibleAttempt(updated.rows[0]);
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

async function history(userId) {
  const r = await db.query(
    `SELECT id,user_id,test_id,snapshot,responses,started_at,deadline_at,submitted_at,result
       FROM exam_attempts_v2 WHERE user_id=$1 ORDER BY started_at DESC LIMIT 100`, [userId]);
  return r.rows.map(row => {
    const a = visibleAttempt(row);
    return { id:a.id,testId:a.testId,title:a.title,startedAt:a.startedAt,deadlineAt:a.deadlineAt,submittedAt:a.submittedAt,
      result: a.result ? {correct:a.result.correct,incorrect:a.result.incorrect,skipped:a.result.skipped,score:a.result.score,total:a.result.total,percentage:a.result.percentage,passed:a.result.passed} : null };
  });
}
/** Verified user's topic accuracy from graded, submitted server-authoritative attempts. */
async function competitiveAccuracy(userId) {
  const { rows }=await db.query(
    `SELECT snapshot, responses
       FROM exam_attempts_v2
      WHERE user_id=$1 AND submitted_at IS NOT NULL
      ORDER BY submitted_at DESC LIMIT 100`,[userId]);
  const stats = new Map();
  for(const row of rows){
    for(const question of row.snapshot?.questions || []){
      if(typeof question.topic!=='string'||!question.topic.startsWith('comp-'))continue;
      const selected=row.responses?.[question.id];
      if(!Number.isInteger(selected)||selected<0||selected>3)continue;
      const prev=stats.get(question.topic)||{topicId:question.topic,attempted:0,correct:0};
      prev.attempted++;
      if(selected===question.answer)prev.correct++;
      stats.set(question.topic,prev);
    }
  }
  return [...stats.values()].map(x=>({...x,accuracy:Math.round(x.correct/x.attempted*100)}));
}

module.exports = { start, get, save, history, competitiveAccuracy };
