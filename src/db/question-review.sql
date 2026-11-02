-- Non-destructive and repeatable. Apply before importing any new private seeds.
CREATE TABLE IF NOT EXISTS content_migrations (
  id TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE mock_questions ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'draft'
  CHECK (review_status IN ('draft','reviewed','published'));
ALTER TABLE mock_questions ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE mock_questions ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
ALTER TABLE mock_questions ADD COLUMN IF NOT EXISTS access_tier TEXT NOT NULL DEFAULT 'premium'
  CHECK (access_tier IN ('free','premium'));
ALTER TABLE practice_question_overrides ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'draft'
  CHECK (review_status IN ('draft','reviewed','published'));
ALTER TABLE practice_question_additions ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'draft'
  CHECK (review_status IN ('draft','reviewed','published'));

DO $$
BEGIN
  -- Lock the marker so concurrent migration runners cannot repeat the backfill.
  IF NOT EXISTS (SELECT 1 FROM content_migrations WHERE id='question-review-v1') THEN
    INSERT INTO content_migrations(id) VALUES ('question-review-v1') ON CONFLICT DO NOTHING;
    IF FOUND THEN
      -- Legacy free topic practice was live for every active topic. Paid range
      -- assignment takes precedence, including inactive paid mock definitions.
      UPDATE mock_questions q SET review_status='published', access_tier='free'
      WHERE q.active AND EXISTS (SELECT 1 FROM mock_topics t WHERE t.id=q.topic_id AND t.active)
        AND NOT EXISTS (
          SELECT 1 FROM mock_tests m,
            LATERAL jsonb_array_elements(m.sections) s,
            LATERAL jsonb_array_elements(s->'parts') p
          WHERE m.tier='premium' AND p->>'topic'=q.topic_id
            AND q.position >= (p->>'from')::int AND q.position < (p->>'to')::int
        );
      -- Grandfather public free practice, WITHOUT manufacturing teacher review.
      UPDATE practice_question_overrides SET review_status='published';
      UPDATE practice_question_additions SET review_status='published';
    END IF;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS mock_questions_publication ON mock_questions(topic_id, position)
  WHERE active AND review_status='published';
