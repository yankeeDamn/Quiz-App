-- ExamPro editorial QA and approved accommodations. Additive and idempotent.
-- Never store disability certificates, medical history, or eligibility documents here.
CREATE TABLE IF NOT EXISTS mock_question_reviews (
  question_id UUID NOT NULL REFERENCES mock_questions(id) ON DELETE CASCADE,
  test_id VARCHAR(40) NOT NULL REFERENCES mock_tests(id) ON DELETE CASCADE,
  content_hash CHAR(64) NOT NULL,
  academic_status VARCHAR(24) NOT NULL DEFAULT 'pending'
    CHECK (academic_status IN ('pending','approved','changes_required')),
  academic_reviewer VARCHAR(255),
  academic_notes TEXT NOT NULL DEFAULT '',
  hindi_status VARCHAR(24) NOT NULL DEFAULT 'pending'
    CHECK (hindi_status IN ('pending','verified','changes_required','not_required')),
  hindi_question TEXT,
  hindi_options JSONB,
  hindi_explanation TEXT,
  hindi_reviewer VARCHAR(255),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(test_id,question_id)
);
CREATE INDEX IF NOT EXISTS mock_question_reviews_test ON mock_question_reviews(test_id);

CREATE TABLE IF NOT EXISTS exam_time_accommodations (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  test_id VARCHAR(40) NOT NULL REFERENCES mock_tests(id) ON DELETE CASCADE,
  mode VARCHAR(32) NOT NULL CHECK (mode IN ('scribe_compensatory')),
  approved_by VARCHAR(255) NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(user_id,test_id)
);
