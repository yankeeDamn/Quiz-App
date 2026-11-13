'use strict';

const { Router } = require('express');
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticateNextAuth } = require('../middleware/nextauth');
const bookmarkController = require('../controllers/bookmark.controller');

const router = Router();
router.use((_req,res,next)=>{res.set('Cache-Control','private, no-store');next();});

// ── Bookmarks ──────────────────────────────────

router.get('/bookmarks', authenticateNextAuth, bookmarkController.getBookmarks);

router.post(
  '/bookmarks',
  authenticateNextAuth,
  [
    body('quizId').isString().isLength({min:1,max:100}).withMessage('quizId must contain 1–100 characters'),
    body('questionId').isString().isLength({min:1,max:100}).withMessage('questionId must contain 1–100 characters'),
    body('note').optional({nullable:true}).isString().isLength({max:5000}),
  ],
  validate,
  bookmarkController.addBookmark
);

router.delete(
  '/bookmarks/:quizId/:questionId',
  authenticateNextAuth,
  [
    param('quizId').isString().isLength({min:1,max:100}),
    param('questionId').isString().isLength({min:1,max:100}),
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
    body('quizId').isString().isLength({min:1,max:100}).withMessage('quizId must contain 1–100 characters'),
    body('questionId').isString().isLength({min:1,max:100}).withMessage('questionId must contain 1–100 characters'),
    body('content').isString().isLength({min:1,max:10000}).withMessage('content must contain 1–10000 characters'),
  ],
  validate,
  bookmarkController.saveNote
);

router.delete(
  '/notes/:quizId/:questionId',
  authenticateNextAuth,
  [
    param('quizId').isString().isLength({min:1,max:100}),
    param('questionId').isString().isLength({min:1,max:100}),
  ],
  validate,
  bookmarkController.deleteNote
);

module.exports = router;
