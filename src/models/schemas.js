'use strict';

/**
 * Database schema models for the Exam Practice Pro platform.
 *
 * ─────────────────────────────────────────────────────────
 * RECOMMENDED DATABASE: PostgreSQL
 *
 * Why PostgreSQL?
 * - Strong relational data (users ↔ quiz attempts ↔ payments)
 * - ACID transactions for payment status updates
 * - JSON/JSONB columns for flexible quiz answer storage
 * - Mature ecosystem, excellent Node.js support (pg, Prisma, Drizzle)
 * - Scales well for read-heavy SaaS workloads
 * ─────────────────────────────────────────────────────────
 *
 * These are reference schemas. When adding a real database,
 * use an ORM/query builder (Prisma, Drizzle, Knex) to generate
 * migration files from these definitions.
 *
 * SQL equivalent is provided in comments for clarity.
 */

/*
-- ────────────────────────────────────────────────
-- users
-- ────────────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'user',  -- 'guest' | 'user' | 'paid' | 'admin'
  payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid', -- 'unpaid' | 'paid' | 'refunded'
  stripe_customer_id VARCHAR(255),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_stripe_customer_id ON users(stripe_customer_id);

-- ────────────────────────────────────────────────
-- quiz_attempts
-- ────────────────────────────────────────────────
CREATE TABLE quiz_attempts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id       VARCHAR(100) NOT NULL,
  score         INTEGER      NOT NULL,
  total         INTEGER      NOT NULL,
  percentage    DECIMAL(5,2) NOT NULL,
  passed        BOOLEAN      NOT NULL,
  time_spent_s  INTEGER,                   -- seconds
  answers       JSONB,                     -- { questionId: selectedAnswer }
  started_at    TIMESTAMPTZ  NOT NULL,
  completed_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_quiz_attempts_user ON quiz_attempts(user_id);
CREATE INDEX idx_quiz_attempts_quiz ON quiz_attempts(quiz_id);

-- ────────────────────────────────────────────────
-- payments
-- ────────────────────────────────────────────────
CREATE TABLE payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
  amount_cents        INTEGER      NOT NULL,
  currency            VARCHAR(10)  NOT NULL DEFAULT 'usd',
  status              VARCHAR(30)  NOT NULL,  -- mirrors Stripe PaymentIntent status
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_user ON payments(user_id);
CREATE INDEX idx_payments_stripe ON payments(stripe_payment_intent_id);

-- ────────────────────────────────────────────────
-- scores (leaderboard / analytics)
-- ────────────────────────────────────────────────
CREATE TABLE scores (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id       VARCHAR(100) NOT NULL,
  best_score    INTEGER      NOT NULL,
  best_pct      DECIMAL(5,2) NOT NULL,
  attempts      INTEGER      NOT NULL DEFAULT 1,
  last_attempt  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, quiz_id)
);

CREATE INDEX idx_scores_user ON scores(user_id);
*/

/**
 * JavaScript object representations (for ORM integration).
 *
 * These mirror the SQL above and can be used directly with
 * Prisma schema, Drizzle table definitions, or Knex migrations.
 */
const UserSchema = {
  tableName: 'users',
  columns: {
    id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
    email: { type: 'varchar(255)', unique: true, nullable: false },
    password_hash: { type: 'varchar(255)', nullable: false },
    role: { type: 'varchar(20)', nullable: false, default: 'user' },
    payment_status: { type: 'varchar(20)', nullable: false, default: 'unpaid' },
    stripe_customer_id: { type: 'varchar(255)', nullable: true },
    created_at: { type: 'timestamptz', nullable: false, default: 'NOW()' },
    updated_at: { type: 'timestamptz', nullable: false, default: 'NOW()' },
  },
};

const QuizAttemptSchema = {
  tableName: 'quiz_attempts',
  columns: {
    id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
    user_id: { type: 'uuid', nullable: false, references: 'users.id' },
    quiz_id: { type: 'varchar(100)', nullable: false },
    score: { type: 'integer', nullable: false },
    total: { type: 'integer', nullable: false },
    percentage: { type: 'decimal(5,2)', nullable: false },
    passed: { type: 'boolean', nullable: false },
    time_spent_s: { type: 'integer', nullable: true },
    answers: { type: 'jsonb', nullable: true },
    started_at: { type: 'timestamptz', nullable: false },
    completed_at: { type: 'timestamptz', nullable: false, default: 'NOW()' },
  },
};

const PaymentSchema = {
  tableName: 'payments',
  columns: {
    id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
    user_id: { type: 'uuid', nullable: false, references: 'users.id' },
    stripe_payment_intent_id: { type: 'varchar(255)', unique: true, nullable: false },
    amount_cents: { type: 'integer', nullable: false },
    currency: { type: 'varchar(10)', nullable: false, default: 'usd' },
    status: { type: 'varchar(30)', nullable: false },
    created_at: { type: 'timestamptz', nullable: false, default: 'NOW()' },
    updated_at: { type: 'timestamptz', nullable: false, default: 'NOW()' },
  },
};

const ScoreSchema = {
  tableName: 'scores',
  columns: {
    id: { type: 'uuid', primaryKey: true, default: 'gen_random_uuid()' },
    user_id: { type: 'uuid', nullable: false, references: 'users.id' },
    quiz_id: { type: 'varchar(100)', nullable: false },
    best_score: { type: 'integer', nullable: false },
    best_pct: { type: 'decimal(5,2)', nullable: false },
    attempts: { type: 'integer', nullable: false, default: 1 },
    last_attempt: { type: 'timestamptz', nullable: false, default: 'NOW()' },
  },
  uniqueConstraints: [['user_id', 'quiz_id']],
};

module.exports = {
  UserSchema,
  QuizAttemptSchema,
  PaymentSchema,
  ScoreSchema,
};
