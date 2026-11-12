-- Manual, additive B2B expansion. NOT included in migrate.js or Render builds.
-- Review on a disposable database first; never apply to live DBs without approval.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('exampro-institute-foundation-v1'));
ALTER TABLE pilot_institutes ADD COLUMN IF NOT EXISTS legal_name text;
ALTER TABLE pilot_institutes ADD COLUMN IF NOT EXISTS profile jsonb NOT NULL DEFAULT '{}';
ALTER TABLE pilot_institutes ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE pilot_institutes DROP CONSTRAINT IF EXISTS pilot_institutes_status_check;
ALTER TABLE pilot_institutes ADD CONSTRAINT pilot_institutes_status_check CHECK (status IN ('trial','active','suspended','archived'));
ALTER TABLE pilot_memberships ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked'));
ALTER TABLE pilot_memberships ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE pilot_memberships DROP CONSTRAINT IF EXISTS pilot_memberships_role_check;
ALTER TABLE pilot_memberships ADD CONSTRAINT pilot_memberships_role_check CHECK(role IN ('owner','admin','teacher','student'));
-- If legacy data contains two active owners, this aborts without rewriting it.
CREATE UNIQUE INDEX IF NOT EXISTS pilot_one_active_owner ON pilot_memberships(institute_id) WHERE role='owner' AND status='active';
CREATE OR REPLACE FUNCTION pilot_keep_slug() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.slug IS DISTINCT FROM OLD.slug THEN RAISE EXCEPTION 'Institute slug is immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS pilot_immutable_slug ON pilot_institutes;
CREATE TRIGGER pilot_immutable_slug BEFORE UPDATE ON pilot_institutes FOR EACH ROW EXECUTE FUNCTION pilot_keep_slug();
CREATE TABLE IF NOT EXISTS pilot_applications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 applicant_id uuid NOT NULL REFERENCES users(id),
 name text NOT NULL CHECK(length(name) BETWEEN 2 AND 160),
 legal_name text NOT NULL CHECK(length(legal_name) BETWEEN 2 AND 200),
 requested_slug text NOT NULL CHECK(requested_slug ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$'),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 institute_id uuid REFERENCES pilot_institutes(id),
 reviewed_by uuid REFERENCES users(id),
 reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS pilot_one_pending_application ON pilot_applications(applicant_id) WHERE status='pending';
CREATE TABLE IF NOT EXISTS pilot_invitations (
 id uuid PRIMARY KEY,
 institute_id uuid NOT NULL REFERENCES pilot_institutes(id),
 email text NOT NULL CHECK(email=lower(email)),
 role text NOT NULL CHECK(role IN ('admin','teacher','student')),
 token_digest text NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 accepted_at timestamptz,
 accepted_by uuid REFERENCES users(id),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(institute_id,id),
 FOREIGN KEY(institute_id,created_by) REFERENCES pilot_memberships(institute_id,user_id),
 CHECK(expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS pilot_invitation_institute ON pilot_invitations(institute_id,created_at DESC);
CREATE TABLE IF NOT EXISTS pilot_audit_logs (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 institute_id uuid REFERENCES pilot_institutes(id),
 actor_id uuid NOT NULL REFERENCES users(id),
 action text NOT NULL,
 resource_id text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pilot_audit_institute ON pilot_audit_logs(institute_id,created_at DESC);
-- Deliberately no data backfill, seed publication, plan grant or monetization conversion.
COMMIT;
