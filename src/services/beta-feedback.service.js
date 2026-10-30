'use strict';
const db=require('../config/database');
const invitations=require('./beta-invitations.service');
const fail=(message,statusCode=400)=>Object.assign(new Error(message),{statusCode});
const categories=new Set(['translation','timing','scoring','navigation','accessibility','other']);
const severities=new Set(['low','medium','high']);
async function submit(user,payload){
 await invitations.authorized(user);
 const category=payload?.category,severity=payload?.severity;
 const comment=typeof payload?.comment==='string'?payload.comment.trim():'';
 if(!categories.has(category)||!severities.has(severity)||comment.length<10||comment.length>1500)
  throw fail('Choose a category and severity and describe the issue in 10–1500 characters.');
 const r=await db.query(`INSERT INTO exam_beta_feedback(test_id,user_id,category,severity,comment)
 VALUES($1,$2,$3,$4,$5) RETURNING id,created_at`,
 [invitations.TEST_ID,user.id,category,severity,comment]);
 return {id:r.rows[0].id,createdAt:r.rows[0].created_at};
}
async function list(){
 invitations.ensureStaging();
 const r=await db.query(`SELECT id,category,severity,comment,status,created_at
 FROM exam_beta_feedback WHERE test_id=$1 ORDER BY created_at DESC LIMIT 200`,[invitations.TEST_ID]);
 return {feedback:r.rows};
}
async function status(id,status){
 invitations.ensureStaging();
 if(!/^[a-f0-9-]{36}$/i.test(String(id))||!new Set(['open','triaged','resolved']).has(status))
  throw fail('Invalid feedback ID or status.');
 const r=await db.query(`UPDATE exam_beta_feedback SET status=$3 WHERE id=$1 AND test_id=$2 RETURNING id`,
 [id,invitations.TEST_ID,status]);
 if(!r.rowCount)throw fail('Feedback not found.',404);
 return {updated:true};
}
async function audit(){
 invitations.ensureStaging();
 const r=await db.query(`SELECT action,created_at,invitation_id,actor_email
 FROM exam_beta_invitation_audit ORDER BY created_at DESC LIMIT 200`);
 return {events:r.rows};
}
async function release(testId){
 invitations.ensureStaging();
 if(testId!==invitations.TEST_ID)throw fail('Only Mock 01 beta release reporting is supported.',404);
 const readiness=require('./mock-release-readiness.service');
 const [report,feedback,auditLog]=await Promise.all([readiness.report(testId),list(),audit()]);
 const blockers=feedback.feedback.filter(f=>f.status!=='resolved'&&f.severity==='high').length;
 return {...report,beta:{feedbackCount:feedback.feedback.length,openHighSeverity:blockers,auditEvents:auditLog.events.length},
  releaseAuthorized:false,requiresIndependentSignoff:true,
  note:'Report only. Human editorial, security, accessibility, beta and owner approvals remain required.'};
}
module.exports={submit,list,status,audit,release};
