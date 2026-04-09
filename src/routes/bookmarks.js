'use strict';

const { Router } = require('express');
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticateNextAuth } = require('../middleware/nextauth');
const bookmarkController = require('../controllers/bookmark.controller');

const router = Router();

// ── Bookmarks ──────────────────────────────────

router.get('/bookmarks', authenticateNextAuth, bookmarkController.getBookmarks);

router.post(
  '/bookmarks',
  authenticateNextAuth,
  [
    body('quizId').isString().notEmpty().withMessage('quizId is required'),
    body('questionId').isString().notEmpty().withMessage('questionId is required'),
  ],
  validate,
  bookmarkController.addBookmark
);

router.delete(
  '/bookmarks/:quizId/:questionId',
  authenticateNextAuth,
  [
    param('quizId').isString().notEmpty(),
    param('questionId').isString().notEmpty(),
  ],
  validate,
  bookmarkController.removeBookmark
);

// ── Notes ──────────────────────────────────────

router.get('/notes', authenticateNextAuth, bookmarkController.getNotes);

router.post(
  '/notes',
  authenticateNextAuth,
  [
    body('quizId').isString().notEmpty().withMessage('quizId is required'),
    body('questionId').isString().notEmpty().withMessage('questionId is required'),
    body('content').isString().notEmpty().withMessage('content is required'),
  ],
  validate,
  bookmarkController.saveNote
);

router.delete(
  '/notes/:quizId/:questionId',
  authenticateNextAuth,
  [
    param('quizId').isString().notEmpty(),
    param('questionId').isString().notEmpty(),
  ],
  validate,
  bookmarkController.deleteNote
);

module.exports = router;
