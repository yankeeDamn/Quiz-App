'use strict';
const {Router}=require('express');
const {authenticateNextAuth}=require('../middleware/nextauth');
const cashfree=require('../services/cashfree-sandbox.service');
const router=Router();
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
router.use((req,res,next)=>{res.set('Cache-Control','private, no-store');res.set('X-Robots-Tag','noindex, nofollow');next();});
// This route receives the original unmodified JSON bytes, BEFORE express.json.
// Cryptographic verification is mandatory and must precede all business logic.
router.post('/webhook',wrap(async(req,res)=>{
 const raw=req.body;
 await cashfree.processWebhook(raw,req.get('x-webhook-signature'),req.get('x-webhook-timestamp'));
 res.json({success:true});
}));
router.use(authenticateNextAuth);
router.get('/status',(_req,res)=>res.json({success:true,data:{sandboxEnabled:Boolean(cashfree.enabled())}}));
router.post('/orders',wrap(async(req,res)=>{
 const result=await cashfree.create(req.user,req.body?.period,req.body?.phone);
 res.status(201).json({success:true,data:result});
}));
router.get('/orders',wrap(async(req,res)=>res.json({success:true,data:await cashfree.history(req.user)})));
module.exports=router;
