'use strict';

const crypto = require('crypto');
const { Router } = require('express');
const { body, query } = require('express-validator');
const config = require('../config');
const logger = require('../utils/logger');
const { validate } = require('../middleware/validate');
const { adminLimiter } = require('../middleware/rate-limiter');
const { authenticateNextAuth } = require('../middleware/nextauth');
const userService = require('../services/user.service');
const content = require('../services/content.service');
const importer = require('../services/question-import');
const { PAID_PLANS, MAX_MONTHS, isPlanActive } = require('../services/plan.service');

const EMAIL_OPTS = { gmail_remove_dots: false, gmail_remove_subaddress: false, gmail_convert_googlemaildotcom: false };
const UUID = /^[0-9a-f-]{36}$/i;
const SLUG = /^[a-z0-9-]{1,60}$/;

const router = Router();

function keyMatches(given) {
  const a = Buffer.from(String(given || ''));
  const b = Buffer.from(config.adminKey);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Two ways in:
 *  1. x-admin-key header equal to ADMIN_API_KEY (for curl and scripts).
 *  2. A signed-in Google or GitHub account whose email is in ADMIN_EMAILS (for the /admin page).
 */
function requireAdmin(req, res, next) {
  if (!config.adminKey && config.adminEmails.length === 0) {
    return res.status(503).json({
      success: false,
      error: { message: 'Admin is switched off. Set ADMIN_EMAILS (and optionally ADMIN_API_KEY).' },
    });
  }

  if (req.headers['x-admin-key']) {
    if (config.adminKey && keyMatches(req.headers['x-admin-key'])) {
      req.admin = { via: 'key', email: null };
      return next();
    }
    logger.warn({ ip: req.ip }, 'Admin request with a wrong key');
    return res.status(401).json({ success: false, error: { message: 'Invalid admin key' } });
  }

  return authenticateNextAuth(req, res, () => {
    const email = String((req.user && req.user.email) || '').toLowerCase();
    if (email && config.adminEmails.includes(email)) {
      req.admin = { via: 'account', email };
      return next();
    }
    logger.warn({ email: email || 'none' }, 'Signed-in user tried the admin API');
    return res.status(403).json({ success: false, error: { message: 'This account is not an admin.' } });
  });
}

function present(user) {
  return {
    email: user.email,
    name: user.name,
    plan: user.plan || 'free',
    planActive: isPlanActive(user.plan, user.plan_expires_at),
    planExpiresAt: user.plan_expires_at,
  };
}

const ok = (res, data) => res.json({ success: true, data });
const bad = (res, message, status = 400) => res.status(status).json({ success: false, error: { message } });
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(adminLimiter, requireAdmin);

router.get('/me', (req, res) => ok(res, { via: req.admin.via, email: req.admin.email }));

// ── Plans ──────────────────────────────────────────────

router.get('/users', [query('q').optional().isString().isLength({ max: 100 })], validate, wrap(async (req, res) => {
  ok(res, { users: (await content.searchUsers(req.query.q || '')).map((u) => ({ ...u, planActive: isPlanActive(u.plan, u.plan_expires_at) })) });
}));

router.get('/user', [query('email').isEmail().normalizeEmail(EMAIL_OPTS)], validate, wrap(async (req, res) => {
  const user = await userService.getByEmail(req.query.email);
  if (!user) return bad(res, 'No user with this email', 404);
  return ok(res, present(user));
}));

router.get('/grants', wrap(async (_req, res) => ok(res, { grants: await content.recentGrants() })));

router.post(
  '/grant',
  [
    body('email').isEmail().normalizeEmail(EMAIL_OPTS),
    body('plan').isIn(PAID_PLANS),
    body('months').isInt({ min: 1, max: MAX_MONTHS }).toInt(),
    body('amountInr').optional({ values: 'falsy' }).isInt({ min: 0 }).toInt(),
    body('note').optional().isString().isLength({ max: 255 }),
  ],
  validate,
  wrap(async (req, res) => {
    const { email, plan, months, amountInr, note } = req.body;
    const user = await userService.grantPlan({ email, plan, months, amountInr, note });
    logger.info({ email, plan, months, by: req.admin.via }, 'Plan granted');
    ok(res, present(user));
  })
);

router.post('/revoke', [body('email').isEmail().normalizeEmail(EMAIL_OPTS)], validate, wrap(async (req, res) => {
  const user = await userService.revokePlan(req.body.email);
  if (!user) return bad(res, 'No user with this email', 404);
  logger.info({ email: req.body.email, by: req.admin.via }, 'Plan revoked');
  return ok(res, present(user));
}));

// ── Topics and questions ───────────────────────────────

router.get('/topics', wrap(async (_req, res) => ok(res, { topics: await content.listTopics() })));

router.post('/topics', wrap(async (req, res) => {
  const r = await content.createTopic(req.body || {});
  return r.ok ? ok(res, r.value) : bad(res, r.error);
}));

router.put('/topics/:id', wrap(async (req,res) => {
  if (!SLUG.test(req.params.id)) return bad(res,'Bad topic id');
  const result=await content.updateTopic(req.params.id,req.body||{});
  return result.ok ? ok(res,result.value) : bad(res,result.error);
}));

router.post('/topics/:id/active', [body('active').isBoolean().toBoolean()], validate, wrap(async (req, res) => {
  if (!SLUG.test(req.params.id)) return bad(res, 'Bad topic id');
  return (await content.setTopicActive(req.params.id, req.body.active)) ? ok(res, {}) : bad(res, 'Topic not found', 404);
}));

router.get('/topics/:id/questions', wrap(async (req, res) => {
  if (!SLUG.test(req.params.id)) return bad(res, 'Bad topic id');
  return ok(res, { questions: await content.listQuestions(req.params.id) });
}));

/** Validate and import CSV-mapped question rows; no partial writes. */
router.post('/topics/:id/questions/preview', wrap(async (req,res) => {
  if(!SLUG.test(req.params.id))return bad(res,'Bad topic id');
  if(!await content.topicExists(req.params.id))return bad(res,'Topic not found',404);
  return ok(res,await importer.preview(req.params.id,req.body?.questions));
}));
router.post('/topics/:id/import', wrap(async (req,res) => {
  if(!SLUG.test(req.params.id))return bad(res,'Bad topic id');
  return ok(res,await importer.importRows(req.params.id,req.body?.questions));
}));

/** Body: { questions: [{ question, options: [4], answer: 0-3, explanation }] }. Up to 200 at once. */
router.post('/topics/:id/questions', wrap(async (req, res) => {
  if (!SLUG.test(req.params.id)) return bad(res, 'Bad topic id');
  if (!(await content.topicExists(req.params.id))) return bad(res, 'Topic not found', 404);
  const list = Array.isArray(req.body && req.body.questions) ? req.body.questions : [];
  if (list.length < 1 || list.length > 200) return bad(res, 'Send 1 to 200 questions.');
  const values = [];
  for (let i = 0; i < list.length; i += 1) {
    const r = content.checkQuestion(list[i]);
    if (!r.ok) return bad(res, `Question ${i + 1}: ${r.error}`);
    values.push(r.value);
  }
  const added = await content.addQuestions(req.params.id, values);
  logger.info({ topic: req.params.id, added, by: req.admin.via }, 'Questions added');
  return ok(res, { added });
}));

router.put('/questions/:qid', wrap(async (req, res) => {
  if (!UUID.test(req.params.qid)) return bad(res, 'Bad question id');
  const r = content.checkQuestion(req.body);
  if (!r.ok) return bad(res, r.error);
  return (await content.updateQuestion(req.params.qid, r.value)) ? ok(res, {}) : bad(res, 'Question not found', 404);
}));

router.post('/questions/:qid/active', [body('active').isBoolean().toBoolean()], validate, wrap(async (req, res) => {
  if (!UUID.test(req.params.qid)) return bad(res, 'Bad question id');
  return (await content.setQuestionActive(req.params.qid, req.body.active)) ? ok(res, {}) : bad(res, 'Question not found', 404);
}));

// ── Mock tests ─────────────────────────────────────────

router.get('/tests', wrap(async (_req, res) => ok(res, { tests: await content.listTests() })));

router.post('/tests', wrap(async (req, res) => {
  const r = content.checkTest(req.body, await content.topicIds());
  if (!r.ok) return bad(res, r.error);
  const made = await content.createTest(req.body.id, r.value);
  return made.ok ? ok(res, made.value) : bad(res, made.error);
}));

router.put('/tests/:id', wrap(async (req, res) => {
  if (!SLUG.test(req.params.id)) return bad(res, 'Bad test id');
  const r = content.checkTest(req.body, await content.topicIds());
  if (!r.ok) return bad(res, r.error);
  const active = req.body.active === true;
  return (await content.updateTest(req.params.id, r.value, active)) ? ok(res, {}) : bad(res, 'Test not found', 404);
}));

module.exports = router;
