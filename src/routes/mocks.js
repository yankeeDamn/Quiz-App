'use strict';

const { Router } = require('express');
const { param } = require('express-validator');
const { validate } = require('../middleware/validate');
const { allowNextAuthGuest } = require('../middleware/nextauth');
const { isPlanActive } = require('../services/plan.service');
const mocks = require('../services/mocks.service');
const db = require('../config/database');
const config = require('../config');
const db = require('../config/database');
const config = require('../config');

const router = Router();
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

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
        COUNT(*) FILTER (WHERE q.active AND t.active)::int AS available
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

/**
 * Public topic discovery for the four competitive bank groups.
 * Draft question TEXT and answers are never exposed. Disabled groups cannot be taken.
 * Includes review status rather than quietly publishing unreviewed content.
 */
router.get('/competitive-topics', wrap(async (_req, res) => {
  res.set('Cache-Control', 'public, max-age=30');
  if (!config.databaseUrl) {
    return res.json({success:true,data:{topics:[]}});
  }
  const { rows } = await db.query(`
    SELECT t.id, t.name, t.category, t.active,
           COUNT(q.*)::int AS "questionCount",
           COUNT(q.*) FILTER (WHERE q.active)::int AS "activeQuestionCount"
      FROM mock_topics t
      LEFT JOIN mock_questions q ON q.topic_id = t.id
     WHERE t.id LIKE 'comp-%'
     GROUP BY t.id
     ORDER BY t.id
  `);
  return res.json({success:true,data:{topics:rows.map(t=>({
    ...t, available: t.active && t.activeQuestionCount > 0,
    practiceTestId: 'topic-' + t.id,
  }))}});
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

    if (found.tier === 'premium') {
      if (req.isGuest) {
        return res.status(401).json({
          success: false,
          error: { code: 'SIGN_IN_REQUIRED', message: 'Sign in to open this premium mock.' },
          data: { test: found.summary },
        });
      }
      if (!isPlanActive(req.user.plan, req.user.planExpiresAt)) {
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
