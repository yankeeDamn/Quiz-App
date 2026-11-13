'use strict';
const p=require('./policy'),policy=require('./billing-policy');
const enabled=()=>process.env.INSTITUTE_QUOTAS_ENABLED==='true';
async function lock(c,instituteId){if(enabled())await c.query('SELECT pg_advisory_xact_lock(hashtext($1))',['institute-quota:'+instituteId]);}
async function usage(c,id){return(await c.query(`SELECT
 (SELECT count(*)::int FROM pilot_memberships WHERE institute_id=$1 AND status='active' AND role='student') students,
 (SELECT count(*)::int FROM pilot_memberships WHERE institute_id=$1 AND status='active' AND role='teacher') teachers,
 (SELECT count(*)::int FROM pilot_batches WHERE institute_id=$1) batches,
 (SELECT count(*)::int FROM pilot_questions WHERE institute_id=$1 AND retired_at IS NULL) questions,
 (SELECT count(*)::int FROM pilot_attempts WHERE institute_id=$1 AND snapshot IS NOT NULL AND started_at >= date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') "monthlyAttempts"`,[id])).rows[0];}
async function requireCapacity(c,id,key,amount=1){
 if(!enabled())return;
 if(!policy.keys.includes(key)||!Number.isInteger(amount)||amount<1)throw p.fail('Invalid capacity operation');
 policy.sandbox();await lock(c,id);
 const s=(await c.query('SELECT *,clock_timestamp() AS checked_at FROM pilot_subscriptions WHERE institute_id=$1 AND billing_managed FOR SHARE',[id])).rows[0];
 if(!s||s.mode!=='sandbox'||policy.effective(s,s.checked_at)!=='active')throw p.fail('An active institute subscription is required for new usage',402);
 const l=policy.limits(s.limits),used=await usage(c,id);
 if(used[key]+amount>l[key])throw p.fail('Institute '+key+' limit reached',409);
}
module.exports={enabled,lock,usage,requireCapacity};
