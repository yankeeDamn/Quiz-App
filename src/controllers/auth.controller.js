'use strict';

const authService = require('../services/auth.service');
const { verifyFirebaseToken } = require('../middleware/firebase-auth');
const logger = require('../utils/logger');

/**
 * POST /api/v1/auth/register
 */
async function register(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.register({ email, password });

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/login
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/firebase
 *
 * Exchange a Firebase ID token for a custom JWT.
 * This avoids repeated Firebase verification on every request.
 */
async function firebaseExchange(req, res, next) {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({
        success: false,
        error: { message: 'Firebase ID token is required' },
      });
    }

    const firebaseUser = await verifyFirebaseToken(idToken);

    // Issue custom JWT with Firebase user info
    const result = authService.issueTokenForFirebaseUser({
      uid: firebaseUser.sub || firebaseUser.user_id,
      email: firebaseUser.email || null,
      name: firebaseUser.name || '',
      picture: firebaseUser.picture || '',
    });

    logger.info({ uid: firebaseUser.sub }, 'Firebase token exchanged for custom JWT');

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    logger.warn({ error: err.message }, 'Firebase token exchange failed');
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid Firebase ID token' },
    });
  }
}

/**
 * POST /api/v1/auth/guest
 */
function guest(_req, res) {
  const result = authService.createGuestSession();

  res.json({
    success: true,
    data: result,
  });
}

/**
 * GET /api/v1/auth/me
 *
 * Returns the current authenticated user's profile.
 */
function me(req, res) {
  res.json({
    success: true,
    data: {
      user: req.user,
      isGuest: req.isGuest || false,
    },
  });
}

module.exports = { register, login, firebaseExchange, guest, me };
