-- Additive; run before deploying the PDF preview backend.
ALTER TABLE ebook_pdf_assets ADD COLUMN IF NOT EXISTS preview_bytes BYTEA;
ALTER TABLE ebook_pdf_assets ADD COLUMN IF NOT EXISTS preview_pages INTEGER CHECK (preview_pages BETWEEN 1 AND 50);
-- Ebook settings are validated fields in the existing ebooks.document JSONB:
-- accessLevel: free|pro (default free), freePreviewPages: 1..50 (default 2),
-- allowPdfDownload: boolean (existing field).

-- Policy and grant lookups remain available when checkout is disabled.
-- Same schema as monetization.sql; no sales/payment features are enabled here.
CREATE TABLE IF NOT EXISTS monetization_documents (
 kind text NOT NULL CHECK(kind IN ('ad','institute','event','affiliate','ebook')),
 id text NOT NULL, document jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(kind,id)
);
CREATE TABLE IF NOT EXISTS monetization_grants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
 code text NOT NULL, resource_id text NOT NULL DEFAULT '', expires_at timestamptz NOT NULL,
 reference text NOT NULL UNIQUE, granted_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS monetization_grants_access ON monetization_grants(user_id,code,expires_at);
