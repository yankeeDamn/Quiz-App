'use strict';

const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Quiz attempt service — persists quiz results and computes stats.
 */
class QuizService {
  /**
   * Save a completed quiz attempt.
   */
  async saveAttempt(userId, attempt) {
    const result = await db.query(
      `INSERT INTO quiz_attempts
         (user_id, quiz_id, quiz_title, score, total, percentage, passed,
          time_spent_s, answers, topic_performance, difficulty_performance,
          started_at, completed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        userId,
        attempt.quizId,
        attempt.quizTitle || '',
        attempt.score,
        attempt.totalQuestions,
        attempt.percentage,
        attempt.passed,
        attempt.timeTaken || null,
        JSON.stringify(attempt.answers || {}),
        JSON.stringify(attempt.topicPerformance || []),
        JSON.stringify(attempt.difficultyPerformance || []),
        attempt.startedAt
          ? new Date(attempt.startedAt)
          : new Date(Date.now() - (attempt.timeTaken || 0) * 1000),
        new Date(attempt.completedAt || Date.now()),
      ]
    );

    // Update scores table (best score per quiz)
    await this._upsertScore(userId, attempt);

    // Update user_stats
    await this._updateStats(userId, attempt);

    logger.info({ userId, quizId: attempt.quizId }, 'Quiz attempt saved');
    return result.rows[0];
  }

  /**
   * Get quiz attempts for a user, ordered newest first.
   */
  async getAttempts(userId, { limit = 50, offset = 0 } = {}) {
    const result = await db.query(
      `SELECT * FROM quiz_attempts
       WHERE user_id = $1
       ORDER BY completed_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows;
  }

  /**
   * Get a single attempt by ID.
   */
  async getAttemptById(attemptId, userId) {
    const result = await db.query(
      `SELECT * FROM quiz_attempts WHERE id = $1 AND user_id = $2`,
      [attemptId, userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get dashboard stats for a user.
   */
  async getStats(userId) {
    const statsResult = await db.query(
      `SELECT * FROM user_stats WHERE user_id = $1`,
      [userId]
    );

    if (statsResult.rows.length === 0) {
      return {
        totalAttempts: 0,
        averageScore: 0,
        strongestTopic: null,
        weakestTopic: null,
        streak: 0,
        lastAttemptDate: null,
        topicStats: {},
        recentQuizzes: [],
      };
    }

    const stats = statsResult.rows[0];

    // Get recent quizzes
    const recentResult = await db.query(
      `SELECT quiz_id, quiz_title, score, total, percentage, passed, time_spent_s, completed_at
       FROM quiz_attempts
       WHERE user_id = $1
       ORDER BY completed_at DESC
       LIMIT 10`,
      [userId]
    );

    return {
      totalAttempts: stats.total_attempts,
      averageScore: parseFloat(stats.average_score),
      strongestTopic: stats.strongest_topic,
      weakestTopic: stats.weakest_topic,
      streak: stats.streak,
      lastAttemptDate: stats.last_attempt_date,
      topicStats: stats.topic_stats || {},
      recentQuizzes: recentResult.rows.map((r) => ({
        quizId: r.quiz_id,
        quizTitle: r.quiz_title,
        score: r.score,
        totalQuestions: r.total,
        percentage: parseFloat(r.percentage),
        passed: r.passed,
        timeTaken: r.time_spent_s,
        completedAt: r.completed_at,
      })),
    };
  }

  /**
   * Get best scores for a user across quizzes.
   */
  async getScores(userId) {
    const result = await db.query(
      `SELECT * FROM scores WHERE user_id = $1 ORDER BY last_attempt DESC`,
      [userId]
    );
    return result.rows;
  }

  // ── Private helpers ────────────────────────────────

  async _upsertScore(userId, attempt) {
    try {
      await db.query(
        `INSERT INTO scores (user_id, quiz_id, best_score, best_pct, attempts, last_attempt)
         VALUES ($1, $2, $3, $4, 1, NOW())
         ON CONFLICT (user_id, quiz_id) DO UPDATE SET
           best_score  = GREATEST(scores.best_score, EXCLUDED.best_score),
           best_pct    = GREATEST(scores.best_pct, EXCLUDED.best_pct),
           attempts    = scores.attempts + 1,
           last_attempt = NOW()`,
        [userId, attempt.quizId, attempt.score, attempt.percentage]
      );
    } catch (err) {
      logger.warn({ err }, 'Failed to upsert score');
    }
  }

  async _updateStats(userId, attempt) {
    try {
      // Calculate new topic stats by merging
      const topicPerformance = attempt.topicPerformance || [];
      const topicStatsUpdate = {};
      for (const tp of topicPerformance) {
        topicStatsUpdate[tp.topic] = { correct: tp.correct, total: tp.total };
      }

      // Upsert user_stats
      await db.query(
        `INSERT INTO user_stats (user_id, total_attempts, average_score, streak, last_attempt_date, topic_stats, updated_at)
         VALUES ($1, 1, $2, 1, CURRENT_DATE, $3, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           total_attempts = user_stats.total_attempts + 1,
           average_score = (user_stats.average_score * user_stats.total_attempts + $2) / (user_stats.total_attempts + 1),
           streak = CASE
             WHEN user_stats.last_attempt_date = CURRENT_DATE THEN user_stats.streak
             WHEN user_stats.last_attempt_date = CURRENT_DATE - INTERVAL '1 day' THEN user_stats.streak + 1
             ELSE 1
           END,
           last_attempt_date = CURRENT_DATE,
           topic_stats = user_stats.topic_stats || $3,
           updated_at = NOW()`,
        [userId, attempt.percentage, JSON.stringify(topicStatsUpdate)]
      );

      // Recalculate strongest/weakest topics
      const statsResult = await db.query(
        `SELECT topic_stats FROM user_stats WHERE user_id = $1`,
        [userId]
      );

      if (statsResult.rows.length > 0) {
        const topicStats = statsResult.rows[0].topic_stats || {};
        let strongest = null;
        let weakest = null;
        let strongestPct = -1;
        let weakestPct = 101;

        for (const [topic, data] of Object.entries(topicStats)) {
          const pct = data.total > 0 ? (data.correct / data.total) * 100 : 0;
          if (pct > strongestPct) {
            strongestPct = pct;
            strongest = topic;
          }
          if (pct < weakestPct) {
            weakestPct = pct;
            weakest = topic;
          }
        }

        await db.query(
          `UPDATE user_stats SET strongest_topic = $1, weakest_topic = $2 WHERE user_id = $3`,
          [strongest, weakest, userId]
        );
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to update user stats');
    }
  }
}

module.exports = new QuizService();
