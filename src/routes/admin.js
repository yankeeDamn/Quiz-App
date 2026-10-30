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
const exams = require('../services/exam-attempts.service');
const draftGate = require('../services/draft-testing-gate');
const quality = require('../services/mock-quality.service');
const releaseReadiness = require('../services/mock-release-readiness.service');
const betaInvitations = require('../services/beta-invitations.service');
const { isFullCglMock } = require('../services/ssc-full-mock-classifier');
const accommodations = require('../services/ssc-accommodations.service');
const importer = require('../services/question-import');
const cglPipeline = require('../services/ssc-content-pipeline.service');
const { PAID_PLANS, MAX_MONTHS, isPlanActive } = require('../services/plan.service');

const EMAIL_OPTS = { gmail_remove_dots: false, gmail_remove_subaddress: false, gmail_convert_googlemaildotcom: false };
const UUID = /^[0-9a-f-]{36}$/i;
const SLUG = /^[a-z0-9-]{1,60}$/;

const router = Router();
const practiceOverrides = require('../services/practice-overrides.service');

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

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, private');
  res.set('Vary', 'Authorization, X-Admin-Key');
  res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
});
router.use(adminLimiter, requireAdmin);

router.get('/me', (req, res) => ok(res, { via: req.admin.via, email: req.admin.email }));

// Edits to the existing frontend-bundled free practice library.
// Answers are already part of those client-side practice-only quizzes;
// never use this endpoint for the server-scored mock-test bank.
router.put('/practice/questions/:source/:id', wrap(async (req, res) => {
  try {
    const question = await practiceOverrides.saveOverride(req.params.source, req.params.id, req.body?.question);
    return ok(res, { question });
  } catch (error) {
    if (/^(Unknown practice|Question ID|Provide a question|Certification questions|Homepage question|Options must|Correct answers)/.test(error.message)) {
      return bad(res, error.message, 400);
    }
    throw error;
  }
}));

// New practice-only questions are validated and assigned server-generated unique IDs.
router.post('/practice/questions', wrap(async (req, res) => {
  try {
    const { source, groupId, question } = req.body || {};
    const addition = await practiceOverrides.addQuestion(source, groupId, question);
    return ok(res, { addition });
  } catch (error) {
    if (/^(Unknown practice|Question ID|Provide a question|Certification questions|Certification code|Homepage question|Options must|Correct answers)/.test(error.message)) {
      return bad(res, error.message, 400);
    }
    throw error;
  }
}));

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

// ── Staging-only private exam QA ─────────────────────
// Admin route middleware (verified OAuth/allowlist) runs before this gate.
// Automation/admin API keys do not grant the power to take draft tests.
function requireDraftTester(req, res, next) {
  if (!draftGate.enabled()) return bad(res, 'Draft testing is disabled outside the isolated staging environment.', 404);
  if (req.admin?.via !== 'account' || !req.user?.id) return bad(res, 'Verified admin sign-in required.', 403);
  return next();
}

router.get('/draft-testing/status', (req,res) => ok(res, {
  enabled: draftGate.enabled() && req.admin?.via === 'account',
}));

router.post('/tests/:id/draft-attempt', requireDraftTester, wrap(async(req,res)=>{
  if (!SLUG.test(req.params.id)) return bad(res,'Invalid draft test ID',400);
  return ok(res,{attempt:await exams.start(req.user,req.params.id,true)});
}));

router.get('/draft-attempts/:id',requireDraftTester,wrap(async(req,res)=>{
  return ok(res,{attempt:await exams.get(req.user.id,req.params.id,true)});
}));

router.put('/draft-attempts/:id/progress',requireDraftTester,wrap(async(req,res)=>{
  return ok(res,{attempt:await exams.save(req.user.id,req.params.id,req.body?.responses,false,true)});
}));

router.post('/draft-attempts/:id/submit',requireDraftTester,wrap(async(req,res)=>{
  return ok(res,{attempt:await exams.save(req.user.id,req.params.id,req.body?.responses,true,true)});
}));

