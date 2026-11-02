'use strict';

const config = require('../config');
const db = require('../config/database');
const jsonBank = require('../data/public-practice-sample.json');

/** Protected content has no bundled fallback. Offline mode has synthetic public practice only. */
function fromJson(source = jsonBank) {
  return {
    topics: source.topics.map(t => ({...t, questions:t.questions.map((q,position)=>({
      position, reviewStatus:'draft', accessTier:'premium', reviewedAt:null, ...q,
    }))})),
    mocks: source.mocks.map(m => ({...m, active:m.active !== false})),
  };
}

async function fromDatabase() {
  const [topics, questions, mocks] = await Promise.all([
    db.query('SELECT id, name, category FROM mock_topics WHERE active ORDER BY created_at, id'),
    db.query(
      `SELECT topic_id, position, question, options, answer, explanation, review_status, reviewed_at, access_tier
         FROM mock_questions WHERE active AND review_status = 'published' ORDER BY topic_id, position`
    ),
    db.query(
      `SELECT id, name, exam, minutes, marks_per_correct, negative_marks, pass_percent, level, tier, sections, active
         FROM mock_tests ORDER BY created_at, id`
    ),
  ]);
  const byTopic = new Map(topics.rows.map((t) => [t.id, { ...t, questions: [] }]));
  questions.rows.forEach((r) => {
    const t = byTopic.get(r.topic_id);
    if (t) t.questions.push({ position: r.position, q: r.question, options: r.options, answer: r.answer, explanation: r.explanation, reviewStatus:r.review_status, reviewedAt:r.reviewed_at, accessTier:r.access_tier });
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
      passPercent: Number(m.pass_percent),
      level: m.level,
      tier: m.tier,
      active: m.active,
      sections: m.sections,
    })),
  };
}

// Read current publication state on every request, including across API instances.
function invalidate() {} // Kept for existing authoring integrations.
async function loadBank() {
  return config.databaseUrl ? fromDatabase() : fromJson();
}

// ── Pure helpers (take a bank) ─────────────────────────

function topicDefinitions(bank) {
  return bank.topics
    .filter((t) => t.questions.some(q=>publicQuestion(bank,t,q,'free')))
    .map((t) => ({
      id: `topic-${t.id}`,
      name: `${t.name} Test`,
      exam: t.category,
      kind: 'topic',
      // Keep 12-minute starter-topic tests; larger imported topic banks need adequate time.
      minutes: Math.max(12, Math.min(180, t.questions.length)),
      marksPerCorrect: 1,
      negativeMarks: 0.25,
      passPercent: 50,
      level: 'Practice',
      tier: 'free',
      sections: [{ name: t.name, parts: [{ topic: t.id, from: 0, to: Number.MAX_SAFE_INTEGER }] }],
    }));
}

function allDefinitions(bank) {
  return [...bank.mocks.filter(m=>m.active !== false).map((m) => ({ ...m, kind: 'mock' })), ...topicDefinitions(bank)];
}

// A paid definition may share a topic/range with free practice. Paid takes precedence.
function publicQuestion(bank, topic, question, tier) {
  if (question.reviewStatus !== 'published') return false;
  if (tier === 'premium') return true;
  if (question.accessTier !== 'free') return false;
  return !bank.mocks.some(m=>m.tier==='premium' && m.sections.some(s=>s.parts.some(p=>
    p.topic===topic.id && question.position>=p.from && question.position<p.to)));
}
function partQuestions(bank, part, tier) {
  const topic = bank.topics.find((t) => t.id === part.topic);
  if (!topic) return [];
  return topic.questions
    .filter((q) => q.position >= part.from && q.position < part.to && (!tier || publicQuestion(bank,topic,q,tier)))
    .map((q) => ({ topic, q }));
}

function questionCount(bank, def) {
  return def.sections.reduce((n, s) => n + s.parts.reduce((m, p) => m + partQuestions(bank, p, def.tier).length, 0), 0);
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
    passPercent: def.passPercent ?? 50,
    sections: def.sections.map((s) => s.name),
    underReview: def.sections.some(s=>s.parts.some(p=>partQuestions(bank,p,def.tier).some(({q})=>!q.reviewedAt))),
  };
}

/** Full test with questions, correct answers and explanations. */
function build(bank, def, { privatePreview = false } = {}) {
  const questions = [];
  const sections = def.sections.map((s, sectionIndex) => {
    const from = questions.length;
    s.parts.forEach((p) => {
      partQuestions(bank, p, privatePreview ? undefined : def.tier).forEach(({ topic, q }) => {
        questions.push({
          id: `${topic.id}:${q.position}`,
          topic: topic.id,
          topicName: topic.name,
          section: sectionIndex,
          question: q.q,
          options: q.options,
          answer: q.answer,
          explanation: q.explanation,
          reviewStatus: q.reviewStatus, reviewedAt:q.reviewedAt || null,
        });
      });
    });
    return { name: s.name, from, to: questions.length };
  });
  return { ...summarise(bank, def), questionCount:questions.length, sections, questions };
}

function completeDefinition(bank, def) {
  if(def.kind==='topic')return questionCount(bank,def)>0;
  const expected=def.sections.reduce((n,s)=>n+s.parts.reduce((sum,p)=>sum+p.to-p.from,0),0);
  return expected>0 && questionCount(bank,def)===expected;
}
function listFromBank(bank) {
  return allDefinitions(bank)
    .filter(d=>completeDefinition(bank,d))
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
  if (!def || !completeDefinition(bank,def)) return null;
  const summary = summarise(bank, def);
  if (summary.questionCount === 0) return null;
  return { summary, tier: def.tier, build: () => build(bank, def) };
}

module.exports = { loadBank, invalidate, listMocks, findMock, listFromBank, build, allDefinitions, fromJson, publicQuestion, fromDatabase };
