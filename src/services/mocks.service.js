'use strict';

const bank = require('../data/mock-bank.json');

const topicById = new Map(bank.topics.map((t) => [t.id, t]));

/** Every test the site offers: full mocks plus one test per topic. */
function allDefinitions() {
  const topicTests = bank.topics.map((t) => ({
    id: `topic-${t.id}`,
    name: `${t.name} Test`,
    exam: t.category,
    kind: 'topic',
    minutes: 12,
    marksPerCorrect: 1,
    negativeMarks: 0.25,
    level: 'Practice',
    tier: 'free',
    sections: [{ name: t.name, parts: [{ topic: t.id, from: 0, to: t.questions.length }] }],
  }));
  const fullMocks = bank.mocks.map((m) => ({ ...m, kind: 'mock' }));
  return [...fullMocks, ...topicTests];
}

const definitions = allDefinitions();
const definitionById = new Map(definitions.map((d) => [d.id, d]));

function questionCount(def) {
  return def.sections.reduce((n, s) => n + s.parts.reduce((m, p) => m + (p.to - p.from), 0), 0);
}

/** Catalogue entry. Contains no questions or answers. */
function summarise(def) {
  return {
    id: def.id,
    name: def.name,
    exam: def.exam,
    kind: def.kind,
    tier: def.tier,
    level: def.level,
    minutes: def.minutes,
    questionCount: questionCount(def),
    marksPerCorrect: def.marksPerCorrect,
    negativeMarks: def.negativeMarks,
    sections: def.sections.map((s) => s.name),
  };
}

function listMocks() {
  return definitions.map(summarise);
}

function getDefinition(id) {
  return definitionById.get(id) || null;
}

/** Full test with questions, correct answers and explanations. */
function buildMock(def) {
  const questions = [];
  const sections = def.sections.map((s, sectionIndex) => {
    const from = questions.length;
    s.parts.forEach((p) => {
      const topic = topicById.get(p.topic);
      for (let i = p.from; i < p.to; i += 1) {
        const q = topic.questions[i];
        questions.push({
          id: `${topic.id}:${i}`,
          topic: topic.id,
          topicName: topic.name,
          section: sectionIndex,
          question: q.q,
          options: q.options,
          answer: q.answer,
          explanation: q.explanation,
        });
      }
    });
    return { name: s.name, from, to: questions.length };
  });
  return { ...summarise(def), sections, questions };
}

module.exports = { listMocks, getDefinition, buildMock, questionCount, bank };
