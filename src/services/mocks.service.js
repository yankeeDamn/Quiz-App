'use strict';

const config = require('../config');
const db = require('../config/database');
const jsonBank = require('../data/mock-bank.json');

/**
 * Mock-test content.
 *
 * With a database the content comes from mock_topics / mock_questions /
 * mock_tests (edited on /admin). Without one it falls back to the starter
 * content in src/data/mock-bank.json, so local work still runs.
 *
 * A bank looks like:
 *   topics: [{ id, name, category, questions: [{ position, q, options, answer, explanation }] }]
 *   mocks:  [{ id, name, exam, minutes, marksPerCorrect, negativeMarks, level, tier, active, sections }]
 * Only active topics, questions and tests are included unless asked for.
 */

function fromJson() {
  return {
    topics: jsonBank.topics.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      questions: t.questions.map((q, position) => ({ position, ...q })),
    })),
    mocks: jsonBank.mocks.map((m) => ({ ...m, active: true })),
  };
}

async function fromDatabase() {
  const [topics, questions, mocks] = await Promise.all([
    db.query('SELECT id, name, category FROM mock_topics WHERE active ORDER BY created_at, id'),
    db.query(
      `SELECT topic_id, position, question, options, answer, explanation
         FROM mock_questions WHERE active ORDER BY topic_id, position`
    ),
    db.query(
      `SELECT id, name, exam, minutes, marks_per_correct, negative_marks, level, tier, sections
         FROM mock_tests WHERE active ORDER BY created_at, id`
    ),
  ]);
  const byTopic = new Map(topics.rows.map((t) => [t.id, { ...t, questions: [] }]));
  questions.rows.forEach((r) => {
    const t = byTopic.get(r.topic_id);
    if (t) t.questions.push({ position: r.position, q: r.question, options: r.options, answer: r.answer, explanation: r.explanation });
  });
  return {
    topics: Array.from(byTopic.values()),
    mocks: mocks.rows.map((m) => ({
      id: m.id,
      name: m.name,
      exam: m.exam,
      minutes: m.minutes,
      marksPerCorrect: Number(m.marks_per_correct),
      negativeMarks: Number(m.negative_marks),
      level: m.level,
      tier: m.tier,
      active: true,
      sections: m.sections,
    })),
  };
}

// Short cache so the public site does not query the database on every request.
const TTL_MS = 30 * 1000;
let cache = null;

function invalidate() {
  cache = null;
}

async function loadBank() {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.bank;
  const bank = config.databaseUrl ? await fromDatabase() : fromJson();
  cache = { bank, at: Date.now() };
  return bank;
}

// ── Pure helpers (take a bank) ─────────────────────────

function topicDefinitions(bank) {
  return bank.topics
    .filter((t) => t.questions.length > 0)
    .map((t) => ({
      id: `topic-${t.id}`,
      name: `${t.name} Test`,
      exam: t.category,
      kind: 'topic',
      minutes: 12,
      marksPerCorrect: 1,
      negativeMarks: 0.25,
      level: 'Practice',
      tier: 'free',
      sections: [{ name: t.name, parts: [{ topic: t.id, from: 0, to: Number.MAX_SAFE_INTEGER }] }],
    }));
}

function allDefinitions(bank) {
  return [...bank.mocks.map((m) => ({ ...m, kind: 'mock' })), ...topicDefinitions(bank)];
}

function partQuestions(bank, part) {
  const topic = bank.topics.find((t) => t.id === part.topic);
  if (!topic) return [];
  return topic.questions
    .filter((q) => q.position >= part.from && q.position < part.to)
    .map((q) => ({ topic, q }));
}

function questionCount(bank, def) {
  return def.sections.reduce((n, s) => n + s.parts.reduce((m, p) => m + partQuestions(bank, p).length, 0), 0);
}

/** Catalogue entry. Contains no questions or answers. */
function summarise(bank, def) {
  return {
    id: def.id,
    name: def.name,
    exam: def.exam,
    kind: def.kind,
    tier: def.tier,
    level: def.level,
    minutes: def.minutes,
    questionCount: questionCount(bank, def),
    marksPerCorrect: def.marksPerCorrect,
    negativeMarks: def.negativeMarks,
    sections: def.sections.map((s) => s.name),
  };
}

/** Full test with questions, correct answers and explanations. */
function build(bank, def) {
  const questions = [];
  const sections = def.sections.map((s, sectionIndex) => {
    const from = questions.length;
    s.parts.forEach((p) => {
      partQuestions(bank, p).forEach(({ topic, q }) => {
        questions.push({
          id: `${topic.id}:${q.position}`,
          topic: topic.id,
          topicName: topic.name,
          section: sectionIndex,
          question: q.q,
          options: q.options,
          answer: q.answer,
          explanation: q.explanation,
        });
      });
    });
    return { name: s.name, from, to: questions.length };
  });
  return { ...summarise(bank, def), sections, questions };
}

function listFromBank(bank) {
  return allDefinitions(bank)
    .map((d) => summarise(bank, d))
    .filter((t) => t.questionCount > 0);
}

// ── Public API ─────────────────────────────────────────

async function listMocks() {
  return listFromBank(await loadBank());
}

/** Returns { summary, build() } or null. */
async function findMock(id) {
  const bank = await loadBank();
  const def = allDefinitions(bank).find((d) => d.id === id);
  if (!def) return null;
  const summary = summarise(bank, def);
  if (summary.questionCount === 0) return null;
  return { summary, tier: def.tier, build: () => build(bank, def) };
}

module.exports = { loadBank, invalidate, listMocks, findMock, listFromBank, build, allDefinitions, fromJson };
