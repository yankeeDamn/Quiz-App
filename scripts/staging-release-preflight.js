'use strict';

/**
 * Operator-initiated, read-only staging preflight.
 *
 * This script never runs migrations, writes question/review data, publishes
 * mocks, or grants access. Neon branch identity cannot be attested by SQL:
 * the operator MUST verify the branch and connection string in Neon first.
 */
const REQUIRED_COLUMNS = Object.freeze({
  exam_beta_invitations: ['id', 'test_id', 'email', 'token_hash', 'expires_at', 'redeemed_user_id', 'revoked_at'],
  exam_beta_feedback: ['id', 'test_id', 'user_id', 'category', 'severity', 'comment', 'status'],
  exam_beta_invitation_audit: ['id', 'invitation_id', 'action', 'actor_user_id', 'created_at'],
});
const MOCK_TOPICS = Object.freeze({
  'ssc-cgl-2026-mock-01': [
    'ssc26-m01-reasoning', 'ssc26-m01-awareness', 'ssc26-m01-quant', 'ssc26-m01-english',
  ],
  'ssc-cgl-2026-mock-02': [
    'ssc26-m02-reasoning', 'ssc26-m02-gk', 'ssc26-m02-quant', 'ssc26-m02-english',
  ],
});
const MOCK_IDS = Object.keys(MOCK_TOPICS);
const TOPIC_IDS = Object.values(MOCK_TOPICS).flat();
const TABLES = [...Object.keys(REQUIRED_COLUMNS), 'mock_tests', 'mock_topics', 'mock_questions', 'mock_question_reviews'];

function confirmOperatorIntent(env) {
  if (env.EXAMPRO_ENV !== 'staging' || env.STAGING_PREFLIGHT_BRANCH !== 'exampro-staging') {
    throw new Error('Refusing check: confirm the Neon staging branch, then set EXAMPRO_ENV=staging and STAGING_PREFLIGHT_BRANCH=exampro-staging.');
  }
  if (!/^postgres(?:ql)?:\/\//.test(env.DATABASE_URL || '')) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection string for the verified staging branch.');
  }
}

// Never derive readiness from fixture metadata alone. Query the actual schema
// inside one read-only, repeatable-read transaction.
async function collectSnapshot(client) {
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    const state = await client.query("SELECT current_setting('transaction_read_only') AS read_only");
    if (state.rows[0]?.read_only !== 'on') {
      throw new Error('Database transaction did not confirm read-only mode.');
    }
    const tables = (await client.query(
      "SELECT x.rel_name AS table_name, to_regclass('public.' || x.rel_name) IS NOT NULL AS present FROM unnest($1::text[]) AS x(rel_name)",
      [TABLES]
    )).rows;
    const columns = (await client.query(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=ANY($1::text[])",
      [Object.keys(REQUIRED_COLUMNS)]
    )).rows;
    const present = new Set(tables.filter(row => row.present === true).map(row => row.table_name));
    const mocks = present.has('mock_tests') ? (await client.query(
      'SELECT id, active, minutes, marks_per_correct, negative_marks FROM public.mock_tests WHERE id=ANY($1::text[])',
      [MOCK_IDS]
    )).rows : [];
    const topics = present.has('mock_topics') && present.has('mock_questions') ? (await client.query(
      'SELECT t.id, t.active, COUNT(q.id)::integer AS question_count FROM public.mock_topics t LEFT JOIN public.mock_questions q ON q.topic_id=t.id WHERE t.id=ANY($1::text[]) GROUP BY t.id,t.active',
      [TOPIC_IDS]
    )).rows : [];
    const reviews = present.has('mock_question_reviews') ? (await client.query(
      "SELECT test_id, COUNT(*)::integer AS review_rows, COUNT(*) FILTER (WHERE academic_status='approved')::integer AS academic_approved, COUNT(*) FILTER (WHERE hindi_status='verified')::integer AS hindi_verified FROM public.mock_question_reviews WHERE test_id=ANY($1::text[]) GROUP BY test_id",
      [MOCK_IDS]
    )).rows : [];
    await client.query('COMMIT');
    return { tables, columns, mocks, topics, reviews };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  }
}

