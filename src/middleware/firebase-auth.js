'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Firebase ID token verification.
 *
 * Firebase tokens are JWTs signed by Google. We verify them by:
 * 1. Fetching Google's public keys
 * 2. Verifying the token signature, issuer, audience, and expiry
 *
 * For serverless (Vercel), we cache the public keys in module scope
 * but re-fetch them when they expire (per Cache-Control header).
 */

let cachedKeys = null;
let keysCacheExpiry = 0;

const GOOGLE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

/**
 * Fetch Google's public keys for Firebase token verification.
 */
async function getGooglePublicKeys() {
  const now = Date.now();
  if (cachedKeys && now < keysCacheExpiry) {
    return cachedKeys;
  }

  const response = await fetch(GOOGLE_CERTS_URL, {
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Google public keys: ${response.status}`);
  }

  const keys = await response.json();

  // Parse cache-control header for max-age
  const cacheControl = response.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;

  cachedKeys = keys;
  keysCacheExpiry = now + maxAge * 1000;

  return keys;
}

/**
 * Verify a Firebase ID token.
 *
 * @param {string} idToken - The Firebase ID token to verify
 * @returns {Promise<Object>} The decoded token payload
 */
async function verifyFirebaseToken(idToken) {
  const projectId = config.firebase?.projectId;
  if (!projectId) {
    throw new Error('FIREBASE_PROJECT_ID not configured');
  }

  // Decode the header to get the kid
  const headerB64 = idToken.split('.')[0];
  const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());

  if (!header.kid) {
    throw new Error('Firebase token missing kid header');
  }

  // Fetch public keys
  const keys = await getGooglePublicKeys();
  const cert = keys[header.kid];

  if (!cert) {
    // Key might have rotated — force re-fetch
    keysCacheExpiry = 0;
    const freshKeys = await getGooglePublicKeys();
    const freshCert = freshKeys[header.kid];
    if (!freshCert) {
      throw new Error('Firebase token signed with unknown key');
    }
    return verifyWithCert(idToken, freshCert, projectId);
  }

  return verifyWithCert(idToken, cert, projectId);
}

function verifyWithCert(idToken, cert, projectId) {
  return jwt.verify(idToken, cert, {
    algorithms: ['RS256'],
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`,
  });
}

/**
 * Middleware: Verify Firebase ID token and issue/return custom JWT.
 *
 * Accepts either:
 * - Authorization: Bearer <firebase-id-token>  (verifies with Google, issues custom JWT)
 * - Authorization: Bearer <custom-jwt>          (verifies with our JWT secret)
 *
 * Sets req.user with the decoded user info.
 */
async function authenticateFirebase(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: { message: 'Authentication required' },
    });
  }

  // First, try verifying as our custom JWT (most common for subsequent requests)
  try {
    const secret = config.jwt.secret || 'dev-secret-do-not-use-in-production';
    const decoded = jwt.verify(token, secret);
    req.user = decoded;
    return next();
  } catch {
    // Not a custom JWT — try Firebase
  }

  // Try verifying as Firebase ID token
  if (config.firebase?.projectId) {
    try {
      const firebaseUser = await verifyFirebaseToken(token);
      req.user = {
        id: firebaseUser.sub || firebaseUser.user_id,
        email: firebaseUser.email || null,
        name: firebaseUser.name || '',
        picture: firebaseUser.picture || '',
        role: 'user',
        provider: 'firebase',
        firebaseUid: firebaseUser.sub || firebaseUser.user_id,
      };
      return next();
    } catch (err) {
      logger.warn({ error: err.message }, 'Firebase token verification failed');
    }
  }

  return res.status(401).json({
    success: false,
    error: { message: 'Invalid or expired token' },
  });
}

/**
 * Middleware: Allow both authenticated and guest users.
 */
async function allowFirebaseGuest(req, _res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (token) {
    // Try custom JWT
    try {
      const secret = config.jwt.secret || 'dev-secret-do-not-use-in-production';
      const decoded = jwt.verify(token, secret);
      req.user = decoded;
      req.isGuest = false;
      return next();
    } catch {
      // Not custom JWT
    }

    // Try Firebase
    if (config.firebase?.projectId) {
      try {
        const firebaseUser = await verifyFirebaseToken(token);
        req.user = {
          id: firebaseUser.sub || firebaseUser.user_id,
          email: firebaseUser.email || null,
          name: firebaseUser.name || '',
          role: 'user',
          provider: 'firebase',
        };
        req.isGuest = false;
        return next();
      } catch {
        // Fall through to guest
      }
    }
  }

  req.user = { id: 'guest', role: 'guest' };
  req.isGuest = true;
  next();
}

module.exports = {
  authenticateFirebase,
  allowFirebaseGuest,
  verifyFirebaseToken,
  getGooglePublicKeys,
};
