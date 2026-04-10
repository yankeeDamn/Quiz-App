'use strict';

const path = require('path');

// Load .env from the project root (one level above src/)
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Centralised configuration — every setting is read from env vars
 * with sensible defaults for local development.
 */
const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,

  // ── Database ─────────────────────────────────────────
  databaseUrl: process.env.DATABASE_URL || '',

  // ── Stripe ───────────────────────────────────────────
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    currency: 'usd',
    /** Amount in cents — $50.00 for full exam access */
    fullAccessAmountCents: 5000,
  },

  // ── JWT / Auth ───────────────────────────────────────
  jwt: {
    secret: process.env.JWT_SECRET || '',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  // ── NextAuth (Auth.js) ───────────────────────────────
  // The AUTH_SECRET used by the Next.js frontend to sign session JWTs.
  // The backend verifies tokens signed with this same secret.
  authSecret: process.env.AUTH_SECRET || '',

  // ── CORS ─────────────────────────────────────────────
  cors: {
    origins: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
      : ['http://localhost:3000', 'http://localhost:3001'],
  },

  // ── Logging ──────────────────────────────────────────
  logLevel: process.env.LOG_LEVEL || 'info',
};

/**
 * Validate that critical secrets are present in production.
 * Throws at startup so the app doesn't run in an insecure state.
 */
function validateConfig() {
  const missing = [];

  if (!config.stripe.secretKey) missing.push('STRIPE_SECRET_KEY');
  if (!config.stripe.webhookSecret) missing.push('STRIPE_WEBHOOK_SECRET');
  if (!config.jwt.secret) missing.push('JWT_SECRET');

  if (config.env === 'production' && missing.length > 0) {
    throw new Error(
      `Missing required environment variables for production: ${missing.join(', ')}`
    );
  }

  if (missing.length > 0) {
    // In dev mode, log a warning instead of crashing
    // eslint-disable-next-line no-console
    console.warn(
      `⚠️  Missing environment variables (non-fatal in dev): ${missing.join(', ')}`
    );
  }
}

validateConfig();

module.exports = config;
