-- Apply manually on isolated staging Neon only; this PR performs no migration.
CREATE TABLE IF NOT EXISTS exam_beta_feedback (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 test_id VARCHAR(40) NOT NULL REFERENCES mock_tests(id),
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 category VARCHAR(24) NOT NULL CHECK(category IN ('translation','timing','scoring','navigation','accessibility','other')),
 severity VARCHAR(12) NOT NULL CHECK(severity IN ('low','medium','high')),
 comment TEXT NOT NULL CHECK(length(comment) BETWEEN 10 AND 1500),
 status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK(status IN ('open','triaged','resolved')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS exam_beta_feedback_test_created ON exam_beta_feedback(test_id,created_at DESC);
CREATE TABLE IF NOT EXISTS exam_beta_invitation_audit (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 invitation_id UUID REFERENCES exam_beta_invitations(id) ON DELETE SET NULL,
 action VARCHAR(16) NOT NULL CHECK(action IN ('created','redeemed','revoked','denied')),
 actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
 actor_email VARCHAR(255),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS exam_beta_invitation_audit_created ON exam_beta_invitation_audit(created_at DESC);
