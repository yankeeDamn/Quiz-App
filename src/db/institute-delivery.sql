-- MANUAL, additive, opt-in. Apply only after pilot-schema.sql and institute-foundation.sql.
-- Never add this file to the automatic Render startup migrator.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('exampro-institute-delivery-v1'));
ALTER TABLE pilot_questions
 ADD COLUMN IF NOT EXISTS author_id uuid,
 ADD COLUMN IF NOT EXISTS reviewer_id uuid,
 ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
 ADD COLUMN IF NOT EXISTS retired_at timestamptz,
 ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en',
 ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1 CHECK(version > 0),
 ADD COLUMN IF NOT EXISTS fingerprint text;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pilot_question_author_tenant') THEN
  ALTER TABLE pilot_questions ADD CONSTRAINT pilot_question_author_tenant FOREIGN KEY(institute_id,author_id) REFERENCES pilot_memberships(institute_id,user_id);
  ALTER TABLE pilot_questions ADD CONSTRAINT pilot_question_reviewer_tenant FOREIGN KEY(institute_id,reviewer_id) REFERENCES pilot_memberships(institute_id,user_id);
 END IF;
END $$;
-- Existing imported rows retain IDs, answers and provenance; no backfill or forced review.
CREATE UNIQUE INDEX IF NOT EXISTS pilot_question_fingerprint ON pilot_questions(bank_id,fingerprint) WHERE fingerprint IS NOT NULL;
CREATE TABLE IF NOT EXISTS pilot_question_versions (
 institute_id uuid NOT NULL,
 question_id uuid NOT NULL,
 version integer NOT NULL CHECK(version > 0),
 changed_by uuid NOT NULL,
 content jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(question_id,version),
 FOREIGN KEY(institute_id,question_id) REFERENCES pilot_questions(institute_id,id),
 FOREIGN KEY(institute_id,changed_by) REFERENCES pilot_memberships(institute_id,user_id)
);
CREATE TABLE IF NOT EXISTS pilot_batch_teachers (
 institute_id uuid NOT NULL,
 batch_id uuid NOT NULL,
 user_id uuid NOT NULL,
 PRIMARY KEY(batch_id,user_id),
 FOREIGN KEY(institute_id,batch_id) REFERENCES pilot_batches(institute_id,id),
 FOREIGN KEY(institute_id,user_id) REFERENCES pilot_memberships(institute_id,user_id)
);
ALTER TABLE pilot_exams
 ADD COLUMN IF NOT EXISTS created_by uuid,
 ADD COLUMN IF NOT EXISTS definition jsonb,
 ADD COLUMN IF NOT EXISTS snapshot jsonb,
 ADD COLUMN IF NOT EXISTS published_at timestamptz;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pilot_exam_author_tenant') THEN
  ALTER TABLE pilot_exams ADD CONSTRAINT pilot_exam_author_tenant FOREIGN KEY(institute_id,created_by) REFERENCES pilot_memberships(institute_id,user_id);
 END IF;
END $$;
ALTER TABLE pilot_attempts
 ADD COLUMN IF NOT EXISTS snapshot jsonb,
 ADD COLUMN IF NOT EXISTS deadline_at timestamptz,
 ADD COLUMN IF NOT EXISTS responses jsonb NOT NULL DEFAULT '{}',
 ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0 CHECK(revision >= 0),
 ADD COLUMN IF NOT EXISTS result jsonb;
CREATE OR REPLACE FUNCTION pilot_guard_published_exam() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.snapshot IS NOT NULL AND (NEW.snapshot IS DISTINCT FROM OLD.snapshot OR NEW.definition IS DISTINCT FROM OLD.definition
 OR NEW.bank_id IS DISTINCT FROM OLD.bank_id OR NEW.institute_id IS DISTINCT FROM OLD.institute_id
 OR NEW.starts_at IS DISTINCT FROM OLD.starts_at OR NEW.ends_at IS DISTINCT FROM OLD.ends_at
 OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes OR NEW.title IS DISTINCT FROM OLD.title OR NEW.status='draft') THEN
  RAISE EXCEPTION 'Published institute exam is immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS pilot_guard_published_exam ON pilot_exams;
CREATE TRIGGER pilot_guard_published_exam BEFORE UPDATE ON pilot_exams FOR EACH ROW EXECUTE FUNCTION pilot_guard_published_exam();
CREATE OR REPLACE FUNCTION pilot_guard_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.snapshot IS NOT NULL AND (NEW.snapshot IS DISTINCT FROM OLD.snapshot OR NEW.institute_id IS DISTINCT FROM OLD.institute_id
 OR NEW.exam_id IS DISTINCT FROM OLD.exam_id OR NEW.student_id IS DISTINCT FROM OLD.student_id
 OR NEW.started_at IS DISTINCT FROM OLD.started_at OR NEW.deadline_at IS DISTINCT FROM OLD.deadline_at
 OR (OLD.submitted_at IS NOT NULL AND NEW IS DISTINCT FROM OLD)) THEN
  RAISE EXCEPTION 'Institute attempt snapshot or submitted result is immutable' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS pilot_guard_attempt ON pilot_attempts;
CREATE TRIGGER pilot_guard_attempt BEFORE UPDATE ON pilot_attempts FOR EACH ROW EXECUTE FUNCTION pilot_guard_attempt();
CREATE INDEX IF NOT EXISTS pilot_attempts_student ON pilot_attempts(institute_id,student_id,started_at DESC);
COMMIT;
