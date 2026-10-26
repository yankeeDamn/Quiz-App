-- Payment records are kept separate from manual WhatsApp-admin plan grants.
CREATE TABLE IF NOT EXISTS payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  gateway VARCHAR(30) NOT NULL DEFAULT 'razorpay',
  gateway_order_id VARCHAR(120) NOT NULL UNIQUE,
  gateway_payment_id VARCHAR(120) UNIQUE,
  plan VARCHAR(20) NOT NULL CHECK (plan = 'pro'),
  months INTEGER NOT NULL CHECK (months IN (1,12)),
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
  status VARCHAR(20) NOT NULL DEFAULT 'created' CHECK(status IN ('created','paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  CHECK ((status='paid' AND gateway_payment_id IS NOT NULL AND paid_at IS NOT NULL)
      OR (status='created' AND gateway_payment_id IS NULL AND paid_at IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON payment_orders(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS payment_webhook_events (
  event_id VARCHAR(150) PRIMARY KEY,
  gateway_order_id VARCHAR(120) NOT NULL,
  gateway_payment_id VARCHAR(120) NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
