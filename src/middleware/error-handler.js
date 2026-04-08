'use strict';

const logger = require('../utils/logger');

/**
 * Centralised Express error-handling middleware.
 *
 * - Logs the full error server-side.
 * - Returns a safe JSON payload to the client (no stack traces in production).
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  logger.error({ err, statusCode }, err.message);

  res.status(statusCode).json({
    success: false,
    error: {
      message: isProduction && statusCode === 500
        ? 'Internal server error'
        : err.message,
      ...(! isProduction && { stack: err.stack }),
    },
  });
}

/**
 * Catch-all for undefined routes.
 */
function notFound(_req, res) {
  res.status(404).json({
    success: false,
    error: { message: 'Resource not found' },
  });
}

module.exports = { errorHandler, notFound };
