-- ExamPro Government Jobs — private, manually maintained application tracker.
-- OPTIONAL ADDITIVE MIGRATION; NEVER APPLY AUTOMATICALLY.
-- REVIEW AND APPLY ONLY ON APPROVED ISOLATED STAGING NEON FIRST.
-- The public government jobs feed remains unchanged.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.govt_job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    notice_id VARCHAR(80),
    title VARCHAR(180) NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 180),
    organisation VARCHAR(180) NOT NULL CHECK (length(btrim(organisation)) BETWEEN 2 AND 180),
    category VARCHAR(20) NOT NULL DEFAULT 'General'
      CHECK (category IN ('SSC', 'UPSC', 'Railways', 'Banking', 'General', 'Other')),
    official_url TEXT CHECK (official_url IS NULL OR length(official_url) <= 1000),
    status VARCHAR(24) NOT NULL DEFAULT 'planning'
      CHECK (status IN ('planning', 'applied', 'admit_card', 'exam_completed', 'result_checked', 'withdrawn')),
    application_date DATE,
    deadline DATE,
    -- AES-256-GCM envelope (12-byte nonce, 16-byte tag, ciphertext);
    -- the encryption key lives exclusively in the API environment.
    reference_ciphertext TEXT,
    reference_suffix VARCHAR(4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK ((reference_ciphertext IS NULL AND reference_suffix IS NULL)
        OR (reference_ciphertext IS NOT NULL AND reference_suffix IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS govt_job_applications_user_updated
    ON public.govt_job_applications(user_id, updated_at DESC, id);

-- No global read policy or public views. Every API query MUST include user_id.
-- This migration does not seed data, collect Aadhaar/OTP/passwords, or publish notices.
