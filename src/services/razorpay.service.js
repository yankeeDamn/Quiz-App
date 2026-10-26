'use strict';
const crypto = require('node:crypto');
const {nextExpiry} = require('./plan.service');
const db = require('../config/database');
const logger = require('../utils/logger');
const MONTHLY_PAISE = 19900;
const YEARLY_PAISE = 199000; // 10 months charged for 12 months of access.
const validId = /^(?:order|pay)_[A-Za-z0-9]{6,90}$/;
function enabled(){
 return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_WEBHOOK_SECRET &&
 process.env.RAZORPAY_CHECKOUT_ENABLED === 'true');
}
function planFor(term){
 if(term==='monthly') return {plan:'pro',months:1,amountPaise:MONTHLY_PAISE};
 if(term==='yearly') return {plan:'pro',months:12,amountPaise:YEARLY_PAISE};
 return null;
}
function safeEqual(left,right){
 const a=Buffer.from(String(left||''),'utf8'),b=Buffer.from(String(right||''),'utf8');
 return a.length===b.length && crypto.timingSafeEqual(a,b);
}
function verifyWebhook(raw,signature,secret) {
 if(!Buffer.isBuffer(raw)||!secret||!signature)return false;
 return safeEqual(crypto.createHmac('sha256',secret).update(raw).digest('hex'),signature);
}
async function createGatewayOrder(price){
 const basic=Buffer.from(process.env.RAZORPAY_KEY_ID+':'+process.env.RAZORPAY_KEY_SECRET).toString('base64');
 let response;
 try {
  response=await fetch('https://api.razorpay.com/v1/orders',{
   method:'POST',signal:AbortSignal.timeout(10000),
   headers:{'Content-Type':'application/json',Authorization:'Basic '+basic},
   body:JSON.stringify({amount:price.amountPaise,currency:'INR',receipt:'exampro-'+crypto.randomUUID().slice(0,18),notes:{product:'ExamPro',plan:'pro',months:String(price.months)}}),
  });
 } catch(e) {
  logger.warn({message:e.message},'Razorpay order request unavailable');
  throw Object.assign(new Error('Payment provider is unavailable'),{statusCode:502});
 }
 if(!response.ok) {
  logger.warn({status:response.status},'Razorpay declined order creation');
  throw Object.assign(new Error('Could not create a payment order'),{statusCode:502});
 }
 const order=await response.json();
 if(typeof order.id!=='string'||!validId.test(order.id)||order.amount!==price.amountPaise||order.currency!=='INR') {
  throw Object.assign(new Error('Invalid provider order response'),{statusCode:502});
 }
 return order;
}
/** Called only after RAW webhook HMAC validation. Lock the order and update plan atomically. */
async function capturePayment(payment,eventId) {
 const orderId=payment?.order_id,paymentId=payment?.id;
 if(typeof orderId!=='string'||!validId.test(orderId)||typeof paymentId!=='string'||!validId.test(paymentId)||
   !Number.isSafeInteger(payment.amount)||payment.currency!=='INR'||payment.status!=='captured') {
  throw Object.assign(new Error('Invalid captured payment'),{statusCode:400});
 }
 const client=await db.getClient();
 try {
  await client.query('BEGIN');
  const found=await client.query('SELECT * FROM payment_orders WHERE gateway_order_id=$1 FOR UPDATE',[orderId]);
  if(!found.rowCount)throw Object.assign(new Error('Unknown payment order'),{statusCode:404});
  const order=found.rows[0];
  if(Number(order.amount_paise)!==payment.amount||order.currency!=='INR'){
   throw Object.assign(new Error('Payment amount mismatch'),{statusCode:409});
  }
  if(order.status==='paid'){
   if(order.gateway_payment_id!==paymentId)throw Object.assign(new Error('Order already settled by another payment'),{statusCode:409});
   await client.query('COMMIT'); return {alreadyProcessed:true};
  }
  const userResult=await client.query('SELECT id,plan,plan_expires_at FROM users WHERE id=$1 FOR UPDATE',[order.user_id]);
  if(!userResult.rowCount)throw Object.assign(new Error('Payment account unavailable'),{statusCode:409});
  const user=userResult.rows[0];
  // Buying Pro must never demote an existing higher institute entitlement.
  if(user.plan==='institute'&&user.plan_expires_at&&new Date(user.plan_expires_at)>new Date()){
   throw Object.assign(new Error('Conflicting institute entitlement'),{statusCode:409});
  }
  const expiry=nextExpiry(user.plan_expires_at,order.months);
  await client.query(`UPDATE users SET plan='pro',plan_expires_at=$2,payment_status='paid',updated_at=NOW() WHERE id=$1`,[order.user_id,expiry]);
  await client.query(`INSERT INTO plan_grants (user_id,plan,months,amount_inr,note,expires_at)
       VALUES($1,'pro',$2,$3,$4,$5)`,[order.user_id,order.months,Math.round(order.amount_paise/100),'Razorpay '+paymentId,expiry]);
  await client.query(`UPDATE payment_orders SET status='paid',gateway_payment_id=$2,paid_at=NOW() WHERE id=$1`,[order.id,paymentId]);
  if(eventId)await client.query('INSERT INTO payment_webhook_events(event_id,gateway_order_id,gateway_payment_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[eventId,orderId,paymentId]);
  await client.query('COMMIT');
  return {alreadyProcessed:false};
 } catch(e){await client.query('ROLLBACK').catch(()=>{});throw e}
 finally{client.release()}
}
module.exports={enabled,planFor,verifyWebhook,createGatewayOrder,capturePayment};
