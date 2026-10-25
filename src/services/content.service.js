'use strict';

const db = require('../config/database');
const mocks = require('./mocks.service');

const SLUG = /^[a-z0-9][a-z0-9-]{1,38}$/;
const LEVELS = ['Easy', 'Moderate', 'Hard', 'Practice'];
const TIERS = ['free', 'premium'];
const DIFFICULTIES = ['Easy','Moderate','Hard'];

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const fail = (message) => ({ ok: false, error: message });

/** Check one question. Returns { ok: true, value } or { ok: false, error }. */
function checkQuestion(input) {
  const question = str(input && input.question);
  const explanation = str(input && input.explanation);
  const options = Array.isArray(input && input.options) ? input.options.map(str) : [];
  const answer = Number(input && input.answer);
  const difficulty = str(input && input.difficulty) || 'Moderate';

  if (question.length < 5 || question.length > 600) return fail('Question must be 5 to 600 characters.');
  if (options.length !== 4) return fail('Give exactly four options.');
  if (options.some((o) => !o || o.length > 200)) return fail('Every option needs 1 to 200 characters.');
  if (new Set(options.map((o) => o.toLowerCase())).size !== 4) return fail('The four options must all be different.');
  if (!Number.isInteger(answer) || answer < 0 || answer > 3) return fail('The right answer must be A, B, C or D.');
  if (!DIFFICULTIES.includes(difficulty)) return fail('Difficulty must be Easy, Moderate or Hard.');
  if (explanation.length < 3 || explanation.length > 1000) return fail('Explanation must be 3 to 1000 characters.');
  return { ok: true, value: { question, options, answer, explanation, difficulty } };
}

/** Check a full mock test. topicIds is the list of existing topic ids. */
function checkTest(input, topicIds) {
  const name = str(input && input.name);
  const exam = str(input && input.exam);
  const level = str(input && input.level) || 'Moderate';
  const tier = str(input && input.tier) || 'free';
  const minutes = Number(input && input.minutes);
  const marks = Number(input && input.marksPerCorrect);
  const negative = Number(input && input.negativeMarks);
  const passPercent = Number(input && (input.passPercent ?? 50));
  const sections = input && input.sections;

  if (name.length < 3 || name.length > 120) return fail('Name must be 3 to 120 characters.');
  if (exam.length < 2 || exam.length > 60) return fail('Exam group must be 2 to 60 characters.');
  if (!LEVELS.includes(level)) return fail('Level must be Easy, Moderate, Hard or Practice.');
  if (!TIERS.includes(tier)) return fail('Tier must be free or premium.');
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 300) return fail('Minutes must be 1 to 300.');
  if (!(marks > 0 && marks <= 10)) return fail('Marks per correct answer must be above 0 and at most 10.');
  if (!(negative >= 0 && negative <= marks)) return fail('Negative marks cannot be below 0 or above the marks for a right answer.');
  if (!Number.isInteger(passPercent) || passPercent < 0 || passPercent > 100) return fail('Passing score must be from 0 to 100 percent.');
  if (!Array.isArray(sections) || sections.length < 1 || sections.length > 8) return fail('Add 1 to 8 sections.');

  const clean = [];
  for (const s of sections) {
    const sname = str(s && s.name);
    if (!sname || sname.length > 60) return fail('Every section needs a name of up to 60 characters.');
    if (!Array.isArray(s.parts) || s.parts.length < 1 || s.parts.length > 12) return fail(`Section "${sname}" needs 1 to 12 question ranges.`);
    const parts = [];
    for (const p of s.parts) {
      const from = Number(p && p.from);
      const to = Number(p && p.to);
      if (!topicIds.includes(p && p.topic)) return fail(`Section "${sname}" uses a topic that does not exist.`);
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to <= from) return fail(`Section "${sname}" has a bad question range. "To" must be above "from".`);
      parts.push({ topic: p.topic, from, to });
    }
    clean.push({ name: sname, parts });
  }
  return { ok: true, value: { name, exam, level, tier, minutes, marksPerCorrect: marks, negativeMarks: negative, passPercent, sections: clean } };
}

class ContentService {
  // ── Topics ───────────────────────────────────────────
  async listTopics() {
    const { rows } = await db.query(
      `SELECT t.id, t.name, t.category, t.active,
              COUNT(q.id)::int AS total,
              COUNT(q.id) FILTER (WHERE q.active)::int AS live
         FROM mock_topics t LEFT JOIN mock_questions q ON q.topic_id = t.id
        GROUP BY t.id ORDER BY t.created_at, t.id`
    );
    return rows;
  }

  async createTopic({ id, name, category }) {
    const slug = str(id).toLowerCase();
    if (!SLUG.test(slug)) return fail('Topic id: 2 to 39 characters, lower-case letters, numbers and dashes.');
    if (str(name).length < 3 || str(name).length > 120) return fail('Topic name must be 3 to 120 characters.');
    if (str(category).length < 2 || str(category).length > 60) return fail('Category must be 2 to 60 characters.');
    const exists = await db.query('SELECT 1 FROM mock_topics WHERE id = $1', [slug]);
    if (exists.rowCount) return fail('A topic with this id already exists.');
    await db.query('INSERT INTO mock_topics (id, name, category) VALUES ($1, $2, $3)', [slug, str(name), str(category)]);
    mocks.invalidate();
    return { ok: true, value: { id: slug } };
  }

