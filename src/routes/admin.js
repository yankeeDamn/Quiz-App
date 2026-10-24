'use strict';

const crypto = require('crypto');
const { Router } = require('express');
const { body, query } = require('express-validator');
const config = require('../config');
const logger = require('../utils/logger');
const { validate } = require('../middleware/validate');
const { authLimiter } = require('../middleware/rate-limiter');
const userService = require('../services/user.service');
const { PAID_PLANS, MAX_MONTHS, isPlanActive } = require('../services/plan.service');

const EMAIL_OPTS = { gmail_remove_dots: false, gmail_remove_subaddress: false, gmail_convert_googlemaildotcom: false };

const router = Router();

/** Constant-time comparison of the x-admin-key header with ADMIN_API_KEY. */
function requireAdminKey(req, res, next) {
  if (!config.adminKey) {
    return res.status(503).json({
      success: false,
      error: { message: 'Admin endpoints are disabled. Set ADMIN_API_KEY to enable them.' },
    });
  }
  const given = Buffer.from(String(req.headers['x-admin-key'] || ''));
  const wanted = Buffer.from(config.adminKey);
  const ok = given.length === wanted.length && crypto.timingSafeEqual(given, wanted);
  if (!ok) {
    logger.warn({ ip: req.ip }, 'Admin request with a wrong key');
    return res.status(401).json({ success: false, error: { message: 'Invalid admin key' } });
  }
  return next();
}

function present(user) {
  return {
    email: user.email,
    name: user.name,
    plan: user.plan || 'free',
    planActive: isPlanActive(user.plan, user.plan_expires_at),
    planExpiresAt: user.plan_expires_at,
  };
}

router.use(authLimiter, requireAdminKey);

/**
 * GET /api/v1/admin/user?email=... — check a user's plan.
 */
router.get(
  '/user',
  [query('email').isEmail().normalizeEmail(EMAIL_OPTS)],
  validate,
  async (req, res, next) => {
    try {
      const user = await userService.getByEmail(req.query.email);
      if (!user) return res.status(404).json({ success: false, error: { message: 'No user with this email' } });
      return res.json({ success: true, data: present(user) });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/admin/grant — unlock a plan after the WhatsApp payment arrives.
 * Body: { email, plan: "pro" | "institute", months, amountInr?, note? }
 * Works for people who have not signed in yet: their account is created and
 * the plan is waiting when they sign in with the same email.
 */
router.post(
  '/grant',
  [
    body('email').isEmail().normalizeEmail(EMAIL_OPTS),
    body('plan').isIn(PAID_PLANS),
    body('months').isInt({ min: 1, max: MAX_MONTHS }).toInt(),
    body('amountInr').optional().isInt({ min: 0 }).toInt(),
    body('note').optional().isString().isLength({ max: 255 }),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { email, plan, months, amountInr, note } = req.body;
      const user = await userService.grantPlan({ email, plan, months, amountInr, note });
      logger.info({ email, plan, months }, 'Plan granted');
      return res.json({ success: true, data: present(user) });
    } catch (err) {
      return next(err);
    }
  }
);

/**
 * POST /api/v1/admin/revoke — end a plan now (for example after a refund).
 */
router.post('/revoke', [body('email').isEmail().normalizeEmail(EMAIL_OPTS)], validate, async (req, res, next) => {
  try {
    const user = await userService.revokePlan(req.body.email);
    if (!user) return res.status(404).json({ success: false, error: { message: 'No user with this email' } });
    logger.info({ email: req.body.email }, 'Plan revoked');
    return res.json({ success: true, data: present(user) });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
