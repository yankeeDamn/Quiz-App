-- Ebook authoring + monetization contract.
-- Additive/idempotent: keeps JSON document compatibility while making access fields queryable.
ALTER TABLE ebooks ADD COLUMN IF NOT EXISTS access_level VARCHAR(10) NOT NULL DEFAULT 'free';
ALTER TABLE ebooks ADD COLUMN IF NOT EXISTS free_preview_pages INTEGER NOT NULL DEFAULT 2;
ALTER TABLE ebooks ADD COLUMN IF NOT EXISTS allow_full_pdf_download BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE ebooks ADD COLUMN IF NOT EXISTS full_pdf_storage_key TEXT;
ALTER TABLE ebooks ADD COLUMN IF NOT EXISTS preview_pdf_storage_key TEXT;
ALTER TABLE ebooks ADD COLUMN IF NOT EXISTS is_bundled_public_edition BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE ebooks DROP CONSTRAINT IF EXISTS ebooks_access_level_check;
ALTER TABLE ebooks ADD CONSTRAINT ebooks_access_level_check CHECK (access_level IN ('free','pro'));
ALTER TABLE ebooks DROP CONSTRAINT IF EXISTS ebooks_free_preview_pages_check;
ALTER TABLE ebooks ADD CONSTRAINT ebooks_free_preview_pages_check CHECK (free_preview_pages BETWEEN 1 AND 20);
ALTER TABLE ebooks DROP CONSTRAINT IF EXISTS ebooks_visibility_check;
ALTER TABLE ebooks ADD CONSTRAINT ebooks_visibility_check CHECK (visibility IN ('admin_only','invite_only','public','archived'));

UPDATE ebooks
SET
  is_bundled_public_edition = slug IN (
    'python-mastery','ai-with-copilot','java-enterprise','ml-scikit-learn',
    'python-cheatcodes','llm-models-to-products','md-102-endpoint-admin',
    'learn-huggingface','finetune-llms-beginners','github-copilot-gh300'
  ),
  access_level = CASE
    WHEN slug IN (
      'python-mastery','ai-with-copilot','java-enterprise','ml-scikit-learn',
      'python-cheatcodes','llm-models-to-products','md-102-endpoint-admin',
      'learn-huggingface','finetune-llms-beginners','github-copilot-gh300'
    ) THEN 'free'
    WHEN document->>'accessLevel' IN ('free','pro') THEN document->>'accessLevel'
    ELSE access_level
  END,
  free_preview_pages = LEAST(20, GREATEST(1,
    CASE WHEN (document->>'freePreviewPages') ~ '^[0-9]+$'
      THEN (document->>'freePreviewPages')::integer ELSE free_preview_pages END
  )),
  allow_full_pdf_download = COALESCE(
    CASE WHEN document ? 'allowFullPdfDownload' THEN (document->>'allowFullPdfDownload')::boolean END,
    CASE WHEN document ? 'allowPdfDownload' THEN (document->>'allowPdfDownload')::boolean END,
    allow_full_pdf_download
  );

UPDATE ebooks e
SET
  full_pdf_storage_key = CASE WHEN a.slug IS NULL THEN NULL ELSE 'postgres://ebook_pdf_assets/' || e.slug || '/full' END,
  preview_pdf_storage_key = CASE WHEN a.preview_bytes IS NULL THEN NULL ELSE 'postgres://ebook_pdf_assets/' || e.slug || '/preview' END
FROM ebook_pdf_assets a
WHERE a.slug=e.slug;

UPDATE ebooks
SET
  visibility = 'public',
  archived = FALSE,
  access_level = 'free'
WHERE is_bundled_public_edition;

UPDATE ebooks
SET document = document || jsonb_build_object(
  'accessLevel', access_level,
  'freePreviewPages', free_preview_pages,
  'allowFullPdfDownload', allow_full_pdf_download,
  'allowPdfDownload', allow_full_pdf_download,
  'fullPdfStorageKey', full_pdf_storage_key,
  'previewPdfStorageKey', preview_pdf_storage_key,
  'isBundledPublicEdition', is_bundled_public_edition
);

CREATE INDEX IF NOT EXISTS ebooks_updated_at_idx ON ebooks(updated_at DESC);
CREATE INDEX IF NOT EXISTS ebooks_access_level_idx ON ebooks(access_level, archived, updated_at DESC);
