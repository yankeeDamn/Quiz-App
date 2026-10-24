'use strict';

const { Router } = require('express');
const healthRoutes = require('./health');
const paymentRoutes = require('./payment');
const authRoutes = require('./auth');
const quizRoutes = require('./quiz');
const bookmarkRoutes = require('./bookmarks');
const userRoutes = require('./user');
const catalogRoutes = require('./catalog');
const brandingRoutes = require('./branding');

const router = Router();

// ── API v1 routes ──────────────────────────────────────
router.use('/health', healthRoutes);
router.use('/catalog', catalogRoutes);
router.use('/branding', brandingRoutes);
router.use('/payments', paymentRoutes);
router.use('/auth', authRoutes);
router.use('/quiz', quizRoutes);
router.use('/user', userRoutes);

// Bookmarks & Notes share the /user namespace
router.use('/user', bookmarkRoutes);

module.exports = router;
