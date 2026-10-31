'use strict';
const crypto=require('node:crypto');
const db=require('../config/database');
const gate=require('./draft-testing-gate');
const {nextExpiry}=require('./plan.service');
const FRONTEND='https://exampro-staging-ui.vercel.app';
const API_PROD='https://quiz-app-regd.onrender.com';
const API_VERSION='2025-01-01';
const BASE='https://sandbox.cashfree.com/pg';
const prices={monthly:{amount:199,months:1},yearly:{amount:1990,months:12}};
const fail=(message,statusCode=400)=>Object.assign(new Error(message),{statusCode});
function enabled(){
 const api=String(process.env.CASHFREE_SANDBOX_API_ORIGIN||'');
 return gate.enabled()&&process.env.CASHFREE_SANDBOX_ENABLED==='true'&&
 process.env.CASHFREE_ENV==='sandbox'&&
 process.env.CASHFREE_APP_ID&&process.env.CASHFREE_SECRET_KEY&&
 /^https:\/\/[a-z0-9-]+\.onrender\.com$/.test(api)&&api!==API_PROD&&
 process.env.CASHFREE_SANDBOX_FRONTEND_ORIGIN===FRONTEND;
}
function guard(){if(!enabled())throw fail('Cashfree sandbox checkout is disabled.',404);}
async function gateway(method,path,body,requestId){
 guard();
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),10000);
 try{
  const response=await fetch(BASE+path,{method,signal:controller.signal,headers:{
   'x-api-version':API_VERSION,'x-client-id':process.env.CASHFREE_APP_ID,
   'x-client-secret':process.env.CASHFREE_SECRET_KEY,
   'Content-Type':'application/json',...(requestId?{'x-idempotency-key':requestId}:{})
  },...(body?{body:JSON.stringify(body)}:{})});
  const result=await response.json().catch(()=>null);
  if(!response.ok||!result)throw fail('Sandbox payment provider unavailable. Retry later.',502);
  return result;
 }catch(e){if(e.statusCode)throw e;throw fail('Sandbox payment provider unavailable. Retry later.',502);}
 finally{clearTimeout(timeout);}
}
function price(period){if(!Object.hasOwn(prices,period))throw fail('Only monthly or yearly Pro checkout is supported.');return prices[period];}
function verifySignature(raw,signature,timestamp){
 guard();
 if(!Buffer.isBuffer(raw)||raw.length===0||raw.length>65536||
 !/^[A-Za-z0-9+/]+={0,2}$/.test(String(signature||''))||!/^[0-9]{10,14}$/.test(String(timestamp||'')))
  throw fail('Invalid webhook signature.',401);
 const expected=crypto.createHmac('sha256',process.env.CASHFREE_SECRET_KEY).update(timestamp).update(raw).digest('base64');
 const a=Buffer.from(signature),b=Buffer.from(expected);
 if(a.length!==b.length||!crypto.timingSafeEqual(a,b))throw fail('Invalid webhook signature.',401);
 return true;
}
async function create(user,period,phone){
 guard();
 if(!user?.id||!user.email)throw fail('Verified sign-in required.',401);
 const p=price(period);
 if(typeof phone!=='string'||!/^[6-9][0-9]{9}$/.test(phone))throw fail('Valid Indian mobile number required.');
 const id='cf_sbx_'+crypto.randomUUID().replace(/-/g,'');
 await db.query(`INSERT INTO cashfree_sandbox_orders(id,user_id,billing_period,months,amount_inr)
 VALUES($1,$2,$3,$4,$5)`,[id,user.id,period,p.months,p.amount]);
 let remote;
 try{
  remote=await gateway('POST','/orders',{
   order_id:id,order_amount:p.amount,order_currency:'INR',
   customer_details:{customer_id:user.id,customer_email:user.email,customer_phone:phone},
   order_meta:{
    return_url:FRONTEND+'/pricing?cashfree_return=1&order_id={order_id}',
    notify_url:process.env.CASHFREE_SANDBOX_API_ORIGIN+'/api/v1/cashfree/webhook'
   },order_note:'ExamPro sandbox Pro access'
  },id);
  if(remote.order_id!==id||typeof remote.payment_session_id!=='string'||!remote.payment_session_id)
   throw fail('Invalid provider order response.',502);
  await db.query("UPDATE cashfree_sandbox_orders SET status='pending' WHERE id=$1 AND status='initiated'",[id]);
 }catch(e){await db.query("UPDATE cashfree_sandbox_orders SET status='failed' WHERE id=$1 AND status='initiated'",[id]).catch(()=>{});throw e;}
 return {orderId:id,paymentSessionId:remote.payment_session_id,mode:'sandbox',amountInr:p.amount};
}
function fingerprint(raw){return crypto.createHash('sha256').update(raw).digest('hex');}
async function processWebhook(raw,signature,timestamp){
 verifySignature(raw,signature,timestamp);
 let event;try{event=JSON.parse(raw.toString('utf8'));}catch{throw fail('Malformed webhook.',400);}
 const id=event?.data?.order?.order_id;
 if(!/^cf_sbx_[0-9a-f]{32}$/.test(String(id||'')))throw fail('Unknown sandbox order.',400);
 const type=String(event.type||'');
 const payment=event?.data?.payment;
 const isSuccess=type==='PAYMENT_SUCCESS_WEBHOOK'&&payment?.payment_status==='SUCCESS';
 // Independently fetch order status from Cashfree; never trust payload/return URL for grant.
 const verified=isSuccess?await gateway('GET','/orders/'+encodeURIComponent(id)):null;
 const client=await db.getClient();
 try{
  await client.query('BEGIN');
  const r=await client.query('SELECT * FROM cashfree_sandbox_orders WHERE id=$1 FOR UPDATE',[id]);
  if(!r.rowCount){await client.query('ROLLBACK');throw fail('Order not found.',404);}
  const local=r.rows[0];
  const fp=fingerprint(raw);
  const seen=await client.query('SELECT fingerprint FROM cashfree_sandbox_webhook_events WHERE fingerprint=$1',[fp]);
  if(seen.rowCount){await client.query('COMMIT');return {duplicate:true,paid:local.status==='paid'};}
  const verifiedPaid=Boolean(isSuccess&&verified?.order_id===id&&verified?.order_status==='PAID'&&
   verified?.order_currency==='INR'&&Number(verified?.order_amount)===Number(local.amount_inr)&&
   event?.data?.order?.order_currency==='INR'&&Number(event?.data?.order?.order_amount)===Number(local.amount_inr)&&
   payment?.cf_payment_id);
  let outcome='ignored';
  if(verifiedPaid&&local.status!=='paid'){
   const user=await client.query('SELECT id,plan,plan_expires_at FROM users WHERE id=$1 FOR UPDATE',[local.user_id]);
   if(!user.rowCount)throw fail('Payment user missing.',409);
   const expires=nextExpiry(user.rows[0].plan_expires_at,local.months);
   await client.query(`UPDATE cashfree_sandbox_orders SET status='paid',cf_payment_id=$2,paid_at=NOW(),granted_at=NOW() WHERE id=$1`,[id,String(payment.cf_payment_id)]);
   await client.query(`UPDATE users SET plan='pro',plan_expires_at=$2,payment_status='paid',updated_at=NOW() WHERE id=$1`,[local.user_id,expires]);
   await client.query(`INSERT INTO plan_grants(user_id,plan,months,amount_inr,note,expires_at)
      VALUES($1,'pro',$2,$3,$4,$5)`,[local.user_id,local.months,local.amount_inr,'Cashfree sandbox '+id,expires]);
   outcome='granted';
  }else if(local.status==='paid')outcome='already_paid';
  await client.query(`INSERT INTO cashfree_sandbox_webhook_events(fingerprint,order_id,event_type,outcome)
   VALUES($1,$2,$3,$4)`,[fp,id,type.slice(0,80),outcome]);
  await client.query('COMMIT');
  return {duplicate:false,paid:outcome==='granted'||outcome==='already_paid'};
 }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{client.release();}
}
async function history(user){
 guard();const r=await db.query(`SELECT id,billing_period,amount_inr,status,created_at,paid_at
 FROM cashfree_sandbox_orders WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,[user.id]);
 return {orders:r.rows};
}
async function audit(){
 guard();const [o,e]=await Promise.all([
  db.query(`SELECT id,plan,billing_period,amount_inr,status,created_at,paid_at,granted_at
   FROM cashfree_sandbox_orders ORDER BY created_at DESC LIMIT 100`),
  db.query(`SELECT order_id,event_type,outcome,created_at FROM cashfree_sandbox_webhook_events
   ORDER BY created_at DESC LIMIT 100`)]);
 return {orders:o.rows,events:e.rows};
}
module.exports={enabled,guard,price,verifySignature,create,processWebhook,history,audit};
