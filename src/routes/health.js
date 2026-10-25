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

/** Readiness is separate from liveness: do not route traffic to an API without its database. */
router.get('/ready', async (_req, res) => {
  const connected = await db.isHealthy();
  res.status(connected ? 200 : 503).json({
    success: connected,
    data: { status: connected ? 'ready' : 'not_ready', database: connected ? 'connected' : 'unavailable' },
  });
});

router.get('/ready', async (_req,res) => {
  const authConfigured = Boolean(process.env.AUTH_SECRET);
  const dbConfigured = Boolean(process.env.DATABASE_URL);
  const dbReady = dbConfigured && await db.isHealthy();
  const ready = authConfigured && dbReady;
  return res.status(ready?200:503).json({success:ready,data:{api:'available',database:dbReady?'connected':dbConfigured?'unavailable':'not_configured',authentication:authConfigured?'configured':'not_configured'}});
});
module.exports = router;
