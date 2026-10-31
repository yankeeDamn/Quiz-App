-- Additive ebook storage; existing exams, users and results are unchanged.
CREATE TABLE IF NOT EXISTS ebooks (
  slug VARCHAR(60) PRIMARY KEY,
  document JSONB NOT NULL,
  visibility VARCHAR(20) NOT NULL DEFAULT 'admin_only' CHECK (visibility IN ('admin_only','invite_only','public')),
  revision INTEGER NOT NULL DEFAULT 1,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ebook_access (
  slug VARCHAR(60) NOT NULL REFERENCES ebooks(slug),
  email VARCHAR(255) NOT NULL,
  role VARCHAR(10) NOT NULL DEFAULT 'reader' CHECK (role IN ('reader','editor')),
  status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','revoked')),
  note VARCHAR(1000) NOT NULL DEFAULT '',
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by VARCHAR(255),
  PRIMARY KEY(slug,email)
);
CREATE INDEX IF NOT EXISTS ebook_access_pending ON ebook_access(status,slug);
CREATE TABLE IF NOT EXISTS ebook_progress (
  slug VARCHAR(60) NOT NULL REFERENCES ebooks(slug),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  completed JSONB NOT NULL DEFAULT '[]',
  bookmark VARCHAR(60),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(slug,user_id)
);
CREATE TABLE IF NOT EXISTS ebook_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(60) NOT NULL REFERENCES ebooks(slug),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  answers JSONB NOT NULL DEFAULT '{}',
  negative_marks NUMERIC(4,2) NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  submitted_at TIMESTAMPTZ,
  result JSONB,
  shared BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS ebook_attempts_user ON ebook_attempts(user_id,started_at DESC);

CREATE TABLE IF NOT EXISTS ebook_pdf_assets (
  slug VARCHAR(60) PRIMARY KEY REFERENCES ebooks(slug),
  filename VARCHAR(180) NOT NULL,
  bytes BYTEA NOT NULL CHECK (octet_length(bytes) <= 3145728),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
