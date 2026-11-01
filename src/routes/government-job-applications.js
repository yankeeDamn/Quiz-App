'use strict';

const { Router } = require('express');
const { authenticateNextAuth } = require('../middleware/nextauth');
const tracker = require('../services/government-job-applications.service');
const router = Router();
const wrap = handler => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
const ok = (res, data, code = 200) => res.status(code).json({ success: true, data });

// Completely separate from the existing PUBLIC /api/v1/government-jobs feed.
// No guest, admin API key or client-supplied user_id can authorize private records.
router.use((_req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  res.set('X-Robots-Tag', 'noindex, nofollow');
  next();
});
router.use(authenticateNextAuth);

router.get('/', wrap(async (req, res) => ok(res, await tracker.list(req.user.id))));
router.post('/', wrap(async (req, res) => ok(res, await tracker.create(req.user.id, req.body), 201)));
router.patch('/:id', wrap(async (req, res) => ok(res, await tracker.update(req.user.id, req.params.id, req.body))));
router.delete('/:id', wrap(async (req, res) => ok(res, await tracker.remove(req.user.id, req.params.id))));
router.get('/:id/reference', wrap(async (req, res) => ok(res, await tracker.reveal(req.user.id, req.params.id))));

module.exports = router;
