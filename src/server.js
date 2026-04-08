'use strict';

const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');

// ──────────────────────────────────────────────────────────
// Start server
// ──────────────────────────────────────────────────────────
const server = app.listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      env: config.env,
      stripeMode: config.stripe.secretKey?.startsWith('sk_live') ? 'LIVE' : 'TEST',
    },
    `🚀 Exam Practice Pro API running on port ${config.port}`
  );
});

// ──────────────────────────────────────────────────────────
// Graceful shutdown
// ──────────────────────────────────────────────────────────
function gracefulShutdown(signal) {
  logger.info({ signal }, 'Received shutdown signal — closing server…');
  server.close(() => {
    logger.info('HTTP server closed');
    // Close database connections, flush logs, etc.
    process.exit(0);
  });

  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ──────────────────────────────────────────────────────────
// Unhandled rejection / exception safety nets
// ──────────────────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — shutting down');
  gracefulShutdown('uncaughtException');
});
