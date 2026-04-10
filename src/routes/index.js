'use strict';

const { Router } = require('express');
const healthRoutes = require('./health');
const paymentRoutes = require('./payment');
const authRoutes = require('./auth');
const bookmarkRoutes = require('./bookmarks');
const userRoutes = require('./user');
const newsRoutes = require('./news');
const sokalBelaRoutes = require('./sokal-bela');

const router = Router();

// ── API v1 routes ──────────────────────────────────────
router.use('/health', healthRoutes);
router.use('/payments', paymentRoutes);
router.use('/auth', authRoutes);
router.use('/user', userRoutes);
router.use('/news', newsRoutes);
router.use('/sokal-bela', sokalBelaRoutes);

// Bookmarks & Notes share the /user namespace
router.use('/user', bookmarkRoutes);

module.exports = router;
