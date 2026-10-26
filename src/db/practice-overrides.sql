-- Practice-only edits of frontend bundled starter questions.
-- Existing question IDs and quiz URLs stay unchanged; base files remain fallback data.
CREATE TABLE IF NOT EXISTS practice_question_overrides (
  source VARCHAR(20) NOT NULL CHECK (source IN ('homepage', 'certification')),
  question_id VARCHAR(120) NOT NULL,
  content JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source, question_id)
);
