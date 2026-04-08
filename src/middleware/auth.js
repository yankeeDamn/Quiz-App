'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Express middleware that verifies a JWT bearer token.
 *
 * Populates `req.user` with the decoded payload on success.
 * Returns 401 for missing/invalid tokens.
 */
function authenticateToken(req, res, next) {
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

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn({ err }, 'Invalid or expired token');
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid or expired token' },
    });
  }
}

/**
 * Middleware that allows both authenticated and guest users through,
 * but marks the request accordingly.
 *
 * - If a valid JWT is present → `req.user` is populated, `req.isGuest = false`.
 * - If no JWT is present      → `req.user = { id: 'guest', role: 'guest' }`, `req.isGuest = true`.
 */
function allowGuest(req, _res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      req.user = decoded;
      req.isGuest = false;
      return next();
    } catch {
      // Token invalid — fall through to guest
    }
  }

  req.user = { id: 'guest', role: 'guest' };
  req.isGuest = true;
  next();
}

/**
 * Role-based access control middleware factory.
 *
 * Usage: `router.get('/admin', authenticateToken, requireRole('admin'), handler)`
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: { message: 'Insufficient permissions' },
      });
    }
    next();
  };
}

module.exports = { authenticateToken, allowGuest, requireRole };
