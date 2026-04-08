'use strict';

const authService = require('../services/auth.service');

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

module.exports = { register, login, guest, me };
