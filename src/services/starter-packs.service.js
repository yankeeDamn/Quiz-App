'use strict';

/**
 * Admin-managed content for the three Free, practice-only exam starter packs.
 *
 * Bundled questions live in content/separate-exam-practice-starter.json and are never
 * modified. Admin changes are stored in `starter_pack_questions` and merged on read, so
 * the bundled JSON remains the fallback when the database is unreachable. These packs are
 * never scored on the server, never require a plan and carry no publication state.
 */

const db = require('../config/database');
const { randomUUID } = require('node:crypto');
const bundled = require('../../content/separate-exam-practice-starter.json');

const MAX_QUESTIONS_PER_PACK = 200;
const DIFFICULTIES = new Set(['Easy', 'Moderate', 'Hard']);

// canAddRemove: Railways supports add/edit/delete; Banking and UPSC support edits only.
const PACKS = Object.freeze({
  'railways-rrb-starter': { key: 'railways-rrb', name: 'Railways RRB Starter', canAddRemove: true },
  'banking-ibps-starter': { key: 'banking-ibps', name: 'Banking IBPS Starter', canAddRemove: false },
  'upsc-gs-starter': { key: 'upsc-gs', name: 'UPSC General Studies Starter', canAddRemove: false },
});

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

function packOf(packId) {
  if (!Object.prototype.hasOwnProperty.call(PACKS, packId)) throw fail('Unknown starter pack', 404);
  return PACKS[packId];
}

const text = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;

/** Validate and normalise an editable question. The correct answer is a 0-based option index. */
function validateStarterQuestion(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw fail('Provide a question object');
  if (!text(input.question, 5, 600)) throw fail('Question must be 5–600 characters');
  if (!text(input.explanation, 3, 1000)) throw fail('Explanation must be 3–1000 characters');
  if (!Array.isArray(input.options) || input.options.length !== 4 || input.options.some((o) => !text(o, 1, 200))) {
    throw fail('Provide exactly four options of 1–200 characters');
  }
  const options = input.options.map((o) => o.trim());
  if (new Set(options.map((o) => o.toLowerCase())).size !== 4) throw fail('Options must all be different');
  if (!Number.isInteger(input.answer) || input.answer < 0 || input.answer > 3) {
    throw fail('The correct answer must be one of the four options');
  }
  const difficulty = input.difficulty === undefined ? 'Moderate' : input.difficulty;
  if (!DIFFICULTIES.has(difficulty)) throw fail('Difficulty must be Easy, Moderate or Hard');
  return {
    question: input.question.trim(), options, answer: input.answer,
    explanation: input.explanation.trim(), difficulty,
  };
}

const stemKey = (q) => q.trim().toLowerCase().replace(/\s+/g, ' ');

/** Bundled IDs are "<pack>:<index>" (as before); admin additions are "<pack>:x-<uuid>". */
function bundledQuestions(packId) {
  return bundled[packOf(packId).key].map((row, index) => ({
    id: `${packId}:${index}`, question: row.question, options: [...row.options],
    answer: row.answer, explanation: row.explanation, difficulty: row.difficulty || 'Moderate',
    source: 'bundled',
  }));
}

/** Pure merge of the bundled pack with stored rows. Rows are expected in creation order. */
function mergePack(packId, rows) {
  const mine = rows.filter((r) => r.pack_id === packId);
  const byId = new Map(mine.map((r) => [r.question_id, r]));
  const out = [];
  for (const base of bundledQuestions(packId)) {
    const row = byId.get(base.id);
    if (!row) out.push(base);
    else if (row.kind === 'override') out.push({ ...base, ...row.content, id: base.id, source: 'bundled', edited: true });
  }
  for (const row of mine) {
    if (row.kind === 'addition') out.push({ ...row.content, id: row.question_id, source: 'added', edited: false });
  }
  return out;
}

async function loadRows() {
  const { rows } = await db.query(
    'SELECT pack_id, question_id, kind, content FROM starter_pack_questions ORDER BY created_at, question_id'
  );
  return rows;
}

