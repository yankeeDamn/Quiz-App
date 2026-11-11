'use strict';
const f = require('./foundation');
const { grade } = require('../exam-grade');

// System maintenance only: no public endpoint and no caller-supplied tenant IDs.
// Revocation/suspension must not leave already-started attempts ungraded forever.
async function finalizeExpired(limit = 25) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid finalizer batch size');
  return f.transaction(async c => {
    const rows = (await c.query(`SELECT * FROM pilot_attempts
      WHERE snapshot IS NOT NULL AND submitted_at IS NULL AND deadline_at <= clock_timestamp()
      ORDER BY deadline_at,id LIMIT $1 FOR UPDATE SKIP LOCKED`, [limit])).rows;
    for (const a of rows) {
      const result = grade(a.snapshot, a.responses);
      await c.query(`UPDATE pilot_attempts SET submitted_at=clock_timestamp(),score=$3,total=$4,
        result=$5,answers=responses,revision=revision+1 WHERE institute_id=$1 AND id=$2 AND submitted_at IS NULL`,
      [a.institute_id,a.id,result.correct,a.snapshot.questions.length,JSON.stringify(result)]);
      await f.audit(c,a.institute_id,{id:a.student_id},'attempt.expired_automatically',a.id);
    }
    return rows.length;
  });
}

function startExpiryWorker(logger) {
  if (![process.env.INSTITUTES_ENABLED,process.env.INSTITUTE_DELIVERY_ENABLED,
    process.env.INSTITUTE_EXPIRY_WORKER_ENABLED].every(value => value === 'true')) return async () => {};
  let stopped = false, timer, pending = Promise.resolve();
  const tick = () => {
    pending = finalizeExpired().catch(() => {
      // Do not log question snapshots, responses or database error details.
      logger.error('Institute expiry finalizer failed; check database readiness');
    }).finally(() => {
      if (!stopped) { timer = setTimeout(tick,15000); timer.unref(); }
    });
  };
  tick();
  return async () => { stopped = true; clearTimeout(timer); await pending; };
}
module.exports = { finalizeExpired, startExpiryWorker };
