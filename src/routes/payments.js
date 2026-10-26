'use strict';
const {Router}=require('express');
const rateLimit=require('express-rate-limit');
const db=require('../config/database');
const {authenticateNextAuth}=require('../middleware/nextauth');
const {isPlanActive}=require('../services/plan.service');
const payment=require('../services/razorpay.service');
const logger=require('../utils/logger');
const router=Router();
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const checkoutLimit=rateLimit({windowMs:15*60*1000,max:10,standardHeaders:true,legacyHeaders:false});
const err=(res,status,message,code)=>res.status(status).json({success:false,error:{message,code}});
router.get('/config',(_req,res)=>{
 res.set('Cache-Control','no-store');
 res.json({success:true,data:{enabled:payment.enabled()}});
});
router.post('/orders',checkoutLimit,authenticateNextAuth,wrap(async(req,res)=>{
 if(!payment.enabled())return err(res,503,'Online checkout is not enabled. Use the existing payment contact method.','CHECKOUT_DISABLED');
 const price=req.body?.plan==='pro'?payment.planFor(req.body?.term):null;
 if(!price)return err(res,400,'Select a valid Pro billing term.','INVALID_PLAN');
 if(req.user.plan==='institute'&&isPlanActive(req.user.plan,req.user.planExpiresAt))return err(res,409,'Contact support to manage an existing institute plan.','INSTITUTE_PLAN');
 const gateway=await payment.createGatewayOrder(price);
 await db.query(`INSERT INTO payment_orders (user_id,gateway_order_id,plan,months,amount_paise)
      VALUES($1,$2,'pro',$3,$4)`,[req.user.id,gateway.id,price.months,price.amountPaise]);
 res.set('Cache-Control','no-store');
 return res.status(201).json({success:true,data:{
  keyId:process.env.RAZORPAY_KEY_ID,orderId:gateway.id,amount:price.amountPaise,currency:'INR',
  name:'ExamPro Pro',months:price.months
 }});
}));
router.get('/orders/:orderId',authenticateNextAuth,wrap(async(req,res)=>{
 if(!/^order_[A-Za-z0-9]{6,90}$/.test(req.params.orderId))return err(res,400,'Invalid order ID');
 const result=await db.query('SELECT status,paid_at,months FROM payment_orders WHERE gateway_order_id=$1 AND user_id=$2',
  [req.params.orderId,req.user.id]);
 if(!result.rowCount)return err(res,404,'Order not found');
 res.set('Cache-Control','private, no-store');
 return res.json({success:true,data:{status:result.rows[0].status,paidAt:result.rows[0].paid_at,months:result.rows[0].months}});
}));
router.post('/webhook',wrap(async(req,res)=>{
 // This route MUST receive untouched Buffer data via express.raw BEFORE JSON body parsing.
 if(!process.env.RAZORPAY_WEBHOOK_SECRET||!Buffer.isBuffer(req.body))return err(res,503,'Webhook unavailable');
 if(!payment.verifyWebhook(req.body,req.header('x-razorpay-signature'),process.env.RAZORPAY_WEBHOOK_SECRET)){
  return err(res,401,'Invalid webhook signature');
 }
 let event;
 try{event=JSON.parse(req.body.toString('utf8'))}catch{return err(res,400,'Invalid webhook data')}
 if(event?.event!=='payment.captured')return res.json({success:true,ignored:true});
 const data=event?.payload?.payment?.entity;
 const eventId=String(req.header('x-razorpay-event-id')||'').slice(0,150)||null;
 const result=await payment.capturePayment(data,eventId);
 logger.info({orderId:data.order_id,alreadyProcessed:result.alreadyProcessed},'Razorpay payment capture handled');
 return res.json({success:true});
}));
module.exports=router;
