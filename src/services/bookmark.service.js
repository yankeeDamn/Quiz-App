'use strict';

const db = require('../config/database');
const logger = require('../utils/logger');

/**
 * Bookmarks & Notes service.
 */
class BookmarkService {
  // ── Bookmarks ──────────────────────────────────

  async getBookmarks(userId) {
    const result = await db.query(
      `SELECT id, quiz_id AS "quizId", question_id AS "questionId", note, created_at AS "createdAt"
       FROM bookmarks
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  async addBookmark(userId, { quizId, questionId, note }) {
    const result = await db.query(
      `INSERT INTO bookmarks (user_id, quiz_id, question_id, note)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, quiz_id, question_id) DO UPDATE SET
         note = COALESCE(EXCLUDED.note, bookmarks.note)
       RETURNING id, quiz_id AS "quizId", question_id AS "questionId", note, created_at AS "createdAt"`,
      [userId, quizId, questionId, note || null]
    );
    return result.rows[0];
  }

  async removeBookmark(userId, quizId, questionId) {
    const result = await db.query(
      `DELETE FROM bookmarks
       WHERE user_id = $1 AND quiz_id = $2 AND question_id = $3
       RETURNING id`,
      [userId, quizId, questionId]
    );
    return result.rowCount > 0;
  }

  // ── Notes ──────────────────────────────────────

  async getNotes(userId) {
    const result = await db.query(
      `SELECT id, quiz_id AS "quizId", question_id AS "questionId", content, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM notes
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [userId]
    );
    return result.rows;
  }

  async saveNote(userId, { quizId, questionId, content }) {
    const result = await db.query(
      `INSERT INTO notes (user_id, quiz_id, question_id, content)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, quiz_id, question_id) DO UPDATE SET
         content = EXCLUDED.content,
         updated_at = NOW()
       RETURNING id, quiz_id AS "quizId", question_id AS "questionId", content, created_at AS "createdAt", updated_at AS "updatedAt"`,
      [userId, quizId, questionId, content]
    );
    return result.rows[0];
  }

  async deleteNote(userId, quizId, questionId) {
    const result = await db.query(
      `DELETE FROM notes
       WHERE user_id = $1 AND quiz_id = $2 AND question_id = $3
       RETURNING id`,
      [userId, quizId, questionId]
    );
    return result.rowCount > 0;
  }
}

module.exports = new BookmarkService();
