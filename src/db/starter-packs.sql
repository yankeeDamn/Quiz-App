-- Admin-editable edits for the three bundled, Free, practice-only exam starter packs
-- (Railways RRB, Banking IBPS, UPSC General Studies).
-- The bundled JSON in content/separate-exam-practice-starter.json stays the immutable
-- fallback; rows here only describe changes on top of it. Additive and repeatable.
--   override : replaces the bundled question with the same ID (answers + explanation included)
--   addition : a new question added by an admin (Railways pack only)
--   removed  : tombstone hiding a bundled question (Railways pack only)
CREATE TABLE IF NOT EXISTS starter_pack_questions (
  pack_id     VARCHAR(40)  NOT NULL CHECK (pack_id IN ('railways-rrb-starter','banking-ibps-starter','upsc-gs-starter')),
  question_id VARCHAR(120) NOT NULL,
  kind        VARCHAR(10)  NOT NULL CHECK (kind IN ('override','addition','removed')),
  content     JSONB,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_by  TEXT,
  PRIMARY KEY (pack_id, question_id),
  CHECK ((kind = 'removed') = (content IS NULL))
);
CREATE INDEX IF NOT EXISTS starter_pack_questions_pack_idx
  ON starter_pack_questions (pack_id, created_at);
