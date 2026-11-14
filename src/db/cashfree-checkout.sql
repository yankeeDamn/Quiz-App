-- Additive and opt-in. Review/apply separately; never run during application boot.
BEGIN;
ALTER TABLE monetization_orders ADD COLUMN IF NOT EXISTS checkout_key uuid;
ALTER TABLE monetization_orders ADD COLUMN IF NOT EXISTS checkout_retry_keys uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE monetization_orders ADD COLUMN IF NOT EXISTS customer_phone text;
ALTER TABLE monetization_orders ADD COLUMN IF NOT EXISTS provider_payment_id text;
CREATE UNIQUE INDEX IF NOT EXISTS monetization_orders_checkout_key
 ON monetization_orders(user_id,checkout_key) WHERE checkout_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS monetization_orders_provider_payment
 ON monetization_orders(mode,provider_payment_id) WHERE provider_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS monetization_orders_history
 ON monetization_orders(user_id,created_at DESC,id DESC);
COMMIT;
