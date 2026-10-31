'use strict';

const db = require('../config/database');
const mocks = require('./mocks.service');
const { isFullCglMock } = require('./ssc-full-mock-classifier');

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
  const usedPositions = new Set();
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
      // Prevent two sections from assigning the same question (responses use stable IDs).
      if (to-from > 500) return fail('Each range must contain no more than 500 positions.');
      for(let i=from;i<to;i++){
        const key=p.topic+':'+i;
        if(usedPositions.has(key))return fail('A question range appears more than once in this test.');
        usedPositions.add(key);
      }
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

  async createTopic({ id, name, category, active = true }) {
    const slug = str(id).toLowerCase();
    if (!SLUG.test(slug)) return fail('Topic id: 2 to 39 characters, lower-case letters, numbers and dashes.');
    if (str(name).length < 3 || str(name).length > 120) return fail('Topic name must be 3 to 120 characters.');
    if (str(category).length < 2 || str(category).length > 60) return fail('Category must be 2 to 60 characters.');
    const exists = await db.query('SELECT 1 FROM mock_topics WHERE id = $1', [slug]);
    if (exists.rowCount) return fail('A topic with this id already exists.');
    // New admin drafts can be inactive from the first insert; an active topic
    // automatically becomes a public free topic-practice quiz after import.
    if(typeof active !== 'boolean') return fail('Topic active must be a boolean.');
    await db.query('INSERT INTO mock_topics (id, name, category, active) VALUES ($1, $2, $3, $4)', [slug, str(name), str(category), active]);
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
  /**
   * Admin-only preview includes live question rows from inactive draft topics.
   * Unlike public mocks.loadBank(), it never depends on mock_tests.active or
   * mock_topics.active, and never changes publication flags.
   */
  async previewTest(definition) {
    const topicIds = [...new Set(definition.sections.flatMap(s=>s.parts.map(p=>p.topic)))];
    const [topics, questions] = await Promise.all([
      db.query('SELECT id, name, category FROM mock_topics WHERE id = ANY($1::text[])', [topicIds]),
      db.query(`SELECT topic_id, position, question, options, answer, explanation
         FROM mock_questions WHERE topic_id = ANY($1::text[]) AND active
         ORDER BY topic_id, position`, [topicIds]),
    ]);
    const byTopic = new Map(topics.rows.map(t=>[t.id,{...t,questions:[]}]));
    for(const q of questions.rows) {
      const t=byTopic.get(q.topic_id);
      if(t)t.questions.push({position:q.position,q:q.question,options:q.options,answer:q.answer,explanation:q.explanation});
    }
    const bank={topics:[...byTopic.values()],mocks:[]};
    const built=mocks.build(bank,{...definition,kind:'mock'});
    return {id:definition.id,name:definition.name,questionCount:built.questions.length,minutes:definition.minutes,
      questionIds:built.questions.map(q=>q.id),questions:built.questions.map(q=>({id:q.id,question:q.question,topic:q.topic}))};
  }

  /**
   * Build a private, unpublished exam from inactive mock/topics for staging QA.
   * Called only behind authenticated admin + explicit staging feature gates.
   * Never use loadBank(), which intentionally excludes inactive content.
   * This value includes answer keys and MUST never be serialised to clients.
   */
  async buildDraftExam(testId) {
    const { rows: definitions } = await db.query(
      `SELECT id, name, exam, minutes, marks_per_correct, negative_marks,
              pass_percent, level, tier, sections, active
         FROM mock_tests WHERE id=$1 AND active=false`, [testId]
    );
    if (!definitions.length) return null;
    const d = definitions[0];
    const definition = {
      id: d.id, name: d.name, exam: d.exam, minutes: d.minutes,
      marksPerCorrect: Number(d.marks_per_correct), negativeMarks: Number(d.negative_marks),
      passPercent: Number(d.pass_percent), level: d.level, tier: d.tier,
      sections: d.sections, active: false, kind: 'mock',
    };
    if (!Array.isArray(definition.sections) || !definition.sections.length) {
      throw Object.assign(new Error('Draft sections are incomplete.'), { statusCode: 409 });
    }
    const ids = [...new Set(definition.sections.flatMap(s => s.parts.map(p => p.topic)))];
    const [topicRows, questionRows] = await Promise.all([
      db.query('SELECT id, name, category, active FROM mock_topics WHERE id = ANY($1::text[])', [ids]),
      db.query(`SELECT topic_id, position, question, options, answer, explanation
         FROM mock_questions WHERE topic_id = ANY($1::text[]) AND active
         ORDER BY topic_id, position`, [ids]),
    ]);
    // Restrict testing to drafts whose entire source bank is hidden to learners.
    if (topicRows.rows.length !== ids.length || topicRows.rows.some(t => t.active)) {
      throw Object.assign(new Error('Draft test requires four inactive source topics.'), { statusCode: 409 });
    }
    const byTopic = new Map(topicRows.rows.map(t => [t.id, {...t, questions: []}]));
    for (const q of questionRows.rows) {
      byTopic.get(q.topic_id)?.questions.push({
        position: q.position, q: q.question, options: q.options,
        answer: q.answer, explanation: q.explanation,
      });
    }
    const bank = { topics: [...byTopic.values()], mocks: [] };
    const expected = definition.sections.reduce((n,s) => n + s.parts.reduce((v,p) => v + p.to-p.from,0),0);
    const test = mocks.build(bank,definition);
    if (!expected || test.questions.length !== expected ||
        new Set(test.questions.map(q=>q.id)).size !== expected) {
      throw Object.assign(new Error('Draft contains missing or duplicate questions.'), { statusCode: 409 });
    }
    return test;
  }

  /**
   * Fail closed before an admin turns a draft mock into a public exam.
   * The protected draft Preview includes inactive topic content by design, so
   * it is NOT a publication gate. The public mock builder requires both
   * active topics and active question rows at every configured position.
   * This check never updates publication or content flags.
   */
  async publicationReadiness(definition) {
    const sections = definition?.sections;
    if (!Array.isArray(sections) || !sections.length ||
        sections.some(s => !Array.isArray(s.parts) || !s.parts.length)) {
      return fail('Publication blocked: sections are missing or incomplete.');
    }
    const parts = sections.flatMap(s => s.parts);
    if (parts.some(p => typeof p.topic !== 'string' || !Number.isSafeInteger(p.from) ||
      !Number.isSafeInteger(p.to) || p.from < 0 || p.to <= p.from || p.to - p.from > 500)) {
      return fail('Publication blocked: question ranges are invalid.');
    }
    const topicIds = [...new Set(parts.map(p => p.topic))];
    const [topics, questions] = await Promise.all([
      db.query('SELECT id, name, category, active FROM mock_topics WHERE id = ANY($1::text[])', [topicIds]),
      db.query(`SELECT topic_id, position, question, options, answer, explanation
         FROM mock_questions WHERE topic_id = ANY($1::text[]) AND active ORDER BY topic_id, position`, [topicIds]),
    ]);
    if (topics.rows.length !== topicIds.length) {
      return fail('Publication blocked: one or more referenced topics do not exist.');
    }
    if (topics.rows.some(t => !t.active)) {
      return fail('Publication blocked: all referenced topics must be reviewed and activated first. Use Test Draft for private QA.');
    }
    const byTopic = new Map(topics.rows.map(t => [t.id, {...t, questions: []}]));
    for (const q of questions.rows) {
      byTopic.get(q.topic_id)?.questions.push({
        position: q.position, q: q.question, options: q.options,
        answer: q.answer, explanation: q.explanation,
      });
    }
    const expected = parts.reduce((sum,p) => sum + p.to-p.from, 0);
    const available = parts.reduce((sum,p) => {
      const topic = byTopic.get(p.topic);
      return sum + (topic?.questions.filter(q => q.position >= p.from && q.position < p.to).length || 0);
    }, 0);
    if (available > expected) {
      return fail('Publication blocked: duplicate active question positions were found in a source topic.');
    }
    if (expected === 0 || available !== expected) {
      return fail(`Publication blocked: ${available} of ${expected} configured active questions are available. Restore or replace missing positions before publishing.`);
    }
    const bank = {topics: [...byTopic.values()], mocks: []};
    const built = mocks.build(bank, {...definition, kind: 'mock'});
    if (built.questions.length !== expected || new Set(built.questions.map(q => q.id)).size !== expected) {
      return fail('Publication blocked: duplicate or missing question IDs.');
    }
    // A test presented as a full SSC CGL Tier-I mock must match the
    // four-section standard pattern; partial practice mocks are unaffected.
    if (isFullCglMock(definition)) {
      const { eligible } = require('./ssc-section-timing');
      if (!eligible(built)) {
        return fail('Publication blocked: a full SSC CGL mock requires 100 questions in four 25-question sections, 60 minutes, +2 correct and -0.5 incorrect.');
      }
    }
    return {ok:true, questionCount:expected};
  }

  async listTests() {
    const { rows } = await db.query(
      `SELECT id, name, exam, minutes, marks_per_correct, negative_marks, pass_percent, level, tier, sections, active
         FROM mock_tests ORDER BY created_at, id`
    );
    const result = rows.map((r) => ({
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
    const bank = await mocks.loadBank();
    return result.map(t => ({...t, questionCount:mocks.build(bank,{...t,kind:'mock'}).questions.length}));
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
    return rows.map(row => {
      const {classify}=require('./manual-grants.service');
      const details=classify(row.note);
      return {...row,source:details.source,note:details.note};
    });
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
