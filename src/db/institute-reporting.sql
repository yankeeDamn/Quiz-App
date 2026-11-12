-- MANUAL additive index, after institute-delivery.sql; never in startup migrations.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('exampro-institute-reporting-v1'));
CREATE INDEX IF NOT EXISTS pilot_attempts_pending_deadline ON pilot_attempts(deadline_at,id)
 WHERE snapshot IS NOT NULL AND submitted_at IS NULL;
COMMIT;
