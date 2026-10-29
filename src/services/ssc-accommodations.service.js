'use strict';
const db=require('../config/database');
const {eligible}=require('./ssc-section-timing');
const fail=(message,statusCode=400)=>Object.assign(new Error(message),{statusCode});

// Accommodation is a server-side, admin-authorized entitlement. No medical
// evidence or diagnosis is collected; eligibility must be checked offline.
async function approvedMode(userId,testId){
  const {rows}=await db.query(
    'SELECT mode FROM exam_time_accommodations WHERE user_id=$1 AND test_id=$2',
    [userId,testId]
  );
  return rows[0]?.mode||null;
}
async function setApproved(testId,email,enabled,adminEmail){
  if(typeof email!=='string'||email.trim().length>255||!email.includes('@'))throw fail('Valid account email required.');
  const normalized=email.trim().toLowerCase();
  const {rows:tests}=await db.query('SELECT id,active FROM mock_tests WHERE id=$1',[testId]);
  if(!tests.length)throw fail('Test not found',404);
  // QA entitlements are configured for drafts; publication needs a separate
  // accessibility/eligibility governance sign-off.
  if(tests[0].active)throw fail('Grant accommodation while the test is a draft.',409);
  const {rows:users}=await db.query('SELECT id FROM users WHERE lower(email)=$1',[normalized]);
  if(!users.length)throw fail('User must first sign into staging using this email.',404);
  if(enabled){
    await db.query(`INSERT INTO exam_time_accommodations(user_id,test_id,mode,approved_by)
      VALUES($1,$2,'scribe_compensatory',$3)
      ON CONFLICT(user_id,test_id) DO UPDATE SET mode=EXCLUDED.mode,
        approved_by=EXCLUDED.approved_by,approved_at=NOW()`,[users[0].id,testId,adminEmail]);
  }else{
    await db.query('DELETE FROM exam_time_accommodations WHERE user_id=$1 AND test_id=$2',[users[0].id,testId]);
  }
  return {approved:Boolean(enabled),email:normalized,minutesPerSection:enabled?20:15};
}
module.exports={approvedMode,setApproved};
