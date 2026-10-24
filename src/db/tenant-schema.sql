-- Run after the existing users migration. This is an additive foundation.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS institutes (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 slug VARCHAR(63) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 name VARCHAR(160) NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'trial' CHECK (status IN ('trial','active','suspended')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS institute_memberships (
 institute_id UUID NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role VARCHAR(20) NOT NULL CHECK (role IN ('owner','admin','teacher','student')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY (institute_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_institute_memberships_user ON institute_memberships(user_id);
CREATE TABLE IF NOT EXISTS institute_branding (
 institute_id UUID PRIMARY KEY REFERENCES institutes(id) ON DELETE CASCADE,
 tagline VARCHAR(200),
 primary_color CHAR(7) NOT NULL DEFAULT '#2563eb' CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
 secondary_color CHAR(7) NOT NULL DEFAULT '#0f172a' CHECK (secondary_color ~ '^#[0-9A-Fa-f]{6}$'),
 logo_url TEXT, banner_url TEXT, support_email VARCHAR(255),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS institute_domains (
 hostname VARCHAR(253) PRIMARY KEY,
 institute_id UUID NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
 verified_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK (hostname = lower(hostname))
);
CREATE INDEX IF NOT EXISTS idx_institute_domains_tenant ON institute_domains(institute_id);
CREATE TABLE IF NOT EXISTS institute_subscriptions (
 institute_id UUID PRIMARY KEY REFERENCES institutes(id) ON DELETE CASCADE,
 plan VARCHAR(20) NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter','growth','pro')),
 status VARCHAR(20) NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing','active','past_due','cancelled')),
 student_limit INTEGER NOT NULL DEFAULT 100 CHECK (student_limit > 0),
 provider VARCHAR(30), provider_subscription_id VARCHAR(255) UNIQUE,
 current_period_end TIMESTAMPTZ,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS institute_batches (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 institute_id UUID NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
 name VARCHAR(120) NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(institute_id,name),
 UNIQUE(institute_id,id)
);
CREATE TABLE IF NOT EXISTS institute_batch_students (
 institute_id UUID NOT NULL,
 batch_id UUID NOT NULL,
 user_id UUID NOT NULL,
 PRIMARY KEY (batch_id,user_id),
 FOREIGN KEY (institute_id,batch_id) REFERENCES institute_batches(institute_id,id) ON DELETE CASCADE,
 FOREIGN KEY (institute_id,user_id) REFERENCES institute_memberships(institute_id,user_id) ON DELETE CASCADE
);
-- Future exam, question, attempt and result tables must also carry institute_id.
-- Existing global quiz tables are NOT tenant-safe and must not be reused for institute data without migration.
