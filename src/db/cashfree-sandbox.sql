-- PR64 manual staging-only migration. NEVER add this file to production auto-migrate.
CREATE TABLE IF NOT EXISTS cashfree_sandbox_orders (
 id VARCHAR(48) PRIMARY KEY,
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 plan VARCHAR(16) NOT NULL DEFAULT 'pro' CHECK(plan='pro'),
 billing_period VARCHAR(8) NOT NULL CHECK(billing_period IN ('monthly','yearly')),
 months INTEGER NOT NULL CHECK(months IN (1,12)),
 amount_inr INTEGER NOT NULL CHECK(amount_inr IN (199,1990)),
 currency CHAR(3) NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
 status VARCHAR(16) NOT NULL DEFAULT 'initiated' CHECK(status IN ('initiated','pending','paid','failed','expired')),
 cf_payment_id VARCHAR(80),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 paid_at TIMESTAMPTZ,
 granted_at TIMESTAMPTZ,
 UNIQUE(id,cf_payment_id)
);
CREATE INDEX IF NOT EXISTS cashfree_sandbox_orders_user_created ON cashfree_sandbox_orders(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS cashfree_sandbox_webhook_events (
 fingerprint CHAR(64) PRIMARY KEY,
 order_id VARCHAR(48) REFERENCES cashfree_sandbox_orders(id),
 event_type VARCHAR(80) NOT NULL,
 outcome VARCHAR(32) NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS cashfree_sandbox_webhook_events_created ON cashfree_sandbox_webhook_events(created_at DESC);
