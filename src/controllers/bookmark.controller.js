'use strict';

const bookmarkService = require('../services/bookmark.service');

// ── Bookmarks ──────────────────────────────────

async function getBookmarks(req, res, next) {
  try {
    const bookmarks = await bookmarkService.getBookmarks(req.user.id);
    res.json({ success: true, data: bookmarks });
  } catch (err) {
    next(err);
  }
}

async function addBookmark(req, res, next) {
  try {
    const { quizId, questionId, note } = req.body;
    const bookmark = await bookmarkService.addBookmark(req.user.id, {
      quizId,
      questionId,
      note,
    });
    res.status(201).json({ success: true, data: bookmark });
  } catch (err) {
    next(err);
  }
}

async function removeBookmark(req, res, next) {
  try {
    const { quizId, questionId } = req.params;
    const removed = await bookmarkService.removeBookmark(
      req.user.id,
      quizId,
      questionId
    );

    if (!removed) {
      return res.status(404).json({
        success: false,
        error: { message: 'Bookmark not found' },
      });
    }

    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
}

// ── Notes ──────────────────────────────────────

async function getNotes(req, res, next) {
  try {
    const notes = await bookmarkService.getNotes(req.user.id);
    res.json({ success: true, data: notes });
  } catch (err) {
    next(err);
  }
}

async function saveNote(req, res, next) {
  try {
    const { quizId, questionId, content } = req.body;
    const note = await bookmarkService.saveNote(req.user.id, {
      quizId,
      questionId,
      content,
    });
    res.status(201).json({ success: true, data: note });
  } catch (err) {
    next(err);
  }
}

async function deleteNote(req, res, next) {
  try {
    const { quizId, questionId } = req.params;
    const deleted = await bookmarkService.deleteNote(
      req.user.id,
      quizId,
      questionId
    );

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: { message: 'Note not found' },
      });
    }

    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getBookmarks,
  addBookmark,
  removeBookmark,
  getNotes,
  saveNote,
  deleteNote,
};
