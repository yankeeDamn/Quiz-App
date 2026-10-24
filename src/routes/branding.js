'use strict';
const { Router } = require('express');
const { defaultBranding } = require('../data/branding');
const router = Router();
// Default preview only. Tenant-specific branding requires verified host mapping and persistent tenant storage.
router.get('/default', (_req,res) => res.json({ branding: defaultBranding }));
module.exports = router;
