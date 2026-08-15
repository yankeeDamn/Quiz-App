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
  stripe_customer_id VARCHAR(255),
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

-- ────────────────────────────────────────────────
-- payments
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
  amount_cents             INTEGER      NOT NULL,
  currency                 VARCHAR(10)  NOT NULL DEFAULT 'usd',
  status                   VARCHAR(30)  NOT NULL,
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe ON payments(stripe_payment_intent_id);

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
-- ────────────────────────────────────────────────
-- courses  (exam providers managed via admin panel)
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  description TEXT         NOT NULL DEFAULT '',
  color       VARCHAR(20)  NOT NULL DEFAULT '#6366F1',
  exam_code   VARCHAR(50)  NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────
-- questions  (dynamic question bank)
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id         VARCHAR(100) NOT NULL,
  subject         VARCHAR(255) NOT NULL,
  topic           VARCHAR(255) NOT NULL DEFAULT '',
  difficulty      VARCHAR(20)  NOT NULL DEFAULT 'Medium',
  type            VARCHAR(20)  NOT NULL DEFAULT 'single',
  question_text   TEXT         NOT NULL,
  options         JSONB        NOT NULL DEFAULT '[]',
  correct_answers JSONB        NOT NULL DEFAULT '[]',
  explanation     TEXT         NOT NULL DEFAULT '',
  image_url       VARCHAR(512),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_quiz ON questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic);
`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running migrations…');
    await client.query(MIGRATION_SQL);
    console.log('✅ Migrations complete.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
