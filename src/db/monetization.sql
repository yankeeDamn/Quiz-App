-- Additive, opt-in migration. Apply on staging before MONETIZATION_ENABLED=true.
BEGIN;
CREATE TABLE IF NOT EXISTS monetization_documents (
 kind text NOT NULL CHECK(kind IN ('ad','institute','event','affiliate','ebook')),
 id text NOT NULL, document jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(kind,id)
);
CREATE TABLE IF NOT EXISTS monetization_grants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
 code text NOT NULL, resource_id text NOT NULL DEFAULT '', expires_at timestamptz NOT NULL,
 reference text NOT NULL UNIQUE, granted_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS monetization_grants_access ON monetization_grants(user_id,code,expires_at);
CREATE TABLE IF NOT EXISTS monetization_orders (
 id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id), code text NOT NULL,
 resource_id text NOT NULL DEFAULT '', amount_inr integer NOT NULL CHECK(amount_inr>0),
 mode text NOT NULL CHECK(mode IN ('sandbox','production')), status text NOT NULL DEFAULT 'pending',
 created_at timestamptz NOT NULL DEFAULT now(), paid_at timestamptz
);
CREATE TABLE IF NOT EXISTS monetization_metrics (
 kind text NOT NULL, id text NOT NULL, event text NOT NULL CHECK(event IN ('impression','click')),
 session_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(kind,id,event,session_id)
);
CREATE TABLE IF NOT EXISTS monetization_registrations (
 event_id text NOT NULL, user_id uuid NOT NULL REFERENCES users(id), registered_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(event_id,user_id)
);
CREATE TABLE IF NOT EXISTS monetization_members (
 institute_id text NOT NULL, user_id uuid NOT NULL REFERENCES users(id),
 PRIMARY KEY(institute_id,user_id)
);
COMMIT;
