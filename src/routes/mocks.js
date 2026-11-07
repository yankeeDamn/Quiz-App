'use strict';

const { Router } = require('express');
const { param } = require('express-validator');
const { validate } = require('../middleware/validate');
const { allowNextAuthGuest } = require('../middleware/nextauth');
const { isPlanActive } = require('../services/plan.service');
const mocks = require('../services/mocks.service');
const db = require('../config/database');
const config = require('../config');
const { createHash } = require('node:crypto');
const { rateLimit } = require('express-rate-limit');

const router = Router();
router.use((_req,res,next)=>{res.set('Cache-Control','no-store');res.set('Vary','Authorization');next();});
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const previewLimiter = rateLimit({windowMs:60_000,limit:30,standardHeaders:'draft-7',legacyHeaders:false});
const previewVersion = preview => createHash('sha256').update(JSON.stringify(preview.questions)).digest('hex');
const validId = [param('id').matches(/^[a-z0-9-]{1,60}$/)], noPreview = res => res.status(404).json({success:false,error:{message:'Preview unavailable'}});

/**
 * GET /api/v1/mocks
 * Public catalogue. Lists every live test with its tier. No questions or answers.
 */
router.get('/', wrap(async (_req, res) => {
  res.json({ success: true, data: { tests: await mocks.listMocks() } });
}));

/**
 * GET /api/v1/mocks/stats
 * Read-only aggregates for public homepage; no drafts, answers, or user details exposed.
 * Bank totals include inactive questions but are explicitly labelled as such.
 */
router.get('/stats', wrap(async (_req, res) => {
  res.set('Cache-Control', 'public, max-age=30');
  const tests = await mocks.listMocks();
  let bankQuestions = 0;
  let availableQuestions = 0;
  if (config.databaseUrl) {
    const { rows } = await db.query(`
      SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE q.active AND t.active AND q.review_status='published' AND q.access_tier='free')::int AS available
      FROM mock_questions q
      JOIN mock_topics t ON t.id = q.topic_id
    `);
    bankQuestions = rows[0].total;
    availableQuestions = rows[0].available;
  } else {
    const bank = await mocks.loadBank();
    bankQuestions = bank.topics.reduce((n, t) => n + t.questions.length, 0);
    availableQuestions = bankQuestions;
  }
  return res.json({ success: true, data: {
    bankQuestions, availableQuestions,
    notYetAvailable: bankQuestions - availableQuestions,
    liveTests: tests.length,
    publishedMocks: tests.filter(t => t.kind === 'mock').length,
    topicTests: tests.filter(t => t.kind === 'topic').length,
  } });
}));

// Deliberately reveal only the same first five published, reviewed questions.
// Pagination, offsets and caller-selected question IDs are not supported.
router.get('/:id/preview', previewLimiter, validId, validate, wrap(async(req,res)=>{
  const preview = await mocks.previewMock(req.params.id);
  if (!preview) return noPreview(res);
  return res.json({success:true,data:{preview:{id:preview.summary.id,name:preview.summary.name,
    version:previewVersion(preview),questionCount:preview.questions.length,fullQuestionCount:preview.summary.questionCount,
    questions:preview.questions.map(({answer,explanation,...q})=>q)}}});
}));
router.post('/:id/preview/submit', previewLimiter, validId, validate, wrap(async(req,res)=>{
  const preview = await mocks.previewMock(req.params.id);
  if (!preview) return noPreview(res);
  const answers = req.body?.answers;
  if (req.body?.version !== previewVersion(preview)) return res.status(409).json({success:false,error:{message:'Preview changed. Reopen it to load the latest version.'}});
  if (!Array.isArray(answers) || answers.length !== preview.questions.length ||
      answers.some(a=>!Number.isInteger(a)||a < -1||a > 3))
    return res.status(400).json({success:false,error:{message:'Provide one option (0–3), or -1 to skip, for each preview question.'}});
  return res.json({success:true,data:{result:{total:preview.questions.length,
    correct:preview.questions.filter((q,i)=>q.answer===answers[i]).length,
    solutions:preview.questions.map(q=>({id:q.id,answer:q.answer,explanation:q.explanation}))}}});
}));

/**
 * GET /api/v1/mocks/:id
 * Free tests are open to everyone. Premium tests need a signed-in user with a
 * running plan; the questions and answers are never sent otherwise.
 */
router.get(
  '/:id',
  [param('id').isString().matches(/^[a-z0-9-]{1,60}$/).withMessage('Invalid test id')],
  validate,
  allowNextAuthGuest,
  wrap(async (req, res) => {
    const found = await mocks.findMock(req.params.id);
    if (!found) {
      return res.status(404).json({ success: false, error: { message: 'Test not found' } });
    }

    if (mocks.isPaidTier(found.tier)) {
      if (req.isGuest) {
        return res.status(401).json({
          success: false,
          error: { code: 'SIGN_IN_REQUIRED', message: 'Sign in to open this premium mock.' },
          data: { test: found.summary },
        });
      }
      if (!await require('../services/monetization.service').mockAccess(req.user,found.summary)) {
        return res.status(403).json({
          success: false,
          error: { code: 'PLAN_REQUIRED', message: 'This mock is part of the Pro plan.' },
          data: { test: found.summary },
        });
      }
    }

    const test = found.build();
    // A scored test must NEVER reveal its correct answers or explanations.
    test.questions = test.questions.map(({ answer, explanation, ...question }) => question);
    return res.json({ success: true, data: { test } });
  })
);

/** Explicit unscored practice only: answers may be revealed by the tutor UI. */
router.get('/:id/practice', allowNextAuthGuest, wrap(async (req,res) => {
  const found = await mocks.findMock(req.params.id);
  if (!found || found.summary.kind !== 'topic' || found.tier !== 'free') {
    return res.status(404).json({success:false,error:{message:'Practice unavailable'}});
  }
  return res.json({success:true,data:{test:found.build()}});
}));

module.exports = router;