const publicShape = ({ id, question, options, answer, explanation, difficulty }) =>
  ({ id, question, options, answer, explanation, difficulty });

/** Free, public practice content: every pack with admin edits applied. */
async function listPublic() {
  const rows = await loadRows();
  return Object.fromEntries(Object.keys(PACKS).map((id) => [id, mergePack(id, rows).map(publicShape)]));
}

/** Admin view: same content plus editing capabilities and origin flags. */
async function listForAdmin() {
  const rows = await loadRows();
  return Object.entries(PACKS).map(([id, spec]) => ({
    id, name: spec.name, canAddRemove: spec.canAddRemove,
    questions: mergePack(id, rows).map((q) => ({ ...publicShape(q), source: q.source, edited: !!q.edited })),
  }));
}

function assertDuplicate(current, candidate, exceptId) {
  const key = stemKey(candidate.question);
  if (current.some((q) => q.id !== exceptId && stemKey(q.question) === key)) {
    throw fail('Another question in this pack already uses the same wording', 409);
  }
}

async function saveQuestion(packId, questionId, input, actor = null) {
  packOf(packId);
  const checked = validateStarterQuestion(input);
  const current = mergePack(packId, await loadRows());
  const existing = current.find((q) => q.id === questionId);
  if (!existing) throw fail('Question not found in this pack', 404);
  assertDuplicate(current, checked, questionId);
  // Existing rows (additions) keep their kind; a bundled question becomes an override.
  await db.query(
    `INSERT INTO starter_pack_questions (pack_id, question_id, kind, content, updated_by)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     ON CONFLICT (pack_id, question_id) DO UPDATE
       SET content = EXCLUDED.content, updated_at = NOW(), updated_by = EXCLUDED.updated_by
       WHERE starter_pack_questions.kind <> 'removed'`,
    [packId, questionId, existing.source === 'bundled' ? 'override' : 'addition', JSON.stringify(checked), actor]
  );
  return { id: questionId, ...checked };
}

async function addQuestion(packId, input, actor = null) {
  if (!packOf(packId).canAddRemove) throw fail('Questions can only be added to the Railways RRB Starter', 403);
  const checked = validateStarterQuestion(input);
  const current = mergePack(packId, await loadRows());
  if (current.length >= MAX_QUESTIONS_PER_PACK) throw fail(`A pack can hold at most ${MAX_QUESTIONS_PER_PACK} questions`, 409);
  assertDuplicate(current, checked, null);
  const id = `${packId}:x-${randomUUID()}`;
  await db.query(
    `INSERT INTO starter_pack_questions (pack_id, question_id, kind, content, updated_by)
     VALUES ($1, $2, 'addition', $3::jsonb, $4)`,
    [packId, id, JSON.stringify(checked), actor]
  );
  return { id, ...checked };
}

async function removeQuestion(packId, questionId, actor = null) {
  if (!packOf(packId).canAddRemove) throw fail('Questions can only be deleted from the Railways RRB Starter', 403);
  const current = mergePack(packId, await loadRows());
  const existing = current.find((q) => q.id === questionId);
  if (!existing) throw fail('Question not found in this pack', 404);
  if (current.length <= 1) throw fail('A pack must keep at least one question', 409);
  if (existing.source === 'added') {
    await db.query('DELETE FROM starter_pack_questions WHERE pack_id=$1 AND question_id=$2', [packId, questionId]);
  } else {
    await db.query(
      `INSERT INTO starter_pack_questions (pack_id, question_id, kind, content, updated_by)
       VALUES ($1, $2, 'removed', NULL, $3)
       ON CONFLICT (pack_id, question_id) DO UPDATE
         SET kind = 'removed', content = NULL, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
      [packId, questionId, actor]
    );
  }
  return { id: questionId };
}

module.exports = {
  PACKS, MAX_QUESTIONS_PER_PACK, validateStarterQuestion, mergePack,
  listPublic, listForAdmin, saveQuestion, addQuestion, removeQuestion,
};