function evaluateSnapshot(snapshot) {
  const blockers = [];
  const columnsByTable = new Map();
  for (const row of snapshot.columns) {
    if (!columnsByTable.has(row.table_name)) columnsByTable.set(row.table_name, new Set());
    columnsByTable.get(row.table_name).add(row.column_name);
  }
  const tableStatus = [];
  for (const table of Object.keys(REQUIRED_COLUMNS)) {
    const available = snapshot.tables.some(row => row.table_name === table && row.present === true);
    const missingColumns = available ? REQUIRED_COLUMNS[table].filter(c => !columnsByTable.get(table)?.has(c)) : REQUIRED_COLUMNS[table];
    if (!available) blockers.push('Missing staging-only table: ' + table);
    else if (missingColumns.length) blockers.push('Incomplete schema for ' + table + ': ' + missingColumns.join(', '));
    tableStatus.push({ table, present: available, missingColumns: available ? missingColumns : [] });
  }
  for (const table of ['mock_tests', 'mock_topics', 'mock_questions', 'mock_question_reviews']) {
    if (!snapshot.tables.some(row => row.table_name === table && row.present === true)) {
      blockers.push('Missing mock prerequisite: ' + table);
    }
  }
  const mocks = MOCK_IDS.map(id => {
    const test = snapshot.mocks.find(row => row.id === id);
    const topicStatus = MOCK_TOPICS[id].map(topicId => {
      const topic = snapshot.topics.find(row => row.id === topicId);
      const present = Boolean(topic);
      const inactive = present && topic.active === false;
      const questionCount = present ? Number(topic.question_count) : 0;
      if (!present || !inactive || questionCount !== 25) {
        blockers.push(id + ': source topic ' + topicId + ' must exist, remain inactive and contain 25 questions.');
      }
      return { topicId, present, inactive, questionCount };
    });
    const review = snapshot.reviews.find(row => row.test_id === id);
    const academicApproved = Number(review?.academic_approved || 0);
    const hindiVerified = Number(review?.hindi_verified || 0);
    const reviewRows = Number(review?.review_rows || 0);
    if (!test || test.active !== false || Number(test.minutes) !== 60 ||
        Number(test.marks_per_correct) !== 2 || Number(test.negative_marks) !== 0.5) {
      blockers.push(id + ': expected an inactive, 60-minute, +2/-0.5 draft.');
    }
    if (academicApproved < 100 || hindiVerified < 75) {
      blockers.push(id + ': independent reviews pending (100 academic and 75 human-verified Hindi required).');
    }
    return {
      id, exists: Boolean(test), inactive: Boolean(test && test.active === false),
      minutes: test ? Number(test.minutes) : null,
      reviews: { recorded: reviewRows, academicApproved, hindiVerified },
      topics: topicStatus,
    };
  });
  return {
    mode: 'READ_ONLY',
    branchIdentity: 'Operator-confirmed only: exampro-staging (not provable through this SQL report)',
    status: blockers.length ? 'BLOCKED' : 'MANUAL_SIGNOFF_REQUIRED',
    betaSchema: tableStatus,
    mocks,
    blockers,
    manualChecks: [
      'In Neon Console verify the actual selected branch, its expiration and a recoverable backup before applying SQL.',
      'Verify Vercel and Render staging deploy SHAs, API URLs, CORS, OAuth and feature flags separately.',
      'Complete independent content, Hindi, accessibility, security and real-browser QA before any publication.',
    ],
    publicationAuthorized: false,
    paymentActivationAuthorized: false,
  };
}

async function main() {
  try {
    confirmOperatorIntent(process.env);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
    return;
  }
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 8000 });
  try {
    const client = await pool.connect();
    try {
      const report = evaluateSnapshot(await collectSnapshot(client));
      console.log(JSON.stringify(report, null, 2));
      if (report.blockers.length) process.exitCode = 1;
    } finally {
      client.release();
    }
  } catch {
    // Do not leak a connection string, SQL parameters, tokens or credentials.
    console.error('Preflight failed. Verify staging connection, read permissions and network access privately.');
    process.exitCode = 2;
  } finally {
    await pool.end();
  }
}

if (require.main === module) main();
module.exports = { REQUIRED_COLUMNS, MOCK_TOPICS, TABLES, confirmOperatorIntent, collectSnapshot, evaluateSnapshot };
