'use strict';

const adminService = require('../services/admin.service');

// ── Users ────────────────────────────────────────────────

/**
 * GET /api/v1/admin/users
 */
async function listUsers(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    const data = await adminService.listUsers({ limit, offset });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/admin/users/:id/role
 */
async function updateUserRole(req, res, next) {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const updated = await adminService.updateUserRole(id, role);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

// ── Payments ─────────────────────────────────────────────

/**
 * GET /api/v1/admin/payments
 */
async function listPayments(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    const data = await adminService.listPayments({ limit, offset });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ── Stats ────────────────────────────────────────────────

/**
 * GET /api/v1/admin/stats
 */
async function getStats(req, res, next) {
  try {
    const data = await adminService.getStats();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ── Questions ────────────────────────────────────────────

/**
 * GET /api/v1/admin/questions
 */
async function listQuestions(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 200);
    const offset = parseInt(req.query.offset, 10) || 0;
    const { quizId, topic } = req.query;

    const data = await adminService.listQuestions({ limit, offset, quizId, topic });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/questions
 */
async function createQuestion(req, res, next) {
  try {
    const question = await adminService.createQuestion(req.body);
    res.status(201).json({ success: true, data: question });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/admin/questions/:id
 */
async function updateQuestion(req, res, next) {
  try {
    const question = await adminService.updateQuestion(req.params.id, req.body);
    res.json({ success: true, data: question });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/admin/questions/:id
 */
async function deleteQuestion(req, res, next) {
  try {
    const result = await adminService.deleteQuestion(req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ── Courses ──────────────────────────────────────────────

/**
 * GET /api/v1/admin/courses
 */
async function listCourses(req, res, next) {
  try {
    const courses = await adminService.listCourses();
    res.json({ success: true, data: courses });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/admin/courses
 */
async function createCourse(req, res, next) {
  try {
    const course = await adminService.createCourse(req.body);
    res.status(201).json({ success: true, data: course });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listUsers,
  updateUserRole,
  listPayments,
  getStats,
  listQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  listCourses,
  createCourse,
};
