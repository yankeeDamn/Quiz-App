'use strict';

const config = require('../config');
const logger = require('../utils/logger');
const db = require('../config/database');

/**
 * Middleware to verify NextAuth.js (Auth.js v5) session tokens.
 *
 * Auth.js v5 uses encrypted JWE tokens (not signed JWTs).
 * Strategy: the Next.js frontend calls a lightweight `/api/auth/session`
 * endpoint on itself to obtain the decoded session, then passes the
 * user identity to the backend via a custom header or Bearer token.
 *
 * We support two flows:
 *   1. **Session token in cookie** — when backend is on same domain
 *      (reverse-proxied); cookie name: `authjs.session-token` or
 *      `__Secure-authjs.session-token` in production.
 *   2. **Bearer token** — the frontend fetches its own `/api/auth/session`,
 *      gets the session JSON, and sends user info in a signed JWT
 *      (signed with AUTH_SECRET) via `Authorization: Bearer <jwt>`.
 *
 * For simplicity and cross-origin support, we use approach #2:
 *   The frontend includes an API route that mints a short-lived backend
 *   JWT signed with AUTH_SECRET, containing { sub, email, name, image }.
 */

/**
 * Verify a backend access token (signed with AUTH_SECRET by the Next.js
 * API route `/api/auth/backend-token`).
 *
 * Populates req.user with { id, email, name, image, provider }.
 * Also ensures the user exists in the database (upserts on first sight).
 */
async function authenticateNextAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: { message: 'Authentication required' },
    });
  }

  const secret = config.authSecret || config.jwt.secret;
  if (!secret) {
    logger.error('Neither AUTH_SECRET nor JWT_SECRET is configured');
    return res.status(500).json({
      success: false,
      error: { message: 'Server authentication not configured' },
    });
  }

  try {
    // jose v6 exports are async / ESM-first, but we can dynamic-import
    const { jwtVerify } = await import('jose');
    const secretKey = new TextEncoder().encode(secret);

    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });

    // payload: { sub, email, name, image, provider, iat, exp }
    const user = {
      id: payload.sub,
      email: payload.email || null,
      name: payload.name || null,
      image: payload.image || null,
      provider: payload.provider || 'credentials',
    };

    // Upsert user into PostgreSQL (if DB is configured)
    if (config.databaseUrl) {
      try {
        const dbUser = await upsertUser(user);
        user.id = dbUser.id; // use the database UUID as canonical ID
        user.paymentStatus = dbUser.payment_status;
        user.role = dbUser.role;
      } catch (dbErr) {
        logger.warn({ err: dbErr }, 'DB upsert failed — using token identity');
      }
    }

    req.user = user;
    req.isGuest = false;
    next();
  } catch (err) {
    logger.warn({ err: err.message }, 'NextAuth token verification failed');
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid or expired token' },
    });
  }
}

/**
 * Like authenticateNextAuth but allows unauthenticated requests through
 * as guest users.
 */
async function allowNextAuthGuest(req, _res, next) {
  const authHeader = req.headers.authorization;
  const token =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

  if (!token) {
    req.user = { id: 'guest', role: 'guest' };
    req.isGuest = true;
    return next();
  }

  const secret = config.authSecret || config.jwt.secret;
  if (!secret) {
    req.user = { id: 'guest', role: 'guest' };
    req.isGuest = true;
    return next();
  }

  try {
    const { jwtVerify } = await import('jose');
    const secretKey = new TextEncoder().encode(secret);

    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ['HS256'],
    });

    const user = {
      id: payload.sub,
      email: payload.email || null,
      name: payload.name || null,
      image: payload.image || null,
      provider: payload.provider || 'credentials',
    };

    if (config.databaseUrl) {
      try {
        const dbUser = await upsertUser(user);
        user.id = dbUser.id;
        user.paymentStatus = dbUser.payment_status;
        user.role = dbUser.role;
      } catch {
        // proceed with token identity
      }
    }

    req.user = user;
    req.isGuest = false;
  } catch {
    req.user = { id: 'guest', role: 'guest' };
    req.isGuest = true;
  }

  next();
}

/**
 * Upsert a user by provider + provider_id (or email fallback).
 *
 * Security note: the email fallback could link accounts across providers
 * if they share an email. In production, consider requiring email
 * verification before allowing cross-provider account linking.
 *
 * @param {{ id: string, email: string|null, name: string|null, image: string|null, provider: string }} user
 * @returns {Promise<Object>} the database row
 */
async function upsertUser(user) {
  // Try to find by provider + provider_id first
  const findResult = await db.query(
    `SELECT * FROM users
     WHERE (provider = $1 AND provider_id = $2)
        OR (email = $3 AND email IS NOT NULL)
     ORDER BY
       CASE WHEN provider = $1 AND provider_id = $2 THEN 0 ELSE 1 END
     LIMIT 1`,
    [user.provider, user.id, user.email]
  );

  if (findResult.rows.length > 0) {
    // Update name/image if changed
    const existing = findResult.rows[0];
    if (existing.name !== user.name || existing.image !== user.image) {
      await db.query(
        `UPDATE users SET name = $1, image = $2, updated_at = NOW() WHERE id = $3`,
        [user.name, user.image, existing.id]
      );
    }
    return existing;
  }

  // Insert new user
  const insertResult = await db.query(
    `INSERT INTO users (email, name, image, provider, provider_id, role)
     VALUES ($1, $2, $3, $4, $5, 'user')
     RETURNING *`,
    [user.email, user.name, user.image, user.provider, user.id]
  );

  return insertResult.rows[0];
}

module.exports = { authenticateNextAuth, allowNextAuthGuest };
