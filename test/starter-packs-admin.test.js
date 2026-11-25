'use strict';
// jose v6 requires WebCrypto; Node 18 exposes it as node:crypto.webcrypto.
if (!globalThis.crypto) globalThis.crypto = require('node:crypto').webcrypto;
process.env.NODE_ENV = 'test';
process.env.AUTH_SECRET = 'test-secret-for-starter-pack-admin-editor-2026';
process.env.JWT_SECRET = process.env.AUTH_SECRET;
process.env.ADMIN_EMAILS = 'owner@example.test';
process.env.ADMIN_API_KEY = 'test-admin-key-valid-length-at-least-32-chars';
process.env.DATABASE_URL = 'postgres://fake:fake@localhost:5432/mocktest';

const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const db = require('../src/config/database');
const svc = require('../src/services/starter-packs.service');
const bundled = require('../content/separate-exam-practice-starter.json');

const RAIL = 'railways-rrb-starter';
const BANK = 'banking-ibps-starter';
const UPSC = 'upsc-gs-starter';

const valid = (over = {}) => ({
  question: 'Which gauge is the most widely used on Indian Railways?',
  options: ['Broad gauge', 'Metre gauge', 'Narrow gauge', 'Standard gauge'],
  answer: 0, explanation: 'Broad gauge carries most of the network.', difficulty: 'Moderate', ...over,
});

/** In-memory stand-in for the starter_pack_questions table. */
function fakeDb() {
  const rows = [];
  let clock = 0;
  return async (sql, params = []) => {
    // The auth middleware looks the signed-in account up before the admin check.
    if (sql.includes('SELECT * FROM users')) {
      return { rows: [{ id: '11111111-1111-4111-8111-111111111111', email: params[2], name: 'Tester', image: null,
        provider: 'google', provider_id: 'oauth-id', plan: 'free', role: 'user' }], rowCount: 1 };
    }
    if (sql.startsWith('SELECT pack_id')) {
      return { rows: rows.map((r) => ({ ...r })), rowCount: rows.length };
    }
    if (sql.includes("VALUES ($1, $2, 'removed', NULL")) {
      const [pack_id, question_id, actor] = params;
      const old = rows.find((r) => r.pack_id === pack_id && r.question_id === question_id);
      if (old) Object.assign(old, { kind: 'removed', content: null, updated_by: actor });
      else rows.push({ pack_id, question_id, kind: 'removed', content: null, updated_by: actor, created_at: ++clock });
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('INSERT INTO starter_pack_questions')) {
      const addition = sql.includes("VALUES ($1, $2, 'addition'");
      const [pack_id, question_id, a, b, c] = params;
      const kind = addition ? 'addition' : a;
      const content = JSON.parse(addition ? a : b);
      const actor = addition ? b : c;
      const old = rows.find((r) => r.pack_id === pack_id && r.question_id === question_id);
      if (old) { if (old.kind !== 'removed') Object.assign(old, { content, updated_by: actor }); }
      else rows.push({ pack_id, question_id, kind, content, updated_by: actor, created_at: ++clock });
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith('DELETE FROM starter_pack_questions')) {
      const i = rows.findIndex((r) => r.pack_id === params[0] && r.question_id === params[1]);
      if (i >= 0) rows.splice(i, 1);
      return { rows: [], rowCount: i >= 0 ? 1 : 0 };
    }
    throw Error('unexpected starter pack SQL: ' + sql);
  };
}

