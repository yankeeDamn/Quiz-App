-- ExamPro pilot schema: additive; no existing tables are dropped or modified.
-- Tenant boundaries use composite foreign keys so cross-institute references fail.
CREATE TABLE IF NOT EXISTS pilot_institutes (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 160),
 slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$'),
 status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial','active','suspended')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pilot_memberships (
 institute_id UUID NOT NULL REFERENCES pilot_institutes(id) ON DELETE CASCADE,
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK (role IN ('owner','teacher','student')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY (institute_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_pilot_memberships_user ON pilot_memberships(user_id);
CREATE TABLE IF NOT EXISTS pilot_question_banks (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 institute_id UUID NOT NULL REFERENCES pilot_institutes(id) ON DELETE CASCADE,
 title TEXT NOT NULL,
 exam_code TEXT NOT NULL,
 created_by UUID NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE (institute_id,id),
 FOREIGN KEY (institute_id,created_by) REFERENCES pilot_memberships(institute_id,user_id)
);
CREATE TABLE IF NOT EXISTS pilot_questions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 institute_id UUID NOT NULL,
 bank_id UUID NOT NULL,
 external_id TEXT NOT NULL,
 topic TEXT NOT NULL,
 difficulty TEXT NOT NULL CHECK (difficulty IN ('Easy','Medium','Hard')),
 prompt TEXT NOT NULL,
 options JSONB NOT NULL CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) = 4),
 correct_option CHAR(1) NOT NULL CHECK (correct_option IN ('A','B','C','D')),
 explanation TEXT NOT NULL,
 review_status TEXT NOT NULL DEFAULT 'needs_review' CHECK (review_status IN ('needs_review','approved','rejected')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE (institute_id,id),
 UNIQUE (bank_id,external_id),
 FOREIGN KEY (institute_id,bank_id) REFERENCES pilot_question_banks(institute_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pilot_questions_bank_review ON pilot_questions(bank_id,review_status);
CREATE TABLE IF NOT EXISTS pilot_batches (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 institute_id UUID NOT NULL REFERENCES pilot_institutes(id) ON DELETE CASCADE,
 name TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE (institute_id,id)
);
CREATE TABLE IF NOT EXISTS pilot_batch_students (
 institute_id UUID NOT NULL,
 batch_id UUID NOT NULL,
 user_id UUID NOT NULL,
 PRIMARY KEY (batch_id,user_id),
 FOREIGN KEY (institute_id,batch_id) REFERENCES pilot_batches(institute_id,id) ON DELETE CASCADE,
 FOREIGN KEY (institute_id,user_id) REFERENCES pilot_memberships(institute_id,user_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS pilot_exams (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 institute_id UUID NOT NULL REFERENCES pilot_institutes(id) ON DELETE CASCADE,
 bank_id UUID NOT NULL,
 title TEXT NOT NULL,
 duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 1 AND 240),
 status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','closed')),
 starts_at TIMESTAMPTZ,
 ends_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE (institute_id,id),
 FOREIGN KEY (institute_id,bank_id) REFERENCES pilot_question_banks(institute_id,id),
 CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);
CREATE TABLE IF NOT EXISTS pilot_exam_questions (
 institute_id UUID NOT NULL,
 exam_id UUID NOT NULL,
 question_id UUID NOT NULL,
 position INTEGER NOT NULL CHECK (position > 0),
 PRIMARY KEY (exam_id,question_id),
 UNIQUE (exam_id,position),
 FOREIGN KEY (institute_id,exam_id) REFERENCES pilot_exams(institute_id,id) ON DELETE CASCADE,
 FOREIGN KEY (institute_id,question_id) REFERENCES pilot_questions(institute_id,id)
);
CREATE TABLE IF NOT EXISTS pilot_exam_assignments (
 institute_id UUID NOT NULL,
 exam_id UUID NOT NULL,
 batch_id UUID NOT NULL,
 PRIMARY KEY (exam_id,batch_id),
 FOREIGN KEY (institute_id,exam_id) REFERENCES pilot_exams(institute_id,id) ON DELETE CASCADE,
 FOREIGN KEY (institute_id,batch_id) REFERENCES pilot_batches(institute_id,id)
);
CREATE TABLE IF NOT EXISTS pilot_attempts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 institute_id UUID NOT NULL,
 exam_id UUID NOT NULL,
 student_id UUID NOT NULL,
 started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 submitted_at TIMESTAMPTZ,
 score INTEGER CHECK (score >= 0),
 total INTEGER CHECK (total >= 0),
 answers JSONB,
 UNIQUE (exam_id,student_id),
 FOREIGN KEY (institute_id,exam_id) REFERENCES pilot_exams(institute_id,id),
 FOREIGN KEY (institute_id,student_id) REFERENCES pilot_memberships(institute_id,user_id),
 CHECK ((submitted_at IS NULL AND score IS NULL AND total IS NULL) OR (submitted_at IS NOT NULL AND score IS NOT NULL AND total IS NOT NULL AND score <= total))
);
CREATE INDEX IF NOT EXISTS idx_pilot_attempts_ranking ON pilot_attempts(institute_id,exam_id,score DESC,submitted_at ASC) WHERE submitted_at IS NOT NULL;
CREATE TABLE IF NOT EXISTS pilot_subscriptions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 institute_id UUID NOT NULL REFERENCES pilot_institutes(id) ON DELETE CASCADE,
 provider TEXT NOT NULL CHECK (provider IN ('razorpay','stripe','manual')),
 provider_subscription_id TEXT UNIQUE,
 plan_code TEXT NOT NULL,
 status TEXT NOT NULL CHECK (status IN ('trial','pending','active','past_due','cancelled')),
 current_period_end TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pilot_subscriptions_institute ON pilot_subscriptions(institute_id,status);
