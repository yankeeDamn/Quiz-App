'use strict';

const { Router } = require('express');

const router = Router();

/**
 * GET /api/v1/health
 *
 * Lightweight health-check endpoint for load balancers,
 * container orchestrators, and monitoring systems.
 */
router.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
    },
  });
});

module.exports = router;
