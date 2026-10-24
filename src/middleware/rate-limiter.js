'use strict';

const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

/**
 * General API rate limiter — 100 requests per 15-minute window.
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  // Admin has its own limiter below; editing many questions would hit this one.
  skip: (req) => req.originalUrl.startsWith('/api/v1/admin'),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    logger.warn('General rate limit exceeded');
    res.status(429).json({
      success: false,
      error: { message: 'Too many requests. Please try again later.' },
    });
  },
});

/**
 * Auth rate limiter — 20 requests per 15-minute window.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    logger.warn('Auth rate limit exceeded');
    res.status(429).json({
      success: false,
      error: { message: 'Too many authentication attempts. Please wait before trying again.' },
    });
  },
});

/**
 * Admin limiter. Only failed requests (wrong key, not an admin, bad input) are
 * counted, so normal use of the admin page never hits it but guessing does.
 */
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    logger.warn('Admin rate limit exceeded');
    res.status(429).json({
      success: false,
      error: { message: 'Too many failed admin requests. Please wait 15 minutes.' },
    });
  },
});

module.exports = { generalLimiter, authLimiter, adminLimiter };
