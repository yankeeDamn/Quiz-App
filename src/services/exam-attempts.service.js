'use strict';
const db = require('../config/database');
const mocks = require('./mocks.service');
const content = require('./content.service');
const accommodations = require('./ssc-accommodations.service');
const quality = require('./mock-quality.service');
const { isPlanActive } = require('./plan.service');
const { cleanResponses, grade, visibleAttempt } = require('./exam-grade');
const { eligible, sectionTiming, lockedResponses } = require('./ssc-section-timing');

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const VALID_ID = /^[a-z0-9-]{1,60}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function start(user, testId, adminDraft = false) {
  if (!VALID_ID.test(testId)) throw fail('Invalid test ID');
  const found = adminDraft ? null : await mocks.findMock(testId);
  if (!adminDraft && !found) throw fail('Published test not found', 404);
  if (!adminDraft && found.tier === 'premium' && !isPlanActive(user.plan, user.planExpiresAt)) throw fail('Pro plan required', 403);
  // Prefix the stored ID so a future published attempt never resumes the draft
  // and only the private admin endpoints may access the snapshot.
  const storedId = adminDraft ? 'draft-' + testId : testId;
  const test = adminDraft ? await content.buildDraftExam(testId) : null;
  if (adminDraft && !test) throw fail('Unpublished draft not found', 404);
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    // Serialize starts per (user,test) without races across Render instances.
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [user.id, storedId]);
    let existing = await client.query(
      'SELECT * FROM exam_attempts_v2 WHERE user_id=$1 AND test_id=$2 AND submitted_at IS NULL FOR UPDATE',
      [user.id, storedId]
    );
    if (existing.rowCount) {
      await client.query('COMMIT');
      return visibleAttempt(existing.rows[0]);
    }
    const loadedTest = adminDraft ? test : found.build();
    // Never accept a requested timing profile from the client. Grant lives in
    // Postgres, is managed by admins, and is frozen into the attempt snapshot.
    const sscFullMock = eligible(loadedTest);
    const approved = sscFullMock ? await accommodations.approvedMode(user.id,testId) : null;
    const sectionMinutes = sscFullMock ? (approved === 'scribe_compensatory' ? 20 : 15) : null;
    const effectiveMinutes = sectionMinutes === 20 ? 80 : loadedTest.minutes;
    const localizedTest = sscFullMock ? await quality.attachApprovedHindi(testId,loadedTest) : loadedTest;
    // Include stable text and key snapshot for reviews after edits or retirements.
    const snapshot = { name: loadedTest.name, minutes: effectiveMinutes, tier: loadedTest.tier,
      marksPerCorrect: loadedTest.marksPerCorrect, negativeMarks: loadedTest.negativeMarks,
      passPercent: loadedTest.passPercent ?? 50, sections: localizedTest.sections, questions: localizedTest.questions,
      adminDraft: Boolean(adminDraft),
      sectionTimingMinutes: sectionMinutes, accommodationMode: approved || 'standard' };
    const saved = await client.query(
      `INSERT INTO exam_attempts_v2 (user_id,test_id,snapshot,deadline_at)
       VALUES ($1,$2,$3::jsonb,NOW()+($4*INTERVAL '1 minute')) RETURNING *`,
      [user.id,storedId,JSON.stringify(snapshot),effectiveMinutes]
    );
    await client.query('COMMIT');
    return visibleAttempt(saved.rows[0]);
  } catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

async function get(userId, id, adminDraft = false) {
  if (!UUID.test(id)) throw fail('Invalid attempt ID');
  const r = await db.query('SELECT * FROM exam_attempts_v2 WHERE id=$1 AND user_id=$2', [id,userId]);
  if (!r.rowCount) throw fail('Attempt not found',404);
  if (Boolean(r.rows[0].snapshot?.adminDraft) !== Boolean(adminDraft)) throw fail('Attempt not found',404);
  return visibleAttempt(r.rows[0]);
}

async function save(userId, id, source, submit = false, adminDraft = false) {
  if (!UUID.test(id)) throw fail('Invalid attempt ID');
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const r = await client.query('SELECT * FROM exam_attempts_v2 WHERE id=$1 AND user_id=$2 FOR UPDATE', [id,userId]);
    if (!r.rowCount) throw fail('Attempt not found',404);
    const row = r.rows[0];
    if (Boolean(row.snapshot?.adminDraft) !== Boolean(adminDraft)) throw fail('Attempt not found',404);
    if (row.submitted_at) { await client.query('COMMIT'); return visibleAttempt(row); }
    const expired = Date.now() >= new Date(row.deadline_at).getTime();
    const clock = sectionTiming(row.snapshot, row.started_at);
    // Expiry is determined by the server, not the browser's clock. Late input
    // must never mutate previously saved answers or unlock an old section.
    if (!submit && (expired || clock?.finished)) throw fail('Exam time expired: submit your saved answers',409);
    const responses = (expired || clock?.finished)
      ? row.responses
      : clock
        ? lockedResponses(row.snapshot, row.responses || {}, cleanResponses(row.snapshot, source), clock)
        : cleanResponses(row.snapshot, source);
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
       FROM exam_attempts_v2 WHERE user_id=$1 AND (snapshot->>'adminDraft') IS DISTINCT FROM 'true' ORDER BY started_at DESC LIMIT 100`, [userId]);
  return r.rows.map(row => {
    const a = visibleAttempt(row);
    return { id:a.id,testId:a.testId,title:a.title,startedAt:a.startedAt,deadlineAt:a.deadlineAt,submittedAt:a.submittedAt,
      result: a.result ? {correct:a.result.correct,incorrect:a.result.incorrect,skipped:a.result.skipped,score:a.result.score,total:a.result.total,percentage:a.result.percentage,passed:a.result.passed} : null };
  });
}
module.exports = { start, get, save, history };
