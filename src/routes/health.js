'use strict';

const { Router } = require('express');
const db = require('../config/database');

const router = Router();

/**
 * GET /api/v1/health
 *
 * Lightweight health-check endpoint for load balancers,
 * container orchestrators, and monitoring systems.
 */
router.get('/', async (_req, res) => {
  const dbHealthy = await db.isHealthy();

  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      database: dbHealthy ? 'connected' : 'unavailable',
    },
  });
});

/** Readiness is separate from liveness.
 * The API is not ready to serve authenticated exams if either the database
 * or the AUTH_SECRET shared with NextAuth is unavailable.
 */
router.get('/ready', async (_req, res) => {
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  const authenticationConfigured = Boolean(process.env.AUTH_SECRET);
  const connected = databaseConfigured && await db.isHealthy();
  const ready = connected && authenticationConfigured;

  res.set('Cache-Control', 'no-store');
  res.status(ready ? 200 : 503).json({
    success: ready,
    data: {
      status: ready ? 'ready' : 'not_ready',
      database: connected ? 'connected' : databaseConfigured ? 'unavailable' : 'not_configured',
      authentication: authenticationConfigured ? 'configured' : 'not_configured',
    },
  });
});

module.exports = router;
