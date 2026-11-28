-- Additive, opt-in migration. No existing content state is rewritten.
CREATE TABLE IF NOT EXISTS publishing_jobs (
  content_type text NOT NULL CHECK (content_type IN ('study_plan')),
  content_id text NOT NULL,
  expected_revision integer NOT NULL,
  publish_at timestamptz NOT NULL,
  requested_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (content_type, content_id)
);
CREATE INDEX IF NOT EXISTS publishing_jobs_due ON publishing_jobs(publish_at);
CREATE TABLE IF NOT EXISTS publishing_versions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  content_type text NOT NULL,
  content_id text NOT NULL,
  revision integer NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS publishing_versions_content ON publishing_versions(content_type, content_id, id DESC);
CREATE TABLE IF NOT EXISTS publishing_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  content_type text NOT NULL,
  content_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('schedule','cancel','publish','archive')),
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS publishing_events_content ON publishing_events(content_type, content_id, id DESC);
