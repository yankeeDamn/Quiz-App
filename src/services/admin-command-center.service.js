'use strict';
const db = require('../config/database');
const mocks = require('./mocks.service');
const content = require('./content.service');
const quality = require('./mock-quality.service');
const {isFullCglMock} = require('./ssc-full-mock-classifier');

async function metrics() {
  const [bank, definitions, catalogue, attempts, plans] = await Promise.all([
    db.query(`SELECT COUNT(q.id)::int AS total, COUNT(q.id) FILTER (WHERE q.active)::int AS active,
      COUNT(DISTINCT t.id)::int AS topics FROM mock_topics t LEFT JOIN mock_questions q ON q.topic_id=t.id`),
    db.query(`SELECT COUNT(*) FILTER (WHERE active)::int AS published,
      COUNT(*) FILTER (WHERE NOT active)::int AS drafts FROM mock_tests`),
    mocks.listMocks(),
    db.query(`SELECT COUNT(*)::int AS submitted,
      ROUND(AVG(100.0 * (result->>'correct')::numeric / NULLIF((result->>'correct')::numeric + (result->>'incorrect')::numeric,0)),1) AS accuracy
      FROM exam_attempts_v2 WHERE submitted_at IS NOT NULL AND (snapshot->>'adminDraft') IS DISTINCT FROM 'true'`),
    db.query(`SELECT (SELECT COUNT(*)::int FROM users WHERE plan IN ('pro','institute') AND plan_expires_at > NOW()) AS active,
      (SELECT COUNT(*)::int FROM plan_grants WHERE COALESCE(note,'') NOT ILIKE 'Cashfree sandbox %') AS manual_grants`),
  ]);
  return {questions:bank.rows[0],publication:definitions.rows[0],
    catalogue:{total:catalogue.length,free:catalogue.filter(t=>!t.isPro).length,pro:catalogue.filter(t=>t.isPro).length},
    attempts:{submitted:attempts.rows[0].submitted,accuracy:attempts.rows[0].accuracy===null?null:Number(attempts.rows[0].accuracy)},
    plans:{active:plans.rows[0].active,manualGrants:plans.rows[0].manual_grants},checkedAt:new Date().toISOString()};
}

// Read-only preflight. Existing PUT rechecks every gate when the user publishes.
async function candidates() {
  const tests = await content.listTests();
  const candidates = [];
  for (const test of tests.filter(t=>!t.active)) {
    let check = await content.publicationReadiness(test);
    if (check.ok && isFullCglMock(test)) check = await quality.readiness(test.id);
    candidates.push({id:test.id,name:test.name,ready:check.ok===true,blocker:check.ok?null:check.error});
  }
  return {candidates};
}
module.exports = {metrics,candidates};
