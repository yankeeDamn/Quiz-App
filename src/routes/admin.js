'use strict';

const { Router } = require('express');
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticateNextAuth } = require('../middleware/nextauth');
const { requireRole } = require('../middleware/auth');
const adminController = require('../controllers/admin.controller');

const router = Router();

// Every admin route requires authentication + admin role
router.use(authenticateNextAuth, requireRole('admin'));

// ── Users ────────────────────────────────────────────────

/** GET /api/v1/admin/users */
router.get('/users', adminController.listUsers);

/** PATCH /api/v1/admin/users/:id/role */
router.patch(
  '/users/:id/role',
  [
    param('id').isUUID().withMessage('Invalid user ID'),
    body('role').isIn(['user', 'paid', 'admin']).withMessage('role must be user | paid | admin'),
  ],
  validate,
  adminController.updateUserRole
);

// ── Payments ─────────────────────────────────────────────

/** GET /api/v1/admin/payments */
router.get('/payments', adminController.listPayments);

// ── Stats ────────────────────────────────────────────────

/** GET /api/v1/admin/stats */
router.get('/stats', adminController.getStats);

// ── Questions ────────────────────────────────────────────

/** GET /api/v1/admin/questions */
router.get('/questions', adminController.listQuestions);

/** POST /api/v1/admin/questions */
router.post(
  '/questions',
  [
    body('quizId').isString().notEmpty().withMessage('quizId is required'),
    body('subject').isString().notEmpty().withMessage('subject is required'),
    body('topic').isString().notEmpty().withMessage('topic is required'),
    body('questionText').isString().notEmpty().withMessage('questionText is required'),
    body('options').isArray({ min: 2 }).withMessage('options must be an array with at least 2 items'),
    body('correctAnswers').isArray({ min: 1 }).withMessage('correctAnswers must be a non-empty array'),
    body('difficulty').optional().isIn(['Easy', 'Medium', 'Hard']),
    body('type').optional().isIn(['single', 'multiple', 'true-false']),
  ],
  validate,
  adminController.createQuestion
);

/** PUT /api/v1/admin/questions/:id */
router.put(
  '/questions/:id',
  [
    param('id').isUUID().withMessage('Invalid question ID'),
    body('options').optional().isArray({ min: 2 }),
    body('correctAnswers').optional().isArray({ min: 1 }),
    body('difficulty').optional().isIn(['Easy', 'Medium', 'Hard']),
    body('type').optional().isIn(['single', 'multiple', 'true-false']),
  ],
  validate,
  adminController.updateQuestion
);

/** DELETE /api/v1/admin/questions/:id */
router.delete(
  '/questions/:id',
  [param('id').isUUID().withMessage('Invalid question ID')],
  validate,
  adminController.deleteQuestion
);

// ── Courses ──────────────────────────────────────────────

/** GET /api/v1/admin/courses */
router.get('/courses', adminController.listCourses);

/** POST /api/v1/admin/courses */
router.post(
  '/courses',
  [
    body('name').isString().notEmpty().withMessage('name is required'),
    body('color').optional().isHexColor().withMessage('color must be a valid hex colour'),
  ],
  validate,
  adminController.createCourse
);

module.exports = router;
