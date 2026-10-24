'use strict';

const { Router } = require('express');
const { param } = require('express-validator');
const { validate } = require('../middleware/validate');
const { allowNextAuthGuest } = require('../middleware/nextauth');
const { isPlanActive } = require('../services/plan.service');
const mocks = require('../services/mocks.service');

const router = Router();

/**
 * GET /api/v1/mocks
 * Public catalogue. Lists every test with its tier. No questions or answers.
 */
router.get('/', (_req, res) => {
  res.json({ success: true, data: { tests: mocks.listMocks() } });
});

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
  (req, res) => {
    const def = mocks.getDefinition(req.params.id);
    if (!def) {
      return res.status(404).json({ success: false, error: { message: 'Test not found' } });
    }

    if (def.tier === 'premium') {
      if (req.isGuest) {
        return res.status(401).json({
          success: false,
          error: { code: 'SIGN_IN_REQUIRED', message: 'Sign in to open this premium mock.' },
          data: { test: mocks.listMocks().find((t) => t.id === def.id) },
        });
      }
      if (!isPlanActive(req.user.plan, req.user.planExpiresAt)) {
        return res.status(403).json({
          success: false,
          error: { code: 'PLAN_REQUIRED', message: 'This mock is part of the Pro plan.' },
          data: { test: mocks.listMocks().find((t) => t.id === def.id) },
        });
      }
    }

    return res.json({ success: true, data: { test: mocks.buildMock(def) } });
  }
);

module.exports = router;
