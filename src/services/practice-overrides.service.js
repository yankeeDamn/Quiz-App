'use strict';

const db = require('../config/database');

const VALID_SOURCE = new Set(['homepage', 'certification']);
const ID = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,100}$/;
const DIFFICULTIES = new Set(['Easy', 'Medium', 'Hard']);
const TYPES = new Set(['single', 'multiple', 'true-false']);

function nonEmpty(value, min = 1, max = 600) {
  return typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
}

function validatePracticeOverride(source, id, question) {
  if (!VALID_SOURCE.has(source) || !ID.test(id)) throw new Error('Unknown practice source or question ID');
  if (!question || typeof question !== 'object' || Array.isArray(question) || question.id !== id) {
    throw new Error('Question ID must match the selected question');
  }
  if (!nonEmpty(question.question, 5) || !nonEmpty(question.explanation, 3, 1000)) {
    throw new Error('Provide a question (5–600 characters) and explanation (3–1000 characters)');
  }
  if (source === 'certification') {
    if (!nonEmpty(question.exam_code, 2, 50) || !nonEmpty(question.subject, 2, 100) ||
        !Array.isArray(question.options) || question.options.length !== 4 ||
        question.options.some((v) => !nonEmpty(v, 1, 200)) ||
        new Set(question.options.map(v => v.trim().toLowerCase())).size !== 4 ||
        !['A','B','C','D'].includes(question.correct_option)) {
      throw new Error('Certification questions need an exam code, subject, four distinct options and an A–D answer');
    }
    return {
      id, exam_code: question.exam_code.trim(), subject: question.subject.trim(),
      question: question.question.trim(), options: question.options.map(x => x.trim()),
      correct_option: question.correct_option, explanation: question.explanation.trim(),
      review_status: question.review_status === 'reviewed' ? 'reviewed' : 'needs_review',
    };
  }
  if (!nonEmpty(question.subject, 2, 100) || !nonEmpty(question.topic, 2, 100) ||
      !DIFFICULTIES.has(question.difficulty) || !TYPES.has(question.type) ||
      !Array.isArray(question.options) ||
      question.options.length !== (question.type === 'true-false' ? 2 : 4)) {
    throw new Error('Homepage question must include subject, topic, difficulty, type and the right number of options');
  }
  const options = question.options.map(x => ({id:x && x.id, text:x && x.text}));
  if (options.some(o => !ID.test(String(o.id || '')) || !nonEmpty(o.text, 1, 200)) ||
      new Set(options.map(o => o.id)).size !== options.length ||
      new Set(options.map(o => o.text.trim().toLowerCase())).size !== options.length) {
    throw new Error('Options must have unique valid IDs and different text');
  }
  if (!Array.isArray(question.correctAnswers) ||
      !question.correctAnswers.length ||
      new Set(question.correctAnswers).size !== question.correctAnswers.length ||
      (question.type !== 'multiple' && question.correctAnswers.length !== 1) ||
      question.correctAnswers.some(answer => !options.some(o => o.id === answer))) {
    throw new Error('Correct answers must match the available options');
  }
  return {
    id, subject: question.subject.trim(), topic: question.topic.trim(),
    difficulty: question.difficulty, type: question.type,
    question: question.question.trim(), options,
    correctAnswers: question.correctAnswers, explanation: question.explanation.trim(),
  };
}

async function listOverrides() {
  const { rows } = await db.query(
    'SELECT source, question_id AS id, content AS question, updated_at AS "updatedAt" FROM practice_question_overrides ORDER BY source, question_id'
  );
  return rows;
}

async function saveOverride(source, id, question) {
  const checked = validatePracticeOverride(source, id, question);
  await db.query(
    `INSERT INTO practice_question_overrides (source, question_id, content)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (source, question_id) DO UPDATE SET
       content = EXCLUDED.content, updated_at = NOW()`,
    [source, id, JSON.stringify(checked)]
  );
  return checked;
}

module.exports = { validatePracticeOverride, listOverrides, saveOverride };
