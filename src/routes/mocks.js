'use strict';

const { Router } = require('express');
const { param } = require('express-validator');
const { validate } = require('../middleware/validate');
const { allowNextAuthGuest } = require('../middleware/nextauth');
const { isPlanActive } = require('../services/plan.service');
const mocks = require('../services/mocks.service');

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
