'use strict';

const starterBank = require('../data/mock-bank.json');

/**
 * Safely seed the existing ExamPro schema, without overwriting questions,
 * topics or tests edited by the owner. Running again repairs missing starter
 * rows (including interrupted first runs) and remains idempotent.
 */
async function seedStarterContent(client, bank = starterBank) {
  if (!Array.isArray(bank.topics) || !Array.isArray(bank.mocks)) {
    throw new Error('Invalid starter question bank');
  }

  const count = bank.topics.reduce((sum, topic) => sum + topic.questions.length, 0);
  if (count !== 120 || bank.topics.length !== 10) {
    throw new Error(`Expected 10 topics and 120 questions; found ${bank.topics.length} topics and ${count} questions`);
  }

  for (const topic of bank.topics) {
    await client.query(
      'INSERT INTO mock_topics (id, name, category) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
      [topic.id, topic.name, topic.category]
    );
    for (let position = 0; position < topic.questions.length; position++) {
      const question = topic.questions[position];
      if (!Array.isArray(question.options) || question.options.length !== 4 ||
          !Number.isInteger(question.answer) || question.answer < 0 || question.answer > 3) {
        throw new Error(`Malformed starter question: ${topic.id}:${position}`);
      }
      await client.query(
        `INSERT INTO mock_questions (topic_id, position, question, options, answer, explanation)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (topic_id, position) DO NOTHING`,
        [topic.id, position, question.q, JSON.stringify(question.options), question.answer, question.explanation]
      );
    }
  }

  for (const mock of bank.mocks) {
    await client.query(
      `INSERT INTO mock_tests (id, name, exam, minutes, marks_per_correct, negative_marks, level, tier, sections)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO NOTHING`,
      [mock.id, mock.name, mock.exam, mock.minutes, mock.marksPerCorrect,
        mock.negativeMarks, mock.level, mock.tier, JSON.stringify(mock.sections)]
    );
  }

  return { topics: bank.topics.length, questions: count, mocks: bank.mocks.length };
}

module.exports = { seedStarterContent };
