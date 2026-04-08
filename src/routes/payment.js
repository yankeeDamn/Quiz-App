'use strict';

const { Router } = require('express');
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const { paymentLimiter } = require('../middleware/rate-limiter');
const { allowGuest } = require('../middleware/auth');
const paymentController = require('../controllers/payment.controller');

const router = Router();

/**
 * GET /config
 * Returns the Stripe publishable key for frontend init.
 */
router.get('/config', paymentController.getStripeConfig);

/**
 * POST /create-payment-intent
 * Creates a PaymentIntent (server-authoritative amount).
 */
router.post(
  '/create-payment-intent',
  paymentLimiter,
  allowGuest,
  [
    body('email')
      .optional()
      .isEmail()
      .withMessage('A valid email address is required')
      .normalizeEmail(),
  ],
  validate,
  paymentController.createPaymentIntent
);

/**
 * GET /status/:paymentIntentId
 * Retrieve PaymentIntent status.
 */
router.get(
  '/status/:paymentIntentId',
  [
    param('paymentIntentId')
      .isString()
      .matches(/^pi_/)
      .withMessage('Invalid PaymentIntent ID format'),
  ],
  validate,
  paymentController.getPaymentStatus
);

// Note: The webhook route is registered separately in app.js
// because it needs the raw body (not JSON-parsed).

module.exports = router;
