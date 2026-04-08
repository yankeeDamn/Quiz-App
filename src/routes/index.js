'use strict';

const { Router } = require('express');
const healthRoutes = require('./health');
const paymentRoutes = require('./payment');
const authRoutes = require('./auth');

const router = Router();

// ── API v1 routes ──────────────────────────────────────
router.use('/health', healthRoutes);
router.use('/payments', paymentRoutes);
router.use('/auth', authRoutes);

module.exports = router;
