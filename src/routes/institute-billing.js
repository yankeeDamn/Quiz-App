'use strict';
// Mounted after institute verified identity and per-user rate limit.
const router=require('express').Router(),s=require('../services/institutes/billing');
const wrap=fn=>(q,r,n)=>Promise.resolve(fn(q,r)).catch(n),ok=(r,data,status=200)=>r.status(status).json({success:true,data});
router.use((_q,_r,n)=>process.env.INSTITUTE_BILLING_ENABLED==='true'?n():n('router'));
router.get('/platform/institutes/billing/plans',wrap(async(q,r)=>ok(r,{plans:await s.plans(q.user)})));
router.put('/platform/institutes/billing/plans',wrap(async(q,r)=>ok(r,await s.savePlan(q.user,q.body))));
router.post('/platform/institutes/:id/billing/quotes',wrap(async(q,r)=>ok(r,await s.quote(q.user,q.params.id,q.body.planCode),201)));
router.get('/institutes/:slug/billing',wrap(async(q,r)=>ok(r,await s.overview(q.user,q.params.slug))));
router.post('/institutes/:slug/billing/orders/:id/checkout',wrap(async(q,r)=>ok(r,await s.createOrder(q.user,q.params.slug,q.params.id,q.body.phone))));
router.post('/institutes/:slug/billing/orders/:id/reconcile',wrap(async(q,r)=>ok(r,await s.reconcile(q.user,q.params.slug,q.params.id))));
router.post('/institutes/:slug/billing/cancel',wrap(async(q,r)=>ok(r,await s.cancel(q.user,q.params.slug))));
router.post('/institutes/:slug/billing/orders/:id/cancel-quote',wrap(async(q,r)=>ok(r,await s.cancelQuote(q.user,q.params.slug,q.params.id))));
module.exports=router;
