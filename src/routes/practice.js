'use strict';

const { Router } = require('express');
const practice = require('../services/practice-overrides.service');

const router = Router();
router.get('/overrides', async (_req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, data: { overrides: await practice.listOverrides() } });
  } catch (error) { return next(error); }
});

module.exports = router;
