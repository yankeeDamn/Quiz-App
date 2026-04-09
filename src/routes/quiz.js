'use strict';

const { Router } = require('express');
const { body, param, query } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticateNextAuth } = require('../middleware/nextauth');
const quizController = require('../controllers/quiz.controller');

const router = Router();

/**
 * POST /attempts — save a completed quiz attempt
 */
router.post(
  '/attempts',
  authenticateNextAuth,
  [
    body('quizId').isString().notEmpty().withMessage('quizId is required'),
    body('score').isInt({ min: 0 }).withMessage('score must be a non-negative integer'),
    body('totalQuestions').isInt({ min: 1 }).withMessage('totalQuestions must be >= 1'),
    body('percentage').isFloat({ min: 0, max: 100 }).withMessage('percentage must be 0-100'),
    body('passed').isBoolean().withMessage('passed must be boolean'),
  ],
  validate,
  quizController.submitAttempt
);

/**
 * GET /attempts — get user's quiz history
 */
router.get('/attempts', authenticateNextAuth, quizController.getAttempts);

/**
 * GET /attempts/:id — get a single attempt
 */
router.get(
  '/attempts/:id',
  authenticateNextAuth,
  [param('id').isUUID().withMessage('Invalid attempt ID')],
  validate,
  quizController.getAttemptById
);

/**
 * GET /stats — get dashboard statistics
 */
router.get('/stats', authenticateNextAuth, quizController.getStats);

/**
 * GET /scores — get best scores
 */
router.get('/scores', authenticateNextAuth, quizController.getScores);

module.exports = router;
