'use strict';
const {randomUUID}=require('node:crypto');
const db=require('../../config/database'),f=require('./foundation'),p=require('./policy'),v=require('./billing-policy'),quotas=require('./quotas');
const pay=require('../monetization-payments.service');
const requireEnabled=()=>{v.sandbox();return pay.settings();};
async function savePlan(user,raw){f.platform(user);v.sandbox();const plan=v.plan(raw);return f.transaction(async c=>{
 await c.query(`INSERT INTO pilot_billing_plans(code,name,amount_paise,period_days,limits,active,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7)
 ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,amount_paise=EXCLUDED.amount_paise,period_days=EXCLUDED.period_days,limits=EXCLUDED.limits,active=EXCLUDED.active,updated_by=EXCLUDED.updated_by,updated_at=now()`,[plan.code,plan.name,plan.amountPaise,plan.periodDays,JSON.stringify(plan.limits),plan.active,user.id]);
 await f.audit(c,null,user,'billing.plan.saved',plan.code);return plan;
});}
async function plans(user){f.platform(user);v.sandbox();return(await db.query('SELECT code,name,amount_paise,period_days,limits,active FROM pilot_billing_plans ORDER BY code')).rows;}
async function quote(user,instituteId,code){
 f.platform(user);v.sandbox();p.uuid(instituteId);
 return f.transaction(async c=>{
  if(!(await c.query("SELECT id FROM pilot_institutes WHERE id=$1 AND status IN ('active','trial') FOR SHARE",[instituteId])).rowCount)throw p.fail('Institute unavailable',404);
  const plan=(await c.query('SELECT * FROM pilot_billing_plans WHERE code=$1 AND active FOR SHARE',[code])).rows[0];if(!plan)throw p.fail('Active plan required',404);
  const owner=(await c.query("SELECT user_id FROM pilot_memberships WHERE institute_id=$1 AND role='owner' AND status='active' FOR SHARE",[instituteId])).rows[0];if(!owner)throw p.fail('Verified institute owner required',409);
  const current=(await c.query('SELECT *,clock_timestamp() AS checked_at FROM pilot_subscriptions WHERE institute_id=$1 AND billing_managed FOR SHARE',[instituteId])).rows[0];
  if(current&&current.current_period_end>current.checked_at&&(current.plan_code!==code||v.keys.some(key=>current.limits?.[key]!==plan.limits[key])))throw p.fail('Plan changes are available after the current period ends',409);
  // An unpaid provider order is never silently replaced: reconcile/cancel it first.
  const snapshot={code:plan.code,name:plan.name,amountPaise:plan.amount_paise,periodDays:plan.period_days,limits:v.limits(plan.limits)};
  const row=(await c.query(`INSERT INTO pilot_billing_orders(id,institute_id,requested_by,quoted_by,plan_code,plan_snapshot,amount_paise,mode,expires_at)
   VALUES($1,$2,$3,$4,$5,$6,$7,'sandbox',now()+interval '7 days') RETURNING id,plan_snapshot,expires_at,status`,[randomUUID(),instituteId,owner.user_id,user.id,code,JSON.stringify(snapshot),plan.amount_paise])).rows[0];
  await f.audit(c,instituteId,user,'billing.quoted',row.id);return row;
 });
}
async function overview(user,slug){v.sandbox();return f.within(user,slug,'billing:read',async(c,t)=>{
 const subscription=(await c.query('SELECT plan_code,status,limits,current_period_start,current_period_end,mode,cancel_at_period_end FROM pilot_subscriptions WHERE institute_id=$1 AND billing_managed',[t.institute.id])).rows[0]||null;
 return {subscription:subscription?{...subscription,effectiveStatus:v.effective(subscription)}:null,usage:await quotas.usage(c,t.institute.id),quotasEnforced:quotas.enabled(),
 orders:(await c.query('SELECT id,plan_snapshot,amount_paise,status,mode,expires_at,paid_at FROM pilot_billing_orders WHERE institute_id=$1 ORDER BY created_at DESC LIMIT 50',[t.institute.id])).rows,
 receipts:(await c.query('SELECT id,order_id,amount_paise,currency,mode,period_start,period_end,created_at FROM pilot_billing_receipts WHERE institute_id=$1 ORDER BY created_at DESC LIMIT 50',[t.institute.id])).rows};
});}
async function createOrder(user,slug,id,phone){
 const settings=requireEnabled();p.uuid(id);if(!/^[6-9]\d{9}$/.test(phone||''))throw p.fail('Enter a valid Indian mobile number');
 // Keep authorization locks through provider request (12s timeout) so role/tenant
 // revocation cannot race acceptance. Failed requests roll back; retries use same UUID.
 return f.within(user,slug,'billing:read',async(c,t)=>{
  const order=(await c.query('SELECT *,clock_timestamp() AS checked_at FROM pilot_billing_orders WHERE institute_id=$1 AND id=$2 AND requested_by=$3 FOR UPDATE',[t.institute.id,id,user.id])).rows[0];
  if(!order)throw p.fail('Order unavailable',404);
  if(!['quoted','pending'].includes(order.status)||order.mode!==settings.mode)throw p.fail('Order cannot be checked out',409);
  if(order.expires_at<=order.checked_at)throw p.fail('Quote expired; reconcile any payment before requesting another quote',409);
  const current=(await c.query('SELECT * FROM pilot_subscriptions WHERE institute_id=$1 AND billing_managed FOR SHARE',[t.institute.id])).rows[0];
  if(current?.current_period_end>order.checked_at&&(current.plan_code!==order.plan_code||v.keys.some(key=>current.limits?.[key]!==order.plan_snapshot.limits[key])))throw p.fail('Plan changes are available after the current period ends',409);
  const remote=await pay.gateway('POST','/orders',{order_id:id,order_amount:order.amount_paise/100,order_currency:'INR',order_expiry_time:order.expires_at.toISOString(),customer_details:{customer_id:user.id,customer_email:user.email,customer_phone:phone},order_meta:{return_url:settings.frontend+'/institute/'+slug+'/billing?order='+id,notify_url:settings.backend+'/api/v1/institute-billing/webhook'}});
  if(remote.order_id!==id||typeof remote.payment_session_id!=='string'||!remote.payment_session_id)throw p.fail('Invalid provider order response',502);
  await c.query("UPDATE pilot_billing_orders SET status='pending',provider_order_id=$2 WHERE institute_id=$1 AND id=$2",[t.institute.id,id]);
  await f.audit(c,t.institute.id,user,'billing.checkout.created',id);
  return {orderId:id,paymentSessionId:remote.payment_session_id,mode:settings.mode,amountPaise:order.amount_paise};
 });
}
async function settle(c,order,remote){
 if(order.status==='paid')return {status:'paid'};
 const amount=Number(remote.order_amount);
 if(remote.order_id!==order.id||remote.order_currency!=='INR'||!Number.isFinite(amount)||Math.abs(amount*100-order.amount_paise)>0.000001||remote.customer_details?.customer_id!==order.requested_by)throw p.fail('Provider order does not match the stored quote',409);
 if(remote.order_status!=='PAID'){
  if(['EXPIRED','TERMINATED'].includes(remote.order_status))await c.query("UPDATE pilot_billing_orders SET status=$3 WHERE institute_id=$1 AND id=$2",[order.institute_id,order.id,remote.order_status==='EXPIRED'?'expired':'cancelled']);
  return {status:remote.order_status==='EXPIRED'?'expired':remote.order_status==='TERMINATED'?'cancelled':'pending'};
 }
 // Provider-confirmed payment is accepted even after quote expiry; its immutable
 // terms were accepted at checkout. A late webhook cannot lose an actual payment.
 await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',['institute-quota:'+order.institute_id]);
 const old=(await c.query('SELECT * FROM pilot_subscriptions WHERE institute_id=$1 AND billing_managed FOR UPDATE',[order.institute_id])).rows[0];
 const now=(await c.query('SELECT clock_timestamp() AS now')).rows[0].now;
 if(old&&old.current_period_end>now&&(old.plan_code!==order.plan_code||v.keys.some(key=>old.limits?.[key]!==order.plan_snapshot.limits[key])))throw p.fail('Paid plan change needs platform review; current period is preserved',409);
 const start=old?.current_period_end>now?old.current_period_end:now,end=new Date(+start+order.plan_snapshot.periodDays*86400000);
 await c.query(`INSERT INTO pilot_subscriptions(institute_id,provider,plan_code,status,current_period_start,current_period_end,billing_managed,limits,mode)
  VALUES($1,'cashfree',$2,'active',$3,$4,true,$5,$6) ON CONFLICT(institute_id) WHERE billing_managed
  DO UPDATE SET plan_code=EXCLUDED.plan_code,status='active',current_period_end=EXCLUDED.current_period_end,
  current_period_start=CASE WHEN pilot_subscriptions.current_period_end>now() THEN pilot_subscriptions.current_period_start ELSE EXCLUDED.current_period_start END,
  limits=EXCLUDED.limits,mode=EXCLUDED.mode,cancel_at_period_end=false`,[order.institute_id,order.plan_code,start,end,JSON.stringify(order.plan_snapshot.limits),order.mode]);
 await c.query("INSERT INTO pilot_billing_receipts(institute_id,order_id,amount_paise,currency,mode,period_start,period_end) VALUES($1,$2,$3,'INR',$4,$5,$6)",[order.institute_id,order.id,order.amount_paise,order.mode,start,end]);
 await c.query("UPDATE pilot_billing_orders SET status='paid',paid_at=clock_timestamp() WHERE institute_id=$1 AND id=$2",[order.institute_id,order.id]);
 await f.audit(c,order.institute_id,{id:order.requested_by},'billing.provider_confirmed',order.id);
 return {status:'paid'};
}
async function reconcileOrder(c,instituteId,id){
 const order=(await c.query('SELECT * FROM pilot_billing_orders WHERE institute_id=$1 AND id=$2 FOR UPDATE',[instituteId,id])).rows[0];
 if(!order)throw p.fail('Order unavailable',404);
 if(order.mode!=='sandbox')throw p.fail('Order environment mismatch',409);
 if(order.status==='paid')return {status:'paid'};
 // Query even after a checkout timeout: provider creation may have succeeded
 // while the local transaction rolled back. Only a matching PAID response settles.
 return settle(c,order,await pay.gateway('GET','/orders/'+id));
}
async function reconcile(user,slug,id){requireEnabled();p.uuid(id);return f.within(user,slug,'billing:read',(c,t)=>reconcileOrder(c,t.institute.id,id));}
async function webhook(raw,signature,timestamp){
 requireEnabled();pay.verify(raw,signature,timestamp);
 let event;try{event=JSON.parse(raw.toString('utf8'));}catch{throw p.fail('Malformed webhook');}
 if(event.type!=='PAYMENT_SUCCESS_WEBHOOK'||event.data?.payment?.payment_status!=='SUCCESS')return {ignored:true};
 const id=p.uuid(event.data?.order?.order_id);
 const row=(await db.query('SELECT institute_id FROM pilot_billing_orders WHERE id=$1',[id])).rows[0];if(!row)throw p.fail('Order unavailable',404);
 return f.transaction(c=>reconcileOrder(c,row.institute_id,id));
}
async function cancel(user,slug){v.sandbox();return f.within(user,slug,'billing:read',async(c,t)=>{
 const row=(await c.query('UPDATE pilot_subscriptions SET cancel_at_period_end=true WHERE institute_id=$1 AND billing_managed RETURNING current_period_end',[t.institute.id])).rows[0];
 if(!row)throw p.fail('Subscription unavailable',404);await f.audit(c,t.institute.id,user,'billing.cancel_at_period_end');return {cancelAtPeriodEnd:true,accessUntil:row.current_period_end};
});}
async function cancelQuote(user,slug,id){v.sandbox();p.uuid(id);return f.within(user,slug,'billing:read',async(c,t)=>{
 const row=(await c.query("UPDATE pilot_billing_orders SET status='cancelled' WHERE institute_id=$1 AND id=$2 AND status='quoted' RETURNING id",[t.institute.id,id])).rows[0];
 if(!row)throw p.fail('Only an unstarted quote may be cancelled; reconcile existing payments first',409);
 await f.audit(c,t.institute.id,user,'billing.quote.cancelled',id);return {status:'cancelled'};
});}
module.exports={savePlan,plans,quote,overview,createOrder,reconcile,webhook,cancel,cancelQuote};
