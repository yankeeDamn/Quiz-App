'use strict';
const { Router } = require('express');
const { authenticateNextAuth } = require('../middleware/nextauth');
const service = require('../services/exam-attempts.service');
const router = Router();
const wrap = fn => (req,res,next) => Promise.resolve(fn(req,res)).catch(next);
const ok = (res,data) => res.json({ success:true, data });
router.use(authenticateNextAuth);
router.get('/', wrap(async (req,res) => ok(res, { attempts: await service.history(req.user.id) })));
router.post('/start', wrap(async (req,res) => {
  const attempt = await service.start(req.user, String(req.body?.testId || ''));
  return ok(res,{ attempt });
}));
router.get('/:id', wrap(async (req,res) => ok(res,{ attempt:await service.get(req.user.id,req.params.id) })));
router.put('/:id/progress', wrap(async (req,res) => ok(res,{ attempt:await service.save(req.user.id,req.params.id,req.body?.responses,false) })));
router.post('/:id/submit', wrap(async (req,res) => ok(res,{ attempt:await service.save(req.user.id,req.params.id,req.body?.responses,true) })));
module.exports = router;
