-- Opt-in additive migration. Run after the existing migrate.js on staging.
BEGIN;
CREATE TABLE IF NOT EXISTS study_exams (
 id text PRIMARY KEY CHECK (id ~ '^[a-z0-9][a-z0-9-]{1,59}$'),
 name text NOT NULL, description text NOT NULL DEFAULT '', category text NOT NULL DEFAULT '',
 source_url text NOT NULL DEFAULT '', pattern_reference text NOT NULL DEFAULT '',
 syllabus_version text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
 access_policy text NOT NULL DEFAULT 'pro' CHECK(access_policy IN ('free','pro')),
 display_order integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS study_syllabuses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), exam_id text NOT NULL REFERENCES study_exams(id),
 version text NOT NULL, source_url text NOT NULL, pattern_reference text NOT NULL DEFAULT '',
 verified_by text, verified_at timestamptz, UNIQUE(exam_id,version), UNIQUE(id,exam_id)
);
CREATE TABLE IF NOT EXISTS study_topics (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), syllabus_id uuid NOT NULL REFERENCES study_syllabuses(id),
 parent_id uuid, kind text NOT NULL CHECK(kind IN ('stage','subject','chapter','topic')),
 name text NOT NULL, description text NOT NULL DEFAULT '', reference text NOT NULL DEFAULT '',
 objectives text NOT NULL DEFAULT '', minutes integer NOT NULL DEFAULT 30 CHECK(minutes BETWEEN 1 AND 1440),
 difficulty text NOT NULL DEFAULT 'Moderate' CHECK(difficulty IN ('Easy','Moderate','Hard')),
 display_order integer NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
 UNIQUE(id,syllabus_id), FOREIGN KEY(parent_id,syllabus_id) REFERENCES study_topics(id,syllabus_id), CHECK(parent_id IS DISTINCT FROM id)
);
CREATE TABLE IF NOT EXISTS study_prerequisites (
 topic_id uuid REFERENCES study_topics(id), prerequisite_id uuid REFERENCES study_topics(id),
 PRIMARY KEY(topic_id,prerequisite_id), CHECK(topic_id<>prerequisite_id)
);
CREATE TABLE IF NOT EXISTS study_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text NOT NULL CHECK(slug ~ '^[a-z0-9][a-z0-9-]{1,59}$'),
 edition integer NOT NULL CHECK(edition>0), exam_id text NOT NULL REFERENCES study_exams(id), syllabus_id uuid NOT NULL,
 title text NOT NULL, description text NOT NULL DEFAULT '', level text NOT NULL DEFAULT 'Foundation',
 duration integer NOT NULL CHECK(duration BETWEEN 1 AND 365), daily_minutes integer NOT NULL CHECK(daily_minutes BETWEEN 1 AND 1440),
 weekly_goals text NOT NULL DEFAULT '', completion_criteria text NOT NULL DEFAULT 'Complete all required tasks',
 access_policy text NOT NULL DEFAULT 'pro' CHECK(access_policy IN ('free','pro')),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
 revision integer NOT NULL DEFAULT 1, created_by text NOT NULL, published_at timestamptz,
 UNIQUE(slug,edition), UNIQUE(id,syllabus_id), FOREIGN KEY(syllabus_id,exam_id) REFERENCES study_syllabuses(id,exam_id)
);
CREATE TABLE IF NOT EXISTS study_days (
 plan_id uuid REFERENCES study_plans(id), day integer CHECK(day BETWEEN 1 AND 365),
 objectives text NOT NULL DEFAULT '', PRIMARY KEY(plan_id,day)
);
CREATE TABLE IF NOT EXISTS study_resources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), exam_id text NOT NULL REFERENCES study_exams(id), topic_id uuid REFERENCES study_topics(id),
 title text NOT NULL, description text NOT NULL DEFAULT '', kind text NOT NULL CHECK(kind IN ('syllabus','notes','revision','formula','reference','pyq','other')),
 ebook_slug varchar(60) REFERENCES ebooks(slug), source_url text NOT NULL DEFAULT '', attribution text NOT NULL,
 rights_notes text NOT NULL, access_policy text NOT NULL DEFAULT 'pro' CHECK(access_policy IN ('free','pro')),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
 uploaded_by text NOT NULL, uploaded_at timestamptz NOT NULL DEFAULT now(), CHECK(ebook_slug IS NOT NULL OR (source_url<>'' AND access_policy='free'))
);
CREATE TABLE IF NOT EXISTS study_tasks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_id uuid NOT NULL, day integer NOT NULL,
 topic_id uuid REFERENCES study_topics(id), title text NOT NULL, description text NOT NULL DEFAULT '',
 kind text NOT NULL CHECK(kind IN ('reading','pdf','pyq','quiz','mock','revision','guidance')),
 minutes integer NOT NULL CHECK(minutes BETWEEN 1 AND 1440), display_order integer NOT NULL DEFAULT 0,
 required boolean NOT NULL DEFAULT true, preview boolean NOT NULL DEFAULT false,
 resource_id uuid REFERENCES study_resources(id), mock_id varchar(40) REFERENCES mock_tests(id),
 UNIQUE(id,plan_id), FOREIGN KEY(plan_id,day) REFERENCES study_days(plan_id,day)
);
CREATE TABLE IF NOT EXISTS study_task_questions (
 task_id uuid REFERENCES study_tasks(id), question_id uuid REFERENCES mock_questions(id), display_order integer NOT NULL DEFAULT 0,
 PRIMARY KEY(task_id,question_id)
);
CREATE TABLE IF NOT EXISTS study_pyq_metadata (
 question_id uuid PRIMARY KEY REFERENCES mock_questions(id), exam_id text NOT NULL REFERENCES study_exams(id),
 topic_id uuid REFERENCES study_topics(id), exam_year integer CHECK(exam_year BETWEEN 1950 AND 2200),
 stage text NOT NULL DEFAULT '', session text NOT NULL DEFAULT '', language text NOT NULL DEFAULT 'en',
 source text NOT NULL DEFAULT '', verification text NOT NULL DEFAULT 'unverified' CHECK(verification IN ('unverified','verified')),
 rights_notes text NOT NULL DEFAULT '', updated_by text NOT NULL, CHECK(verification='unverified' OR (source<>'' AND exam_year IS NOT NULL AND stage<>''))
);
CREATE TABLE IF NOT EXISTS study_enrollments (
 user_id uuid REFERENCES users(id) ON DELETE CASCADE, plan_id uuid REFERENCES study_plans(id),
 start_date date NOT NULL, current_day integer NOT NULL DEFAULT 1 CHECK(current_day BETWEEN 1 AND 365), enrolled_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,plan_id)
);
CREATE TABLE IF NOT EXISTS study_completions (
 user_id uuid NOT NULL, plan_id uuid NOT NULL, task_id uuid NOT NULL, completed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,plan_id,task_id), FOREIGN KEY(user_id,plan_id) REFERENCES study_enrollments(user_id,plan_id) ON DELETE CASCADE,
 FOREIGN KEY(task_id,plan_id) REFERENCES study_tasks(id,plan_id)
);
CREATE INDEX IF NOT EXISTS study_plans_catalogue ON study_plans(status,exam_id,slug,edition DESC);
CREATE INDEX IF NOT EXISTS study_topics_hierarchy ON study_topics(syllabus_id,parent_id,display_order);
CREATE INDEX IF NOT EXISTS study_tasks_day ON study_tasks(plan_id,day,display_order);
CREATE INDEX IF NOT EXISTS study_enrollments_plan ON study_enrollments(plan_id);
CREATE INDEX IF NOT EXISTS study_resources_exam ON study_resources(exam_id,topic_id,status);
CREATE INDEX IF NOT EXISTS study_pyq_topic ON study_pyq_metadata(exam_id,topic_id,verification);
COMMIT;
