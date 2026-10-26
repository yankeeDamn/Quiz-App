#!/usr/bin/env node
'use strict';

/**
 * Database migration script.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... node src/db/migrate.js
 *
 * Idempotent — safe to run multiple times.
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is required. Set it in .env or as an environment variable.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : undefined,
});

const MIGRATION_SQL = `
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ────────────────────────────────────────────────
-- users
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) UNIQUE,
  name            VARCHAR(255),
  image           VARCHAR(512),
  password_hash   VARCHAR(255),
  provider        VARCHAR(50)  NOT NULL DEFAULT 'credentials',
  provider_id     VARCHAR(255),
  role            VARCHAR(20)  NOT NULL DEFAULT 'user',
  payment_status  VARCHAR(20)  NOT NULL DEFAULT 'unpaid',
  plan            VARCHAR(20)  NOT NULL DEFAULT 'free',
  plan_expires_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider, provider_id);

-- ────────────────────────────────────────────────
-- quiz_attempts
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id       VARCHAR(100) NOT NULL,
  quiz_title    VARCHAR(255) NOT NULL DEFAULT '',
  score         INTEGER      NOT NULL,
  total         INTEGER      NOT NULL,
  percentage    DECIMAL(5,2) NOT NULL,
  passed        BOOLEAN      NOT NULL,
  time_spent_s  INTEGER,
  answers       JSONB,
  topic_performance    JSONB,
  difficulty_performance JSONB,
  started_at    TIMESTAMPTZ  NOT NULL,
  completed_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user ON quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz ON quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_completed ON quiz_attempts(completed_at DESC);

-- Plans were added after the first release; this keeps existing databases working.
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan VARCHAR(20) NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;

-- ────────────────────────────────────────────────
-- plan_grants (one row per plan unlocked after a WhatsApp payment)
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plan_grants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan        VARCHAR(20)  NOT NULL,
  months      INTEGER      NOT NULL,
  amount_inr  INTEGER,
  note        VARCHAR(255),
  expires_at  TIMESTAMPTZ  NOT NULL,
  granted_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_grants_user ON plan_grants(user_id);

-- ────────────────────────────────────────────────
-- mock-test content (edited from the /admin page)
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mock_topics (
  id         VARCHAR(40)  PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  category   VARCHAR(60)  NOT NULL,
  active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- A question is never deleted, only retired, so positions (and the ids built
-- from them) stay stable for saved questions and test ranges.
CREATE TABLE IF NOT EXISTS mock_questions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id    VARCHAR(40)  NOT NULL REFERENCES mock_topics(id) ON DELETE CASCADE,
  position    INTEGER      NOT NULL,
  question    TEXT         NOT NULL,
  options     JSONB        NOT NULL,
  answer      INTEGER      NOT NULL CHECK (answer BETWEEN 0 AND 3),
  explanation TEXT         NOT NULL,
  active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(topic_id, position)
);

CREATE TABLE IF NOT EXISTS mock_tests (
  id                VARCHAR(40)  PRIMARY KEY,
  name              VARCHAR(120) NOT NULL,
  exam              VARCHAR(60)  NOT NULL,
  minutes           INTEGER      NOT NULL CHECK (minutes BETWEEN 1 AND 300),
  marks_per_correct NUMERIC(6,2) NOT NULL DEFAULT 1,
  negative_marks    NUMERIC(6,4) NOT NULL DEFAULT 0,
  level             VARCHAR(30)  NOT NULL DEFAULT 'Moderate',
  tier              VARCHAR(10)  NOT NULL DEFAULT 'free' CHECK (tier IN ('free','premium')),
  sections          JSONB        NOT NULL,
  active            BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────
-- scores (best-score leaderboard)
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id       VARCHAR(100) NOT NULL,
  best_score    INTEGER      NOT NULL,
  best_pct      DECIMAL(5,2) NOT NULL,
  attempts      INTEGER      NOT NULL DEFAULT 1,
  last_attempt  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, quiz_id)
);

CREATE INDEX IF NOT EXISTS idx_scores_user ON scores(user_id);

-- ────────────────────────────────────────────────
-- bookmarks
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookmarks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id     VARCHAR(100) NOT NULL,
  question_id VARCHAR(100) NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, quiz_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);

-- ────────────────────────────────────────────────
-- notes
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id     VARCHAR(100) NOT NULL,
  question_id VARCHAR(100) NOT NULL,
  content     TEXT         NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, quiz_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);

-- ────────────────────────────────────────────────
-- user_stats  (server-side dashboard stats cache)
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_stats (
  user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_attempts   INTEGER      NOT NULL DEFAULT 0,
  average_score    DECIMAL(5,2) NOT NULL DEFAULT 0,
  strongest_topic  VARCHAR(255),
  weakest_topic    VARCHAR(255),
  streak           INTEGER      NOT NULL DEFAULT 0,
  last_attempt_date DATE,
  topic_stats      JSONB        NOT NULL DEFAULT '{}',
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
`;

const { seedStarterContent } = require('./seed-content');
const { seedCompetitiveContent } = require('./seed-competitive');

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running migrations…');
    await client.query('BEGIN');
    await client.query(MIGRATION_SQL);
    const seeded = await seedStarterContent(client);
    console.log(`🌱 Starter content checked: ${seeded.topics} topics, ${seeded.questions} questions, ${seeded.mocks} mocks.`);
    await client.query(fs.readFileSync(path.join(__dirname, 'pilot-schema.sql'), 'utf8'));
    await client.query(fs.readFileSync(path.join(__dirname, 'exampro-v2.sql'), 'utf8'));
    await client.query(fs.readFileSync(path.join(__dirname, 'razorpay.sql'), 'utf8'));
    await client.query(fs.readFileSync(path.join(__dirname, 'practice-overrides.sql'), 'utf8'));
    const competitive = await seedCompetitiveContent(client);
    console.log(`📚 Competitive bank staged: ${competitive.questions} questions, ${competitive.mocks} draft quizzes. Review and publish in /admin.`);
    await client.query('COMMIT');
    console.log('✅ Migrations complete.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
