'use strict';
const db=require('../config/database');
const {isPlanActive,nextExpiry}=require('./plan.service');
const USER_COLS='id,email,plan,plan_expires_at';
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=(message,statusCode=400)=>Object.assign(new Error(message),{statusCode});
const manualPrefix=(id)=>'Manual grant '+id+' | ';
const isCashfree=(note)=>String(note||'').startsWith('Cashfree sandbox cf_sbx_');
const classify=(note)=>{
 const raw=String(note||'');
 if(isCashfree(raw))return {source:'cashfree_sandbox',note:raw};
 if(/^Manual grant [a-f0-9-]{36} \| /i.test(raw))
  return {source:'manual',note:raw.replace(/^Manual grant [a-f0-9-]{36} \| /i,'')};
 return {source:'legacy_manual',note:raw};
};
const expiryKey=(v)=>{
 if(v===null||v===undefined||v==='')return null;
 const ts=new Date(v).getTime();
 if(!Number.isFinite(ts))throw fail('Invalid plan expiry in review.',400);
 return new Date(ts).toISOString();
};
function recentCashfree(rows,now=new Date()){
 return rows.some(g=>isCashfree(g.note)&&now.getTime()-new Date(g.granted_at).getTime()<7*86400000);
}
async function lookup(email){
 const userResult=await db.query(`SELECT ${USER_COLS} FROM users WHERE LOWER(email)=LOWER($1)`,[email]);
 const user=userResult.rows[0]||null;
 const records=user?await db.query(`SELECT note,granted_at,expires_at FROM plan_grants
 WHERE user_id=$1 ORDER BY granted_at DESC LIMIT 30`,[user.id]):{rows:[]};
 return {user,records:records.rows};
}
async function preview(email){
 if(typeof email!=='string'||!email.includes('@'))throw fail('Valid email required.');
 const {user,records}=await lookup(email.trim().toLowerCase());
 if(!user)throw fail('No existing signed-in user found. Ask them to sign in first.',404);
 return {email:user.email,plan:user.plan,planExpiresAt:user.plan_expires_at||null,
  active:isPlanActive(user.plan,user.plan_expires_at),
  recentCashfree:recentCashfree(records),
  recentGrants:records.slice(0,5).map(g=>({...classify(g.note),grantedAt:g.granted_at,expiresAt:g.expires_at}))};
}
async function grant({email,plan,months,amountInr,reason,note,requestId,expectedExpiresAt,acknowledgeActivePlan,acknowledgeRecentCashfree}){
 if(!ID.test(requestId||''))throw fail('Unique request ID required.',400);
 if(!['pro','institute'].includes(plan)||!Number.isInteger(months)||months<1||months>36)
  throw fail('Invalid plan or months.',400);
 if(!['manual_payment','complimentary'].includes(reason))throw fail('Select manual payment or complimentary access.');
 if(!Number.isInteger(amountInr)||amountInr<0||
  (reason==='manual_payment'&&amountInr===0)||
  (reason==='complimentary'&&amountInr!==0))throw fail('Manual payment must have a positive amount; complimentary access must have amount zero.');
 if(typeof note!=='string'||note.trim().length<8||note.trim().length>170)
  throw fail('A reference or justification of 8–170 characters is required.');
 const client=await db.getClient();
 try{
  await client.query('BEGIN');
  // Serializes all manual grants for the same existing user (no new DB schema).
  const u=await client.query(`SELECT ${USER_COLS} FROM users
   WHERE LOWER(email)=LOWER($1) FOR UPDATE`,[email.trim().toLowerCase()]);
  if(!u.rowCount)throw fail('No existing signed-in user found.',404);
  const user=u.rows[0];
  const prefix=manualPrefix(requestId);
  const replay=await client.query(`SELECT expires_at FROM plan_grants
   WHERE user_id=$1 AND LEFT(COALESCE(note,''),LENGTH($2))=$2 LIMIT 1`,[user.id,prefix]);
  if(replay.rowCount){
   await client.query('COMMIT');
   return {email:user.email,plan,planExpiresAt:replay.rows[0].expires_at,duplicate:true};
  }
  if(expiryKey(user.plan_expires_at)!==expiryKey(expectedExpiresAt))
   throw fail('The plan changed since your review. Reload and review this account again.',409);
  if(isPlanActive(user.plan,user.plan_expires_at)&&acknowledgeActivePlan!==true)
   throw fail('Explicit confirmation required to extend an active plan.',409);
  const g=await client.query(`SELECT note,granted_at FROM plan_grants
   WHERE user_id=$1 ORDER BY granted_at DESC LIMIT 30`,[user.id]);
  if(recentCashfree(g.rows)&&acknowledgeRecentCashfree!==true)
   throw fail('Recent Cashfree payment detected. Confirm that this is a separate manual grant.',409);
  const end=nextExpiry(user.plan_expires_at,months);
  const updated=await client.query(`UPDATE users
   SET plan=$2,plan_expires_at=$3,payment_status=$4,updated_at=NOW()
   WHERE id=$1 RETURNING email,plan,plan_expires_at`,[user.id,plan,end,reason==='manual_payment'?'paid':'complimentary']);
  await client.query(`INSERT INTO plan_grants(user_id,plan,months,amount_inr,note,expires_at)
   VALUES($1,$2,$3,$4,$5,$6)`,[user.id,plan,months,amountInr,prefix+note.trim(),end]);
  await client.query('COMMIT');
  return {email:updated.rows[0].email,plan,planExpiresAt:updated.rows[0].plan_expires_at,duplicate:false};
 }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{client.release();}
}
module.exports={classify,recentCashfree,preview,grant};
