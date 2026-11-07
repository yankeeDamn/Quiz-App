 'use strict';
const crypto=require('node:crypto');
const db=require('../config/database');
const m=require('./monetization.service');
function settings(){
 const mode=process.env.MONETIZATION_CASHFREE_MODE;
 if(!m.enabled()||!['sandbox','production'].includes(mode)||!process.env.MONETIZATION_CASHFREE_APP_ID||!process.env.MONETIZATION_CASHFREE_SECRET)throw m.fail('Online checkout is unavailable. Use WhatsApp for verified manual payment.',503);
 if(mode==='production'&&process.env.MONETIZATION_LIVE_PAYMENTS_ENABLED!=='true')throw m.fail('Live payments are disabled',503);
 const frontend=new URL(m.url(process.env.MONETIZATION_FRONTEND_ORIGIN)).origin;
 const backend=new URL(m.url(process.env.MONETIZATION_API_ORIGIN)).origin;
 return {mode,frontend,backend,base:mode==='production'?'https://api.cashfree.com/pg':'https://sandbox.cashfree.com/pg'};
}
async function gateway(method,path,body){
 const s=settings();
 const r=await fetch(s.base+path,{method,signal:AbortSignal.timeout(12000),headers:{'Content-Type':'application/json','x-api-version':'2025-01-01','x-client-id':process.env.MONETIZATION_CASHFREE_APP_ID,'x-client-secret':process.env.MONETIZATION_CASHFREE_SECRET,...(body?{'x-idempotency-key':body.order_id}:{})},...(body?{body:JSON.stringify(body)}:{})});
 if(!r.ok)throw m.fail('Payment provider unavailable. Try again later.',502);return r.json();
}
async function create(user,raw){
 const s=settings(),p=m.product(raw.code),resource=raw.resourceId||'';
 if(!/^[6-9]\d{9}$/.test(raw.phone||''))throw m.fail('Enter a valid Indian mobile number');
 await m.validateResource(user,raw.code,resource);
 const id='ep_'+crypto.randomUUID().replaceAll('-','');
 await db.query('INSERT INTO monetization_orders(id,user_id,code,resource_id,amount_inr,mode) VALUES($1,$2,$3,$4,$5,$6)',[id,user.id,raw.code,resource,p.amount,s.mode]);
 const remote=await gateway('POST','/orders',{order_id:id,order_amount:p.amount,order_currency:'INR',customer_details:{customer_id:user.id,customer_email:user.email,customer_phone:raw.phone},order_meta:{return_url:s.frontend+'/pricing?monetization_order={order_id}',notify_url:s.backend+'/api/v1/payments/webhook'}});
 if(remote.order_id!==id||!remote.payment_session_id)throw m.fail('Invalid provider response',502);
 return {orderId:id,paymentSessionId:remote.payment_session_id,mode:s.mode,amountInr:p.amount};
}
function verify(raw,signature,timestamp){
 settings();
 if(!Buffer.isBuffer(raw)||!/^\d{10,14}$/.test(timestamp||'')||typeof signature!=='string')throw m.fail('Invalid signature',401);
 const expected=crypto.createHmac('sha256',process.env.MONETIZATION_CASHFREE_SECRET).update(timestamp).update(raw).digest('base64');
 const a=Buffer.from(expected),b=Buffer.from(signature);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))throw m.fail('Invalid signature',401);
}
async function reconcile(id,userId){
 if(!/^ep_[a-f0-9]{32}$/.test(id))throw m.fail('Unknown order',404);
 const local=(await db.query('SELECT * FROM monetization_orders WHERE id=$1'+(userId?' AND user_id=$2':''),userId?[id,userId]:[id])).rows[0];
 if(!local)throw m.fail('Unknown order',404);
 if(local.mode!==settings().mode)throw m.fail('Order environment mismatch',409);
 if(local.status==='paid')return {status:'paid'};
 const remote=await gateway('GET','/orders/'+id);
 if(remote.order_id!==id||remote.order_status!=='PAID'||remote.order_currency!=='INR'||Number(remote.order_amount)!==local.amount_inr||remote.customer_details?.customer_id!==local.user_id)return {status:'pending'};
 return m.transaction(async c=>{
  const row=(await c.query('SELECT * FROM monetization_orders WHERE id=$1 FOR UPDATE',[id])).rows[0];
  if(row.status!=='paid'){
   await m.grant(c,row.user_id,row.code,row.resource_id,'cashfree:'+id,'cashfree:'+row.mode);
   await c.query("UPDATE monetization_orders SET status='paid',paid_at=now() WHERE id=$1",[id]);
  }return {status:'paid'};
 });
}
async function webhook(raw,signature,timestamp){
 verify(raw,signature,timestamp);let event;try{event=JSON.parse(raw.toString('utf8'));}catch{throw m.fail('Malformed webhook');}
 if(event.type!=='PAYMENT_SUCCESS_WEBHOOK'||event.data?.payment?.payment_status!=='SUCCESS')return {ignored:true};
 return reconcile(event.data?.order?.order_id);
}
module.exports={settings,create,verify,reconcile,webhook};
