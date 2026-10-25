-- ExamPro scored attempts, additive migration. Existing quiz_attempts and institute pilot data remain untouched.
ALTER TABLE mock_tests ADD COLUMN IF NOT EXISTS pass_percent INTEGER NOT NULL DEFAULT 50 CHECK (pass_percent BETWEEN 0 AND 100);
ALTER TABLE mock_questions ADD COLUMN IF NOT EXISTS difficulty VARCHAR(20) NOT NULL DEFAULT 'Moderate';
CREATE TABLE IF NOT EXISTS exam_attempts_v2 (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 test_id VARCHAR(100) NOT NULL,
 snapshot JSONB NOT NULL,
 responses JSONB NOT NULL DEFAULT '{}'::jsonb,
 started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 deadline_at TIMESTAMPTZ NOT NULL,
 submitted_at TIMESTAMPTZ,
 result JSONB,
 CONSTRAINT submitted_result_pair CHECK ((submitted_at IS NULL AND result IS NULL) OR (submitted_at IS NOT NULL AND result IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS exam_attempts_v2_user_time ON exam_attempts_v2(user_id,started_at DESC);
CREATE INDEX IF NOT EXISTS exam_attempts_v2_user_test ON exam_attempts_v2(user_id,test_id);
CREATE UNIQUE INDEX IF NOT EXISTS exam_attempts_v2_one_open ON exam_attempts_v2(user_id,test_id) WHERE submitted_at IS NULL;
