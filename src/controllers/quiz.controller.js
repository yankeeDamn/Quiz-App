'use strict';

const quizService = require('../services/quiz.service');

/**
 * POST /api/v1/quiz/attempts — save a completed quiz attempt
 */
async function submitAttempt(req, res, next) {
  try {
    const userId = req.user.id;
    const attempt = req.body;

    const saved = await quizService.saveAttempt(userId, attempt);

    res.status(201).json({
      success: true,
      data: saved,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/quiz/attempts — get user's quiz history
 */
async function getAttempts(req, res, next) {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    const attempts = await quizService.getAttempts(userId, { limit, offset });

    res.json({
      success: true,
      data: attempts,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/quiz/attempts/:id — get single attempt
 */
async function getAttemptById(req, res, next) {
  try {
    const userId = req.user.id;
    const attempt = await quizService.getAttemptById(req.params.id, userId);

    if (!attempt) {
      return res.status(404).json({
        success: false,
        error: { message: 'Attempt not found' },
      });
    }

    res.json({
      success: true,
      data: attempt,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/quiz/stats — get dashboard statistics
 */
async function getStats(req, res, next) {
  try {
    const userId = req.user.id;
    const stats = await quizService.getStats(userId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/quiz/scores — get best scores
 */
async function getScores(req, res, next) {
  try {
    const userId = req.user.id;
    const scores = await quizService.getScores(userId);

    res.json({
      success: true,
      data: scores,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { submitAttempt, getAttempts, getAttemptById, getStats, getScores };
