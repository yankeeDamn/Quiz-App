-- Staging-only invitation grants. Apply explicitly on staging, not production.
CREATE TABLE IF NOT EXISTS exam_beta_invitations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 test_id VARCHAR(40) NOT NULL REFERENCES mock_tests(id) ON DELETE CASCADE,
 email VARCHAR(255) NOT NULL,
 token_hash CHAR(64) NOT NULL UNIQUE,
 expires_at TIMESTAMPTZ NOT NULL,
 redeemed_at TIMESTAMPTZ,
 redeemed_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
 revoked_at TIMESTAMPTZ,
 created_by VARCHAR(255) NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CHECK (email=LOWER(email))
);
CREATE INDEX IF NOT EXISTS exam_beta_invitations_valid
 ON exam_beta_invitations (redeemed_user_id,test_id,expires_at)
 WHERE revoked_at IS NULL;
