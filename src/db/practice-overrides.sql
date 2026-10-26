-- Practice-only edits of frontend bundled starter questions.
-- Existing question IDs and quiz URLs stay unchanged; base files remain fallback data.
CREATE TABLE IF NOT EXISTS practice_question_overrides (
  source VARCHAR(20) NOT NULL CHECK (source IN ('homepage', 'certification')),
  question_id VARCHAR(120) NOT NULL,
  content JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source, question_id)
);

-- Append-only legacy practice questions per existing quiz/certification (never touch scored mocks).
-- Existing bundled questions remain immutable fallback data.
CREATE TABLE IF NOT EXISTS practice_question_additions (
  source VARCHAR(20) NOT NULL CHECK (source IN ('homepage','certification')),
  group_id VARCHAR(100) NOT NULL,
  question_id VARCHAR(120) NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source, question_id)
);
CREATE INDEX IF NOT EXISTS practice_question_additions_group_idx
  ON practice_question_additions(source, group_id, created_at);
