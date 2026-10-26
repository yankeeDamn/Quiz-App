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

  // ── Admin (used to unlock plans after a WhatsApp payment) ──
  // Leave empty to disable the admin endpoints.
  adminKey: process.env.ADMIN_API_KEY || '',
  // Emails allowed to open the /admin page (comma separated). Sign in with Google or GitHub using one of these.
  adminEmails: (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),

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
      : ['http://localhost:3000', 'http://localhost:3001', 'https://quiz-app-virid-zeta-41.vercel.app'],
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

  if (!config.jwt.secret && !config.authSecret) missing.push('AUTH_SECRET (or JWT_SECRET)');
  if (config.adminKey && config.adminKey.length < 24) missing.push('ADMIN_API_KEY (use at least 24 characters)');

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
