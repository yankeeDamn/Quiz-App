'use strict';
const { Router } = require('express');
const { authenticateNextAuth } = require('../middleware/nextauth');
const service = require('../services/exam-attempts.service');
const db = require('../config/database');
const {isPlanActive} = require('../services/plan.service');
const {buildAnalytics} = require('../services/exam-analytics');
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
router.get('/:id/analytics', wrap(async (req,res) => {
  if (!isPlanActive(req.user.plan, req.user.planExpiresAt)) {
    return res.status(403).json({success:false,error:{code:'PLAN_REQUIRED',message:'An active Pro plan is required for detailed analytics.'}});
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) {
    return res.status(400).json({success:false,error:{message:'Invalid attempt ID'}});
  }
  const {rows} = await db.query(
    'SELECT snapshot,result,started_at,submitted_at FROM exam_attempts_v2 WHERE id=$1 AND user_id=$2 AND submitted_at IS NOT NULL AND (snapshot->>\'adminDraft\') IS DISTINCT FROM \'true\'',
    [req.params.id,req.user.id]
  );
  if (!rows.length) return res.status(404).json({success:false,error:{message:'Completed attempt not found'}});
  res.set('Cache-Control','private, no-store');
  const a=rows[0];
  return ok(res,{report:buildAnalytics(a.snapshot,a.result,a.started_at,a.submitted_at)});
}));
router.put('/:id/progress', wrap(async (req,res) => ok(res,{ attempt:await service.save(req.user.id,req.params.id,req.body?.responses,false) })));
router.post('/:id/submit', wrap(async (req,res) => ok(res,{ attempt:await service.save(req.user.id,req.params.id,req.body?.responses,true) })));
module.exports = router;
