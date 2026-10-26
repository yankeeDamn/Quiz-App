'use strict';

/**
 * Optional ExamPro competitive bank:
 * 4 source groups x 125 MCQs => 20 practice sets of 25 questions.
 *
 * All new topics and mocks are seeded as INACTIVE DRAFTS. Owners must review
 * and activate the topics and publish individual tests in /admin.
 * Existing content, edits, activation state and student attempts are untouched.
 */
const source = require('../data/competitive-questions-500.json');

const GROUPS = [
  { exam: 'SSC General (CHSL / MTS)', id: 'comp-ssc-chsl-mts-2026', name: 'SSC CHSL / MTS (500-bank)', category: 'SSC', prefix: 'comp-ssc-general', label: 'SSC CHSL / MTS' },
  { exam: 'SSC CGL', id: 'comp-ssc-cgl-2026', name: 'SSC CGL (500-bank)', category: 'SSC', prefix: 'comp-ssc-cgl', label: 'SSC CGL' },
  { exam: 'Banking (IBPS / SBI)', id: 'comp-banking-2026', name: 'IBPS / SBI Banking (500-bank)', category: 'Banking', prefix: 'comp-banking', label: 'IBPS / SBI Banking' },
  { exam: 'Railway (RRB NTPC / Group D)', id: 'comp-railways-2026', name: 'RRB NTPC / Group D (500-bank)', category: 'Railways', prefix: 'comp-railways', label: 'RRB NTPC / Group D' },
];

function makeCompetitiveBank(raw = source) {
  if (!raw || !Array.isArray(raw.questions) || raw.questions.length !== 500) {
    throw new Error('Competitive bank must contain exactly 500 questions');
  }
  const seen = new Set();
  const groups = GROUPS.map(group => ({ ...group, questions: [] }));
  for (const item of raw.questions) {
    const group = groups.find(g => g.exam === item.exam);
    if (!group) throw new Error('Unknown exam category: ' + item.exam);
    const prompt = String(item.q || '').trim();
    const choices = item.options;
    const answer = String(item.answer || '').trim().toUpperCase().charCodeAt(0) - 65;
    const explanation = String(item.why || '').trim();
    const normalized = prompt.toLocaleLowerCase('en').replace(/\s+/g, ' ');
    if (prompt.length < 5 || prompt.length > 600 || seen.has(normalized)) {
      throw new Error('Invalid or repeated question: ' + prompt.slice(0, 80));
    }
    if (!Array.isArray(choices) || choices.length !== 4 ||
        choices.some(o => typeof o !== 'string' || !o.trim() || o.length > 200) ||
        new Set(choices.map(o => o.trim().toLocaleLowerCase('en'))).size !== 4 ||
        answer < 0 || answer > 3 ||
        choices[answer] !== item.correct ||
        explanation.length < 3 || explanation.length > 850) {
      throw new Error('Invalid answer/options/explanation for: ' + prompt.slice(0, 80));
    }
    if (item.source && (!raw.sources || !raw.sources[item.source])) {
      throw new Error('Unknown source reference: ' + item.source);
    }
    seen.add(normalized);
    const provenance = item.source ? '[Source-labelled adaptation/sample; not a verbatim official exam paper: ' +
      String(item.kind || item.source).slice(0, 110) + '] ' : '';
    group.questions.push({
      q: prompt,
      options: choices.map(o => o.trim()),
      answer,
      explanation: provenance + explanation,
      difficulty: 'Moderate',
    });
  }
  if (groups.some(group => group.questions.length !== 125)) {
    throw new Error('Each competitive exam group must have exactly 125 questions');
  }
  const mocks = [];
  for (const group of groups) {
    for (let set = 1; set <= 5; set++) {
      mocks.push({
        id: group.prefix + '-set-' + set,
        name: group.label + ' Practice Set ' + set,
        exam: group.category,
        minutes: 30,
        marksPerCorrect: 1,
        negativeMarks: 0.25,
        passPercent: 50,
        level: 'Practice',
        tier: 'free',
        sections: [{ name: group.label, parts: [{ topic: group.id, from: (set-1)*25, to: set*25 }] }],
      });
    }
  }
  return { topics: groups, mocks };
}

/**
 * Run within the existing migration transaction, AFTER exampro-v2.sql
 * adds difficulty and pass_percent. Non-destructive and repeatable.
 */
async function seedCompetitiveContent(client, input = source) {
  // Validate the *entire* bank before issuing any writes.
  const bank = makeCompetitiveBank(input);
  for (const topic of bank.topics) {
    await client.query(
      'INSERT INTO mock_topics (id, name, category, active) VALUES ($1,$2,$3,FALSE) ON CONFLICT (id) DO NOTHING',
      [topic.id, topic.name, topic.category]
    );
    // Batch insert one exam group, retaining original sequence and stable IDs.
    await client.query(
      `INSERT INTO mock_questions (topic_id, position, question, options, answer, explanation, difficulty)
       SELECT $1, (ordinality - 1)::int, value->>'q', value->'options',
              (value->>'answer')::int, value->>'explanation', value->>'difficulty'
         FROM jsonb_array_elements($2::jsonb) WITH ORDINALITY AS q(value, ordinality)
       ON CONFLICT (topic_id, position) DO NOTHING`,
      [topic.id, JSON.stringify(topic.questions)]
    );
  }
  for (const mock of bank.mocks) {
    await client.query(
      `INSERT INTO mock_tests
       (id, name, exam, minutes, marks_per_correct, negative_marks, pass_percent, level, tier, sections, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,FALSE)
       ON CONFLICT (id) DO NOTHING`,
      [mock.id, mock.name, mock.exam, mock.minutes, mock.marksPerCorrect,
        mock.negativeMarks, mock.passPercent, mock.level, mock.tier,
        JSON.stringify(mock.sections)]
    );
  }
  return { topics: bank.topics.length, questions: 500, mocks: bank.mocks.length, drafts: true };
}

module.exports = { GROUPS, makeCompetitiveBank, seedCompetitiveContent };
