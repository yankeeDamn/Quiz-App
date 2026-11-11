-- MANUAL additive billing schema. No commercial prices, subscriptions or grants seeded.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('exampro-institute-billing-v1'));
CREATE TABLE IF NOT EXISTS pilot_billing_plans (
 code text PRIMARY KEY CHECK(code ~ '^[A-Z][A-Z0-9_]{2,39}$'),
 name text NOT NULL CHECK(length(name) BETWEEN 2 AND 120),
 amount_paise integer NOT NULL CHECK(amount_paise BETWEEN 100 AND 100000000),
 period_days integer NOT NULL CHECK(period_days BETWEEN 1 AND 366),
 limits jsonb NOT NULL CHECK(jsonb_typeof(limits)='object'),
 active boolean NOT NULL DEFAULT false,
 updated_by uuid NOT NULL REFERENCES users(id),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE pilot_subscriptions DROP CONSTRAINT IF EXISTS pilot_subscriptions_provider_check;
ALTER TABLE pilot_subscriptions ADD CONSTRAINT pilot_subscriptions_provider_check CHECK(provider IN ('razorpay','stripe','manual','cashfree'));
ALTER TABLE pilot_subscriptions ADD COLUMN IF NOT EXISTS billing_managed boolean NOT NULL DEFAULT false;
ALTER TABLE pilot_subscriptions ADD COLUMN IF NOT EXISTS limits jsonb;
ALTER TABLE pilot_subscriptions ADD COLUMN IF NOT EXISTS current_period_start timestamptz;
ALTER TABLE pilot_subscriptions ADD COLUMN IF NOT EXISTS mode text CHECK(mode IN ('sandbox','production'));
ALTER TABLE pilot_subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS pilot_one_managed_subscription ON pilot_subscriptions(institute_id) WHERE billing_managed;
CREATE TABLE IF NOT EXISTS pilot_billing_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 institute_id uuid NOT NULL REFERENCES pilot_institutes(id),
 requested_by uuid NOT NULL REFERENCES users(id),
 quoted_by uuid NOT NULL REFERENCES users(id),
 plan_code text NOT NULL REFERENCES pilot_billing_plans(code),
 plan_snapshot jsonb NOT NULL,
 amount_paise integer NOT NULL CHECK(amount_paise BETWEEN 100 AND 100000000),
 mode text NOT NULL CHECK(mode IN ('sandbox','production')),
 status text NOT NULL DEFAULT 'quoted' CHECK(status IN ('quoted','pending','paid','expired','cancelled')),
 expires_at timestamptz NOT NULL,
 paid_at timestamptz,
 provider_order_id text UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(institute_id,id),
 FOREIGN KEY(institute_id,requested_by) REFERENCES pilot_memberships(institute_id,user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS pilot_one_open_billing_order ON pilot_billing_orders(institute_id) WHERE status IN ('quoted','pending');
CREATE TABLE IF NOT EXISTS pilot_billing_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 institute_id uuid NOT NULL,
 order_id uuid NOT NULL UNIQUE,
 amount_paise integer NOT NULL CHECK(amount_paise>0),
 currency text NOT NULL CHECK(currency='INR'),
 mode text NOT NULL CHECK(mode IN ('sandbox','production')),
 period_start timestamptz NOT NULL,
 period_end timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(institute_id,order_id) REFERENCES pilot_billing_orders(institute_id,id),
 CHECK(period_end>period_start)
);
CREATE OR REPLACE FUNCTION pilot_guard_billing_order() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.institute_id IS DISTINCT FROM OLD.institute_id
 OR NEW.requested_by IS DISTINCT FROM OLD.requested_by OR NEW.quoted_by IS DISTINCT FROM OLD.quoted_by
 OR NEW.plan_code IS DISTINCT FROM OLD.plan_code OR NEW.plan_snapshot IS DISTINCT FROM OLD.plan_snapshot
 OR NEW.amount_paise IS DISTINCT FROM OLD.amount_paise OR NEW.mode IS DISTINCT FROM OLD.mode
 OR NEW.expires_at IS DISTINCT FROM OLD.expires_at OR NEW.created_at IS DISTINCT FROM OLD.created_at
 OR (OLD.status='paid' AND NEW IS DISTINCT FROM OLD) THEN
  RAISE EXCEPTION 'Billing order terms or paid record are immutable' USING ERRCODE='23514';
 END IF;RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS pilot_guard_billing_order ON pilot_billing_orders;
CREATE TRIGGER pilot_guard_billing_order BEFORE UPDATE ON pilot_billing_orders FOR EACH ROW EXECUTE FUNCTION pilot_guard_billing_order();
CREATE OR REPLACE FUNCTION pilot_guard_billing_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Billing receipts are immutable' USING ERRCODE='23514'; END $$;
DROP TRIGGER IF EXISTS pilot_guard_billing_receipt ON pilot_billing_receipts;
CREATE TRIGGER pilot_guard_billing_receipt BEFORE UPDATE OR DELETE ON pilot_billing_receipts FOR EACH ROW EXECUTE FUNCTION pilot_guard_billing_receipt();
COMMIT;
