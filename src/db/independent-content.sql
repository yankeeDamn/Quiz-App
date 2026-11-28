-- Opt-in, additive independent PDF draft inventory. No legacy ebook data changes.
CREATE TABLE IF NOT EXISTS content_pdf_drafts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title varchar(180) NOT NULL,
 category varchar(100) NOT NULL, filename varchar(180), bytes bytea, preview_bytes bytea,
 page_count integer, revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