// ── Academic and bilingual review (verified human admin accounts only) ──
// API keys can automate imports, but cannot claim independent human approval.
function requireHumanReviewer(req,res,next) {
  if(req.admin?.via!=='account'||!req.admin?.email) return bad(res,'Signed-in reviewer required.',403);
  next();
}
// Summary only: no answer keys, no review mutations, and no publish operation.
router.get('/tests/:id/release-readiness',requireHumanReviewer,wrap(async(req,res)=>{
  if(!SLUG.test(req.params.id))return bad(res,'Invalid test ID',400);
  res.set('Cache-Control','private, no-store');
  return ok(res,await releaseReadiness.report(req.params.id));
}));
router.get('/tests/:id/reviews',requireHumanReviewer,wrap(async(req,res)=>{
  if(!SLUG.test(req.params.id))return bad(res,'Invalid test ID',400);
  return ok(res,await quality.list(req.params.id));
}));
router.put('/tests/:id/reviews/:questionId',requireHumanReviewer,wrap(async(req,res)=>{
  if(!SLUG.test(req.params.id)||!/^[0-9a-f-]{36}$/i.test(req.params.questionId))
    return bad(res,'Invalid review IDs',400);
  return ok(res,await quality.update(req.params.id,req.params.questionId,req.body,req.admin.email));
}));

// Eligible-candidate timing must be individually authorized; this endpoint
// records no health data and cannot be called by exam takers themselves.
router.put('/tests/:id/accommodations',requireHumanReviewer,wrap(async(req,res)=>{
  if(!draftGate.enabled())return bad(res,'Staging QA accommodations only.',404);
  if(!SLUG.test(req.params.id)||typeof req.body?.approved!=='boolean')
    return bad(res,'Valid test ID and approved boolean required.',400);
  if(req.body.approved && req.body.eligibilityChecked!==true)
    return bad(res,'Admin must confirm eligibility was verified outside ExamPro.',400);
  return ok(res,await accommodations.setApproved(req.params.id,req.body.email,req.body.approved,req.admin.email));
}));

// Only verified human administrators may grant or revoke staging beta access.
// The raw random code is returned once; no admin role is given to the invitee.
router.post('/beta/invitations',requireHumanReviewer,wrap(async(req,res)=>{
 const invite=await betaInvitations.create(req.body?.email,req.body?.hours,req.admin.email);
 return ok(res,invite);
}));
router.post('/beta/invitations/:id/revoke',requireHumanReviewer,wrap(async(req,res)=>{
 return ok(res,await betaInvitations.revoke(req.params.id));
}));

// Staging, signed-in human admin only. These endpoints never write to DB.
router.post('/content-pipeline/preview',requireHumanReviewer,wrap(async(req,res)=>{
 return ok(res,await cglPipeline.preview(req.body?.number,req.body?.questions));
}));
router.post('/content-pipeline/stage-draft',requireHumanReviewer,wrap(async(req,res)=>{
 if(req.body?.confirmDraftOnly!==true)return bad(res,'Explicit draft-only confirmation required.',400);
 return ok(res,await cglPipeline.stage(req.body?.number,req.body?.questions));
}));
router.get('/content-pipeline/dashboard',requireHumanReviewer,wrap(async(req,res)=>{
 return ok(res,await cglPipeline.dashboard());
}));

// ── Mock tests ─────────────────────────────────────────

router.get('/tests', wrap(async (_req, res) => ok(res, { tests: await content.listTests() })));

router.get('/tests/:id/preview', wrap(async (req,res)=>{
  if(!SLUG.test(req.params.id))return bad(res,'Bad test id');
  const definition=(await content.listTests()).find(t=>t.id===req.params.id);
  if(!definition)return bad(res,'Test not found',404);
  return ok(res,await content.previewTest(definition));
}));

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
  if(active){
    // A private preview intentionally reads inactive topics; do not use it as
    // evidence that the *public* catalogue will expose the complete paper.
    const readiness = await content.publicationReadiness({...r.value,id:req.params.id});
    if(!readiness.ok)return bad(res,readiness.error,409);
    // Academic/Hindi sign-off is a separate mandatory gate from merely
    // having 100 live database rows. It never self-approves content.
    if (isFullCglMock({ ...r.value, id: req.params.id })) {
      const editorial=await quality.readiness(req.params.id);
      if(!editorial.ok)return bad(res,editorial.error,409);
    }
  }
  return (await content.updateTest(req.params.id, r.value, active)) ? ok(res, {}) : bad(res, 'Test not found', 404);
}));

module.exports = router;
