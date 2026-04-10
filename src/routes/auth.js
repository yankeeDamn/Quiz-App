'use strict';

const { Router } = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authLimiter } = require('../middleware/rate-limiter');
const { authenticateToken, allowGuest } = require('../middleware/auth');
const authController = require('../controllers/auth.controller');

const router = Router();

/**
 * POST /register
 */
router.post(
  '/register',
  authLimiter,
  [
    body('email')
      .isEmail()
      .withMessage('A valid email address is required')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters'),
  ],
  validate,
  authController.register
);

/**
 * POST /login
 */
router.post(
  '/login',
  authLimiter,
  [
    body('email')
      .isEmail()
      .withMessage('A valid email address is required')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('Password is required'),
  ],
  validate,
  authController.login
);

/**
 * POST /guest
 */
router.post('/guest', authLimiter, authController.guest);

/**
 * GET /me
 */
router.get('/me', allowGuest, authController.me);

module.exports = router;
