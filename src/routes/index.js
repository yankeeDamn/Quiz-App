'use strict';

const { Router } = require('express');
const healthRoutes = require('./health');
const authRoutes = require('./auth');
const quizRoutes = require('./quiz');
const bookmarkRoutes = require('./bookmarks');
const userRoutes = require('./user');
const mocksRoutes = require('./mocks');
const adminRoutes = require('./admin');
const betaRoutes = require('./beta');
const examAttemptRoutes = require('./exam-attempts');
const practiceRoutes = require('./practice');
const { router: examproFeatures } = require('./exampro-features');

const router = Router();

// ── API v1 routes ──────────────────────────────────────
router.use('/health', healthRoutes);
router.use('/mocks', mocksRoutes);
router.use('/exampro', examproFeatures);
router.use('/practice', practiceRoutes);
router.use('/exam-attempts', examAttemptRoutes);
router.use('/admin', adminRoutes);
router.use('/beta', betaRoutes);
router.use('/auth', authRoutes);
router.use('/quiz', quizRoutes);
router.use('/user', userRoutes);

// Bookmarks & Notes share the /user namespace
router.use('/user', bookmarkRoutes);

module.exports = router;
