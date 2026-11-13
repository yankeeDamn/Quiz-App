-- MANUAL additive migration after monetization.sql. No existing ad is altered.
BEGIN;
CREATE TABLE IF NOT EXISTS advertising_verified_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 kind text NOT NULL DEFAULT 'ad' CHECK(kind='ad'),
 ad_id text NOT NULL,
 provider_order_id text NOT NULL UNIQUE,
 mode text NOT NULL CHECK(mode IN ('sandbox','production')),
 purpose text NOT NULL CHECK(purpose IN ('booking','renewal')),
 amount_paise integer NOT NULL CHECK(amount_paise>0),
 duration_days integer NOT NULL CHECK(duration_days IN (7,30)),
 verified_by uuid NOT NULL REFERENCES users(id),
 verified_at timestamptz NOT NULL DEFAULT now(),
 consumed_action text CHECK(consumed_action IN ('approve','extend')),
 consumed_at timestamptz,
 FOREIGN KEY(kind,ad_id) REFERENCES monetization_documents(kind,id),
 CHECK((consumed_action IS NULL)=(consumed_at IS NULL))
);
CREATE TABLE IF NOT EXISTS advertising_audit_logs (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 ad_id text NOT NULL,
 actor_id uuid NOT NULL REFERENCES users(id),
 action text NOT NULL,
 payment_id uuid REFERENCES advertising_verified_payments(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION advertising_guard_payment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.ad_id IS DISTINCT FROM OLD.ad_id OR NEW.kind IS DISTINCT FROM OLD.kind
 OR NEW.provider_order_id IS DISTINCT FROM OLD.provider_order_id OR NEW.mode IS DISTINCT FROM OLD.mode
 OR NEW.purpose IS DISTINCT FROM OLD.purpose OR NEW.amount_paise IS DISTINCT FROM OLD.amount_paise
 OR NEW.duration_days IS DISTINCT FROM OLD.duration_days OR NEW.verified_by IS DISTINCT FROM OLD.verified_by
 OR NEW.verified_at IS DISTINCT FROM OLD.verified_at OR (OLD.consumed_at IS NOT NULL AND NEW IS DISTINCT FROM OLD) THEN
 RAISE EXCEPTION 'Verified advertising payment is immutable' USING ERRCODE='23514';END IF;RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS advertising_guard_payment ON advertising_verified_payments;
CREATE TRIGGER advertising_guard_payment BEFORE UPDATE ON advertising_verified_payments FOR EACH ROW EXECUTE FUNCTION advertising_guard_payment();
COMMIT;