  async updateTopic(id, input) {
    const name = str(input?.name), category = str(input?.category);
    if (name.length < 3 || name.length > 120 || category.length < 2 || category.length > 60) return fail('Topic name or category is invalid.');
    const r = await db.query('UPDATE mock_topics SET name=$2, category=$3 WHERE id=$1',[id,name,category]);
    mocks.invalidate();
    return r.rowCount ? {ok:true,value:{id,name,category}} : fail('Topic not found');
  }

  async setTopicActive(id, active) {
    const r = await db.query('UPDATE mock_topics SET active = $2 WHERE id = $1', [id, Boolean(active)]);
    mocks.invalidate();
    return r.rowCount > 0;
  }

  // ── Questions ────────────────────────────────────────
  async listQuestions(topicId) {
    const { rows } = await db.query(
      `SELECT id, position, question, options, answer, explanation, difficulty, active
         FROM mock_questions WHERE topic_id = $1 ORDER BY position`,
      [topicId]
    );
    return rows;
  }

  async topicExists(id) {
    const r = await db.query('SELECT 1 FROM mock_topics WHERE id = $1', [id]);
    return r.rowCount > 0;
  }

  /** Add checked questions to the end of a topic. */
  async addQuestions(topicId, values) {
    const { rows } = await db.query('SELECT COALESCE(MAX(position), -1) AS last FROM mock_questions WHERE topic_id = $1', [topicId]);
    let position = rows[0].last + 1;
    for (const v of values) {
      await db.query(
        `INSERT INTO mock_questions (topic_id, position, question, options, answer, explanation, difficulty)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [topicId, position, v.question, JSON.stringify(v.options), v.answer, v.explanation, v.difficulty]
      );
      position += 1;
    }
    mocks.invalidate();
    return values.length;
  }

  async updateQuestion(id, v) {
    const r = await db.query(
      `UPDATE mock_questions SET question = $2, options = $3, answer = $4, explanation = $5, difficulty = $6, updated_at = NOW()
        WHERE id = $1`,
      [id, v.question, JSON.stringify(v.options), v.answer, v.explanation, v.difficulty]
    );
    mocks.invalidate();
    return r.rowCount > 0;
  }

  async setQuestionActive(id, active) {
    const r = await db.query('UPDATE mock_questions SET active = $2, updated_at = NOW() WHERE id = $1', [id, Boolean(active)]);
    mocks.invalidate();
    return r.rowCount > 0;
  }

  // ── Tests ────────────────────────────────────────────
  async listTests() {
    const { rows } = await db.query(
      `SELECT id, name, exam, minutes, marks_per_correct, negative_marks, pass_percent, level, tier, sections, active
         FROM mock_tests ORDER BY created_at, id`
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      exam: r.exam,
      minutes: r.minutes,
      marksPerCorrect: Number(r.marks_per_correct),
      negativeMarks: Number(r.negative_marks),
      passPercent: Number(r.pass_percent),
      level: r.level,
      tier: r.tier,
      sections: r.sections,
      active: r.active,
    }));
  }

  async topicIds() {
    const { rows } = await db.query('SELECT id FROM mock_topics');
    return rows.map((r) => r.id);
  }

  async createTest(id, v) {
    const slug = str(id).toLowerCase();
    if (!SLUG.test(slug)) return fail('Test id: 2 to 39 characters, lower-case letters, numbers and dashes.');
    if (slug.startsWith('topic-')) return fail('Test ids starting with "topic-" are reserved.');
    const exists = await db.query('SELECT 1 FROM mock_tests WHERE id = $1', [slug]);
    if (exists.rowCount) return fail('A test with this id already exists.');
    await db.query(
      `INSERT INTO mock_tests (id, name, exam, minutes, marks_per_correct, negative_marks, level, tier, sections, pass_percent, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [slug, v.name, v.exam, v.minutes, v.marksPerCorrect, v.negativeMarks, v.level, v.tier, JSON.stringify(v.sections), v.passPercent, false]
    );
    mocks.invalidate();
    return { ok: true, value: { id: slug } };
  }

  async updateTest(id, v, active) {
    const r = await db.query(
      `UPDATE mock_tests SET name = $2, exam = $3, minutes = $4, marks_per_correct = $5, negative_marks = $6,
              level = $7, tier = $8, sections = $9, active = $10, pass_percent=$11, updated_at = NOW()
        WHERE id = $1`,
      [id, v.name, v.exam, v.minutes, v.marksPerCorrect, v.negativeMarks, v.level, v.tier, JSON.stringify(v.sections), active, v.passPercent]
    );
    mocks.invalidate();
    return r.rowCount > 0;
  }

  // ── Plans ────────────────────────────────────────────
  async recentGrants(limit = 30) {
    const { rows } = await db.query(
      `SELECT g.plan, g.months, g.amount_inr, g.note, g.expires_at, g.granted_at, u.email
         FROM plan_grants g JOIN users u ON u.id = g.user_id
        ORDER BY g.granted_at DESC LIMIT $1`,
      [limit]
    );
    return rows;
  }

  async searchUsers(q) {
    const term = `%${str(q).toLowerCase().replace(/[%_]/g, '')}%`;
    const { rows } = await db.query(
      `SELECT email, name, plan, plan_expires_at, created_at FROM users
        WHERE email IS NOT NULL AND LOWER(email) LIKE $1
        ORDER BY created_at DESC LIMIT 25`,
      [term]
    );
    return rows;
  }
}

module.exports = Object.assign(new ContentService(), { checkQuestion, checkTest, LEVELS, TIERS });
