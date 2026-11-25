'use strict';

const { Router } = require('express');
const practice = require('../services/practice-overrides.service');
const starterPacks = require('../services/starter-packs.service');

const router = Router();
router.get('/overrides', async (_req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, data: { overrides: await practice.listOverrides(), additions: await practice.listAdditions() } });
  } catch (error) { return next(error); }
});

// Free, public practice-only exam starter packs (Railways, Banking, UPSC) with admin edits applied.
// No authentication or plan is required, matching the bundled copies shipped with the site.
router.get('/starter-packs', async (_req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, data: { packs: await starterPacks.listPublic() } });
  } catch (error) { return next(error); }
});

module.exports = router;
