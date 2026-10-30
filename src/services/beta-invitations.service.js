'use strict';
const crypto=require('node:crypto');
const db=require('../config/database');
const gate=require('./draft-testing-gate');
const TEST_ID='ssc-cgl-2026-mock-01';
const fail=(message,statusCode=403)=>Object.assign(new Error(message),{statusCode});
const emailOf=v=>String(v||'').trim().toLowerCase();
const digest=s=>crypto.createHash('sha256').update(s).digest('hex');
function ensureStaging(){
 if(!gate.enabled())throw fail('Beta testing is disabled outside isolated staging.',404);
}
async function create(email,hours,by){
 ensureStaging();
 const normalized=emailOf(email);
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)||normalized.length>255)
  throw fail('Valid verified email required.',400);
 if(!Number.isInteger(hours)||hours<1||hours>168)throw fail('Expiry must be 1–168 hours.',400);
 const token=crypto.randomBytes(32).toString('hex');
 await db.query(`INSERT INTO exam_beta_invitations(test_id,email,token_hash,expires_at,created_by)
  VALUES($1,$2,$3,NOW()+($4*INTERVAL '1 hour'),$5)`,
 [TEST_ID,normalized,digest(token),hours,by]);
 return {invitationCode:token,expiresInHours:hours,testId:TEST_ID,email:normalized};
}
async function redeem(user,code){
 ensureStaging();
 if(typeof code!=='string'||!/^[a-f0-9]{64}$/.test(code))throw fail('Invalid invitation code.');
 const email=emailOf(user.email);
 const r=await db.query(`UPDATE exam_beta_invitations
 SET redeemed_user_id=$1,redeemed_at=COALESCE(redeemed_at,NOW())
 WHERE token_hash=$2 AND test_id=$3 AND email=$4
 AND expires_at>NOW() AND revoked_at IS NULL
 AND (redeemed_user_id IS NULL OR redeemed_user_id=$1)
 RETURNING id,expires_at`,[user.id,digest(code),TEST_ID,email]);
 if(!r.rowCount)throw fail('Invitation is expired, revoked or issued to another verified account.');
 return {testId:TEST_ID,expiresAt:r.rows[0].expires_at};
}
async function authorized(user){
 ensureStaging();
 const email=emailOf(user.email);
 const r=await db.query(`SELECT 1 FROM exam_beta_invitations
 WHERE test_id=$1 AND redeemed_user_id=$2 AND email=$3 AND redeemed_at IS NOT NULL
 AND revoked_at IS NULL AND expires_at>NOW() LIMIT 1`,[TEST_ID,user.id,email]);
 if(!r.rowCount)throw fail('A valid redeemed invitation is required.');
 return true;
}
async function revoke(id){
 ensureStaging();
 if(!/^[a-f0-9-]{36}$/i.test(String(id)))throw fail('Invalid invitation ID.',400);
 const r=await db.query('UPDATE exam_beta_invitations SET revoked_at=NOW() WHERE id=$1 AND revoked_at IS NULL',[id]);
 return {revoked:r.rowCount>0};
}
module.exports={TEST_ID,ensureStaging,create,redeem,authorized,revoke};