async function harness(t) {
  const original = db.query;
  db.query = fakeDb();
  const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  t.after(async () => {
    db.query = original;
    await new Promise((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  });
  const base = 'http://127.0.0.1:' + server.address().port;
  const { SignJWT } = await import('jose');
  const token = (email) => new SignJWT({ sub: 'google-oauth-user', email, name: 'Tester', provider: 'google', emailVerified: true })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode(process.env.AUTH_SECRET));
  const admin = 'Bearer ' + await token('owner@example.test');
  const student = 'Bearer ' + await token('student@example.test');
  const api = async (path, method = 'GET', authorization, body) => {
    const res = await fetch(base + '/api/v1' + path, {
      method, headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: res.status, body: await res.json() };
  };
  return { api, admin, student, base };
}

const qs = (res, pack) => res.body.data.packs[pack];

test('answer handling: the correct answer must be an integer index of one of four options', () => {
  assert.equal(svc.validateStarterQuestion(valid({ answer: 3 })).answer, 3);
  for (const answer of [-1, 4, 1.5, '2', null, undefined, NaN]) {
    assert.throws(() => svc.validateStarterQuestion(valid({ answer })), /correct answer/, String(answer));
  }
  assert.throws(() => svc.validateStarterQuestion(valid({ options: ['A', 'B', 'C'] })), /four options/);
  assert.throws(() => svc.validateStarterQuestion(valid({ options: ['A', 'a', 'C', 'D'] })), /different/);
  assert.throws(() => svc.validateStarterQuestion(valid({ explanation: ' ' })), /Explanation/);
  assert.throws(() => svc.validateStarterQuestion(valid({ difficulty: 'Brutal' })), /Difficulty/);
  const trimmed = svc.validateStarterQuestion(valid({ question: '  Padded question here?  ', options: [' a ', 'b', 'c', 'd'] }));
  assert.equal(trimmed.question, 'Padded question here?');
  assert.equal(trimmed.options[0], 'a');
});

test('Free access: guests get all three packs without a plan, bundled content intact', async (t) => {
  const { api } = await harness(t);
  const res = await api('/practice/starter-packs');
  assert.equal(res.status, 200);
  assert.deepEqual(Object.keys(res.body.data.packs), [RAIL, BANK, UPSC]);
  assert.equal(qs(res, RAIL).length, bundled['railways-rrb'].length);
  assert.equal(qs(res, BANK)[0].question, bundled['banking-ibps'][0].question);
  assert.equal(qs(res, UPSC)[3].answer, bundled['upsc-gs'][3].answer);
  // Bundled IDs are unchanged so saved bookmarks and attempts keep working.
  assert.equal(qs(res, RAIL)[0].id, RAIL + ':0');
});

test('admin-only access: guests, students and non-admin API keys cannot read or change packs', async (t) => {
  const { api, student, admin, base } = await harness(t);
  const path = `/admin/practice/starter-packs/${RAIL}/questions`;
  assert.equal((await api('/admin/practice/starter-packs')).status, 401);
  assert.equal((await api('/admin/practice/starter-packs', 'GET', student)).status, 403);
  assert.equal((await api(path, 'POST', undefined, { question: valid() })).status, 401);
  assert.equal((await api(path, 'POST', student, { question: valid() })).status, 403);
  assert.equal((await api(`${path}/${RAIL}:0`, 'PUT', student, { question: valid() })).status, 403);
  assert.equal((await api(`${path}/${RAIL}:0`, 'DELETE', student)).status, 403);
  const badKey = await fetch(`${base}/api/v1/admin/practice/starter-packs/${RAIL}/questions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-key': 'wrong-key-wrong-key-wrong-key-wrong' },
    body: JSON.stringify({ question: valid() }),
  });
  assert.equal(badKey.status, 401);
  // Nothing leaked into the public pack, and the real admin still works.
  const pub = await api('/practice/starter-packs');
  assert.equal(qs(pub, RAIL).length, bundled['railways-rrb'].length);
  assert.equal((await api('/admin/practice/starter-packs', 'GET', admin)).status, 200);
});

test('Railways: add, edit and delete persist and show in the public Free pack', async (t) => {
  const { api, admin } = await harness(t);
  const base = `/admin/practice/starter-packs/${RAIL}/questions`;
  const before = qs(await api('/practice/starter-packs'), RAIL).length;

  const added = await api(base, 'POST', admin, { question: valid() });
  assert.equal(added.status, 200);
  const newId = added.body.data.question.id;
  assert.match(newId, new RegExp('^' + RAIL + ':x-'));
  let pub = qs(await api('/practice/starter-packs'), RAIL);
  assert.equal(pub.length, before + 1);
  assert.deepEqual(pub.at(-1), { id: newId, ...valid() });

  // Correct-answer handling persists: change the right option and the explanation.
  const edited = await api(`${base}/${newId}`, 'PUT', admin, { question: valid({ answer: 2, explanation: 'Updated explanation.' }) });
  assert.equal(edited.status, 200);
  pub = qs(await api('/practice/starter-packs'), RAIL);
  assert.equal(pub.find((q) => q.id === newId).answer, 2);
  assert.equal(pub.find((q) => q.id === newId).explanation, 'Updated explanation.');

  // Edit a bundled question in place: same ID, same position.
  const firstId = RAIL + ':0';
  assert.equal((await api(`${base}/${firstId}`, 'PUT', admin, { question: valid({ question: 'Revised bundled question text?', answer: 1 }) })).status, 200);
  pub = qs(await api('/practice/starter-packs'), RAIL);
  assert.equal(pub[0].id, firstId);
  assert.equal(pub[0].question, 'Revised bundled question text?');
  assert.equal(pub[0].answer, 1);

  // Delete a bundled question (tombstone) and the added one (row removed).
  assert.equal((await api(`${base}/${RAIL}:1`, 'DELETE', admin)).status, 200);
  assert.equal((await api(`${base}/${newId}`, 'DELETE', admin)).status, 200);
  pub = qs(await api('/practice/starter-packs'), RAIL);
  assert.equal(pub.length, before - 1);
  assert.equal(pub.some((q) => q.id === RAIL + ':1' || q.id === newId), false);
  assert.equal((await api(`${base}/${RAIL}:1`, 'DELETE', admin)).status, 404);

  // Admin view flags edits and origin.
  const view = (await api('/admin/practice/starter-packs', 'GET', admin)).body.data.packs.find((p) => p.id === RAIL);
  assert.equal(view.canAddRemove, true);
  assert.equal(view.questions[0].edited, true);
});

test('Banking and UPSC: questions, answers and explanations are editable; add and delete are refused', async (t) => {
  const { api, admin } = await harness(t);
  for (const pack of [BANK, UPSC]) {
    const base = `/admin/practice/starter-packs/${pack}/questions`;
    const id = pack + ':2';
    const res = await api(`${base}/${id}`, 'PUT', admin, { question: valid({ question: `Edited ${pack} stem?`, answer: 3, explanation: 'New reasoning.' }) });
    assert.equal(res.status, 200, pack);
    const row = qs(await api('/practice/starter-packs'), pack).find((q) => q.id === id);
    assert.deepEqual([row.question, row.answer, row.explanation], [`Edited ${pack} stem?`, 3, 'New reasoning.']);
    assert.equal((await api(base, 'POST', admin, { question: valid() })).status, 403);
    assert.equal((await api(`${base}/${id}`, 'DELETE', admin)).status, 403);
    assert.equal(qs(await api('/practice/starter-packs'), pack).length, bundled[svc.PACKS[pack].key].length);
  }
});

test('invalid input is rejected with 400 and nothing is stored', async (t) => {
  const { api, admin } = await harness(t);
  const base = `/admin/practice/starter-packs/${RAIL}/questions`;
  const before = JSON.stringify(qs(await api('/practice/starter-packs'), RAIL));
  assert.equal((await api(base, 'POST', admin, { question: valid({ answer: 7 }) })).status, 400);
  assert.equal((await api(base, 'POST', admin, { question: valid({ options: ['x', 'y', 'z'] }) })).status, 400);
  assert.equal((await api(`${base}/${RAIL}:0`, 'PUT', admin, { question: valid({ answer: -1 }) })).status, 400);
  assert.equal((await api(`${base}/${RAIL}:0`, 'PUT', admin, {})).status, 400);
  assert.equal((await api(`${base}/${RAIL}:99`, 'PUT', admin, { question: valid() })).status, 404);
  assert.equal((await api('/admin/practice/starter-packs/not-a-pack/questions', 'POST', admin, { question: valid() })).status, 404);
  // Duplicate wording within a pack is a conflict.
  const dup = qs(await api('/practice/starter-packs'), RAIL)[3].question;
  assert.equal((await api(base, 'POST', admin, { question: valid({ question: dup.toUpperCase() }) })).status, 409);
  assert.equal(JSON.stringify(qs(await api('/practice/starter-packs'), RAIL)), before);
});

test('a pack can never be emptied by deletes', async (t) => {
  const { api, admin } = await harness(t);
  const base = `/admin/practice/starter-packs/${RAIL}/questions`;
  const n = bundled['railways-rrb'].length;
  for (let i = 0; i < n - 1; i++) assert.equal((await api(`${base}/${RAIL}:${i}`, 'DELETE', admin)).status, 200);
  assert.equal((await api(`${base}/${RAIL}:${n - 1}`, 'DELETE', admin)).status, 409);
  assert.equal(qs(await api('/practice/starter-packs'), RAIL).length, 1);
});

test('the bundled JSON is never modified and still works as the offline fallback', () => {
  const merged = svc.mergePack(RAIL, []);
  assert.equal(merged.length, bundled['railways-rrb'].length);
  assert.deepEqual(merged.map((q) => q.answer), bundled['railways-rrb'].map((q) => q.answer));
});

// ── Frontend wiring (source-level, like the other admin UI tests) ─────────────
const fs = require('node:fs');
const path = require('node:path');
const fe = (f) => fs.readFileSync(path.join(__dirname, '..', 'exam-practice-pro', f), 'utf8');

test('admin Practice Library exposes the starter-pack editor with Railways-only add/delete', () => {
  const tab = fe('components/admin/practice-library-tab.tsx');
  const editor = fe('components/admin/starter-packs-editor.tsx');
  assert.match(tab, /<StarterPacksEditor \/>/);
  assert.match(editor, /\/practice\/starter-packs/);
  assert.match(editor, /pack\.canAddRemove/);            // add/delete gated by the server's capability flag
  assert.match(editor, /name="starter-pack-answer"/);     // exactly one correct answer (radio)
  assert.match(editor, /'DELETE'/);
});

test('learners load saved packs in practice mode with the bundled pack as fallback', () => {
  const mocks = fe('lib/mocks.ts');
  const sep = fe('lib/separate-exams.ts');
  const packs = fe('lib/starter-packs.ts');
  assert.match(packs, /\/api\/v1\/practice\/starter-packs/);
  assert.match(packs, /public: true/);                    // Free: no sign-in needed
  assert.match(mocks, /buildSeparatePractice\(id,await fetchStarterPacksOrNull\(\)\)\|\|separate/);
  assert.match(mocks, /separateSummaries\(savedPacks\)/);
  assert.match(sep, /tier:'free'/);
  assert.match(mocks, /Use Practice for this introductory question pack/);
  assert.match(mocks, /if\(mode!=='practice'\) return \{status:'error'/); // still practice-only
});
