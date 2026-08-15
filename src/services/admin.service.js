'use strict';

const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Admin service — platform management operations.
 *
 * All methods require the caller to already be authenticated as 'admin'
 * (enforced at the route layer by requireRole('admin')).
 */
class AdminService {
  // ── Users ─────────────────────────────────────────────

  /**
   * List all users with pagination.
   *
   * @param {{ limit?: number, offset?: number }} opts
   */
  async listUsers({ limit = 50, offset = 0 } = {}) {
    const result = await db.query(
      `SELECT id, email, name, image, role, payment_status, provider,
              created_at, updated_at
       FROM users
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await db.query('SELECT COUNT(*) FROM users');
    return {
      users: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Update a user's role.
   *
   * @param {string} userId
   * @param {string} role  'user' | 'paid' | 'admin'
   */
  async updateUserRole(userId, role) {
    const allowed = ['user', 'paid', 'admin', 'guest'];
    if (!allowed.includes(role)) {
      throw Object.assign(
        new Error(`Invalid role '${role}'. Allowed: ${allowed.join(', ')}`),
        { statusCode: 400 }
      );
    }

    const result = await db.query(
      `UPDATE users
       SET role = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, email, name, role, payment_status, updated_at`,
      [role, userId]
    );

    if (result.rowCount === 0) {
      throw Object.assign(new Error('User not found'), { statusCode: 404 });
    }

    logger.info({ userId, role }, 'Admin: user role updated');
    return result.rows[0];
  }

  // ── Payments ──────────────────────────────────────────

  /**
   * List all payments with user info.
   *
   * @param {{ limit?: number, offset?: number }} opts
   */
  async listPayments({ limit = 50, offset = 0 } = {}) {
    const result = await db.query(
      `SELECT p.id, p.stripe_payment_intent_id, p.amount_cents, p.currency,
              p.status, p.created_at, p.updated_at,
              u.email AS user_email, u.name AS user_name
       FROM payments p
       JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await db.query('SELECT COUNT(*) FROM payments');
    return {
      payments: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  // ── Platform stats ────────────────────────────────────

  /**
   * High-level platform statistics for the admin dashboard.
   */
  async getStats() {
    const [userCount, paidCount, attemptCount, revenueResult, recentUsers] =
      await Promise.all([
        db.query('SELECT COUNT(*) FROM users'),
        db.query(`SELECT COUNT(*) FROM users WHERE payment_status = 'paid'`),
        db.query('SELECT COUNT(*) FROM quiz_attempts'),
        db.query(
          `SELECT COALESCE(SUM(amount_cents), 0) AS total
           FROM payments
           WHERE status = 'succeeded'`
        ),
        db.query(
          `SELECT id, email, name, role, payment_status, created_at
           FROM users
           ORDER BY created_at DESC
           LIMIT 5`
        ),
      ]);

    return {
      totalUsers: parseInt(userCount.rows[0].count, 10),
      paidUsers: parseInt(paidCount.rows[0].count, 10),
      totalAttempts: parseInt(attemptCount.rows[0].count, 10),
      totalRevenueCents: parseInt(revenueResult.rows[0].total, 10),
      recentUsers: recentUsers.rows,
    };
  }

  // ── Questions ─────────────────────────────────────────

  /**
   * List questions with optional filtering.
   *
   * @param {{ limit?: number, offset?: number, quizId?: string, topic?: string }} opts
   */
  async listQuestions({ limit = 100, offset = 0, quizId, topic } = {}) {
    const params = [limit, offset];
    const conditions = [];

    if (quizId) {
      conditions.push(`quiz_id = $${params.push(quizId)}`);
    }
    if (topic) {
      conditions.push(`topic ILIKE $${params.push(`%${topic}%`)}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await db.query(
      `SELECT * FROM questions ${where}
       ORDER BY subject, topic, created_at
       LIMIT $1 OFFSET $2`,
      params
    );

    const countResult = await db.query(
      `SELECT COUNT(*) FROM questions ${where}`,
      params.slice(2)
    );

    return {
      questions: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Create a new question.
   */
  async createQuestion(data) {
    const result = await db.query(
      `INSERT INTO questions
         (quiz_id, subject, topic, difficulty, type, question_text,
          options, correct_answers, explanation, image_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        data.quizId,
        data.subject,
        data.topic,
        data.difficulty || 'Medium',
        data.type || 'single',
        data.questionText,
        JSON.stringify(data.options || []),
        JSON.stringify(data.correctAnswers || []),
        data.explanation || '',
        data.imageUrl || null,
      ]
    );

    logger.info({ questionId: result.rows[0].id }, 'Admin: question created');
    return result.rows[0];
  }

  /**
   * Update an existing question.
   */
  async updateQuestion(questionId, data) {
    const fields = [];
    const params = [];

    const map = {
      quizId: 'quiz_id',
      subject: 'subject',
      topic: 'topic',
      difficulty: 'difficulty',
      type: 'type',
      questionText: 'question_text',
      explanation: 'explanation',
      imageUrl: 'image_url',
    };

    for (const [key, col] of Object.entries(map)) {
      if (data[key] !== undefined) {
        fields.push(`${col} = $${params.push(data[key])}`);
      }
    }

    if (data.options !== undefined) {
      fields.push(`options = $${params.push(JSON.stringify(data.options))}`);
    }
    if (data.correctAnswers !== undefined) {
      fields.push(
        `correct_answers = $${params.push(JSON.stringify(data.correctAnswers))}`
      );
    }

    if (fields.length === 0) {
      throw Object.assign(new Error('No fields to update'), { statusCode: 400 });
    }

    fields.push(`updated_at = NOW()`);
    params.push(questionId);

    const result = await db.query(
      `UPDATE questions SET ${fields.join(', ')}
       WHERE id = $${params.length}
       RETURNING *`,
      params
    );

    if (result.rowCount === 0) {
      throw Object.assign(new Error('Question not found'), { statusCode: 404 });
    }

    logger.info({ questionId }, 'Admin: question updated');
    return result.rows[0];
  }

  /**
   * Delete a question by ID.
   */
  async deleteQuestion(questionId) {
    const result = await db.query(
      `DELETE FROM questions WHERE id = $1 RETURNING id`,
      [questionId]
    );

    if (result.rowCount === 0) {
      throw Object.assign(new Error('Question not found'), { statusCode: 404 });
    }

    logger.info({ questionId }, 'Admin: question deleted');
    return { deleted: true };
  }

  // ── Courses ───────────────────────────────────────────

  /**
   * List all exam providers / courses.
   */
  async listCourses() {
    const result = await db.query(
      `SELECT c.*,
              COUNT(q.id)::int AS question_count
       FROM courses c
       LEFT JOIN questions q ON q.quiz_id = c.id
       GROUP BY c.id
       ORDER BY c.name`
    );

    return result.rows;
  }

  /**
   * Create a new course (exam provider).
   */
  async createCourse(data) {
    const result = await db.query(
      `INSERT INTO courses (name, description, color, exam_code)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.name, data.description || '', data.color || '#6366F1', data.examCode || '']
    );

    logger.info({ courseId: result.rows[0].id }, 'Admin: course created');
    return result.rows[0];
  }
}

module.exports = new AdminService();
