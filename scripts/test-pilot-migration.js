#!/usr/bin/env node
'use strict';
// DESTRUCTIVE TO A DISPOSABLE DATABASE ONLY. Does not delete anything itself,
// but migration creates tables. Never point this test at a production database.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { Pool } = require('pg');
const url = process.env.DATABASE_URL;
if (!url || process.env.ALLOW_PILOT_MIGRATION_TEST !== 'yes') {
  console.error('Set DATABASE_URL to a disposable PostgreSQL database and ALLOW_PILOT_MIGRATION_TEST=yes');
  process.exit(2);
}
async function main() {
  for (let n = 1; n <= 2; n++) {
    const result = spawnSync(process.execPath, ['src/db/migrate.js'], { stdio: 'inherit', env: process.env });
    assert.equal(result.status, 0, `Migration run ${n} failed`);
  }
  const pool = new Pool({ connectionString: url });
  try {
    const expected = ['users','pilot_institutes','pilot_memberships','pilot_question_banks','pilot_questions','pilot_batches','pilot_batch_students','pilot_exams','pilot_exam_questions','pilot_exam_assignments','pilot_attempts','pilot_subscriptions'];
    const result = await pool.query('SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename = ANY($1)', [expected]);
    const found = new Set(result.rows.map(row => row.tablename));
    for (const table of expected) assert(found.has(table), `Missing table: ${table}`);
    const fk = await pool.query("SELECT count(*)::int AS total FROM pg_constraint WHERE contype = 'f' AND conrelid IN (SELECT oid FROM pg_class WHERE relname LIKE 'pilot_%')");
    assert(fk.rows[0].total >= 12, 'Expected tenant and ownership foreign keys');
    console.log('PASS: migration ran twice; required tables and foreign keys exist');
  } finally {
    await pool.end();
  }
}
main().catch(err => { console.error(err.message); process.exitCode = 1; });
