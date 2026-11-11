'use strict';
const m=require('./monetization.service'),pay=require('./monetization-payments.service'),db=require('../config/database');
const fail=m.fail;
const enabled=()=>process.env.AD_PAYMENT_VERIFICATION_ENABLED==='true';
function owner(user){if(!m.owner(user))throw fail('Platform owner required',403);}
async function audit(c,id,user,action,paymentId){await c.query('INSERT INTO advertising_audit_logs(ad_id,actor_id,action,payment_id) VALUES($1,$2,$3,$4)',[id,user.id,action,paymentId||null]);}
function required(){if(!enabled())throw fail('Independent advertising payment verification is not configured',503);}
async function verify(id,raw,user){
 owner(user);required();
 if(typeof raw.orderId!=='string'||!/^[A-Za-z0-9_-]{3,100}$/.test(raw.orderId))throw fail('Valid merchant order ID required');
 if(!['booking','renewal'].includes(raw.purpose))throw fail('Choose booking or renewal');
 const settings=pay.settings();
 return m.transaction(async c=>{
  const row=(await c.query("SELECT document FROM monetization_documents WHERE kind='ad' AND id=$1 FOR SHARE",[id])).rows[0];if(!row||row.document.status==='deleted')throw fail('Ad unavailable',404);
  const ad=row.document,days=raw.purpose==='booking'?ad.durationDays:7,amount=raw.purpose==='booking'?ad.amountInr:m.SLOTS[ad.slotType];
  if(!Number.isInteger(amount)||amount<=0||![7,30].includes(days))throw fail('Ad quote requires review',409);
  const remote=await pay.gateway('GET','/orders/'+encodeURIComponent(raw.orderId));
  // Provider-owned metadata binds the independently paid order to this ad and
  // product. A UTR, checkbox or unbound consumer/institute order is insufficient.
  if(remote.order_id!==raw.orderId||remote.order_status!=='PAID'||remote.order_currency!=='INR'||!Number.isFinite(Number(remote.order_amount))||Math.abs(Number(remote.order_amount)*100-amount*100)>0.000001||remote.order_tags?.exampro_ad_id!==id||remote.order_tags?.exampro_purpose!==raw.purpose)throw fail('Provider payment does not match this advertising quote',409);
  const inserted=(await c.query(`INSERT INTO advertising_verified_payments(ad_id,provider_order_id,mode,purpose,amount_paise,duration_days,verified_by)
   VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(provider_order_id) DO NOTHING RETURNING *`,[id,raw.orderId,settings.mode,raw.purpose,amount*100,days,user.id])).rows[0];
  const payment=inserted||(await c.query('SELECT * FROM advertising_verified_payments WHERE provider_order_id=$1',[raw.orderId])).rows[0];
  if(payment.ad_id!==id||payment.mode!==settings.mode||payment.purpose!==raw.purpose||payment.amount_paise!==amount*100)throw fail('Payment already belongs to a different quote',409);
  if(inserted)await audit(c,id,user,'payment.provider_verified',payment.id);
  return {id:payment.id,purpose:payment.purpose,mode:payment.mode,consumed:!!payment.consumed_at};
 });
}
async function action(id,raw,user){
 owner(user);const action=raw.action;
 if(!['approve','extend','pause','resume','reject','delete'].includes(action))throw fail('Invalid advertising action');
 required();
 return m.transaction(async c=>{
  const row=(await c.query("SELECT document FROM monetization_documents WHERE kind='ad' AND id=$1 FOR UPDATE",[id])).rows[0];if(!row)throw fail('Ad not found',404);
  const d=row.document,now=(await c.query('SELECT clock_timestamp() AS now')).rows[0].now;
  if(['approve','extend'].includes(action)){
   if(typeof raw.paymentId!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(raw.paymentId))throw fail('Select an independently verified advertising payment');
   const receipt=(await c.query('SELECT * FROM advertising_verified_payments WHERE ad_id=$1 AND id=$2 FOR UPDATE',[id,raw.paymentId])).rows[0];
   if(!receipt||receipt.purpose!==(action==='approve'?'booking':'renewal'))throw fail('Verified payment does not authorize this action',409);
   if(receipt.mode!==pay.settings().mode)throw fail('Advertising payment environment mismatch',409);
   if(receipt.consumed_at){if(receipt.consumed_action===action)return d;throw fail('Payment already used',409);}
   if(action==='approve'&&d.status!=='pending_review')throw fail('Only a pending submission can be approved',409);
   if(action==='extend'&&!['active','paused','expired'].includes(d.status))throw fail('Only an approved ad can be renewed',409);
   m.url(d.destinationUrl);
   d.paymentMode=receipt.mode;d.status='active';d.expiresAt=new Date((action==='extend'?Math.max(+now,Date.parse(d.expiresAt)||0):+now)+receipt.duration_days*86400000).toISOString();
   await c.query('UPDATE advertising_verified_payments SET consumed_action=$2,consumed_at=clock_timestamp() WHERE id=$1',[receipt.id,action]);
  }else if(action==='pause'){if(d.status!=='active')throw fail('Only an active ad can be paused',409);d.status='paused';}
  else if(action==='resume'){if(d.status!=='paused'||Date.parse(d.expiresAt)<=+now)throw fail('Renew this expired ad before resuming',409);m.url(d.destinationUrl);d.status='active';}
  else if(action==='reject'){if(d.status!=='pending_review')throw fail('Only pending ads can be rejected',409);d.status='rejected';}
  else {d.status='deleted';} // retain payment/moderation evidence; public delivery excludes it
  await c.query("UPDATE monetization_documents SET document=$2::jsonb,updated_at=now() WHERE kind='ad' AND id=$1",[id,JSON.stringify(d)]);
  await audit(c,id,user,'ad.'+action,raw.paymentId);return d;
 });
}
async function payments(user){owner(user);if(!enabled())return[];return(await db.query('SELECT id,ad_id,purpose,mode,amount_paise,consumed_at FROM advertising_verified_payments ORDER BY verified_at DESC LIMIT 500')).rows;}
module.exports={enabled,verify,action,payments};
