'use strict';

const { Router } = require('express');
const healthRoutes = require('./health');
const paymentRoutes = require('./payment');
const authRoutes = require('./auth');
const quizRoutes = require('./quiz');
const bookmarkRoutes = require('./bookmarks');
const userRoutes = require('./user');
const adminRoutes = require('./admin');

const router = Router();

// ── API v1 routes ──────────────────────────────────────
router.use('/health', healthRoutes);
router.use('/payments', paymentRoutes);
router.use('/auth', authRoutes);
router.use('/quiz', quizRoutes);
router.use('/user', userRoutes);
router.use('/admin', adminRoutes);

// Bookmarks & Notes share the /user namespace
router.use('/user', bookmarkRoutes);

module.exports = router;
