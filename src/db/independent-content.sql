-- Opt-in, additive independent PDF draft inventory. No legacy ebook data changes.
CREATE TABLE IF NOT EXISTS content_pdf_drafts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title varchar(180) NOT NULL,
 category varchar(100) NOT NULL, filename varchar(180), bytes bytea, preview_bytes bytea,
 page_count integer, revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

-- Independent course curriculum drafts; module/lesson IDs remain stable during editing.
CREATE TABLE IF NOT EXISTS content_course_drafts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title varchar(180) NOT NULL,
 description text NOT NULL DEFAULT '', level varchar(30) NOT NULL DEFAULT 'beginner',
 modules jsonb NOT NULL DEFAULT '[]'::jsonb, revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_certification_drafts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title varchar(180) NOT NULL,
 exam_code varchar(60) NOT NULL UNIQUE, description text NOT NULL DEFAULT '',
 domains jsonb NOT NULL DEFAULT '[]'::jsonb,
 pdf_ids uuid[] NOT NULL DEFAULT '{}', course_ids uuid[] NOT NULL DEFAULT '{}',
 revision integer NOT NULL DEFAULT 1, updated_at timestamptz NOT NULL DEFAULT now()
);
