'use strict';
const {randomUUID}=require('node:crypto');
const db=require('../../config/database');
const config=require('../../config');
const p=require('./policy');
const quotas=require('./quotas');
async function transaction(fn) {
 const c=await db.getClient();
 try { await c.query('BEGIN'); const result=await fn(c); await c.query('COMMIT'); return result; }
 catch(e) { await c.query('ROLLBACK'); if(e.code==='23505') throw p.fail('A matching record already exists',409); throw e; }
 finally { c.release(); }
}
function platform(user) { if(!user?.email || !config.adminEmails.includes(user.email.toLowerCase())) throw p.fail('Platform administrator required',403); }
async function audit(c,tenant,user,action,id) { await c.query('INSERT INTO pilot_audit_logs(institute_id,actor_id,action,resource_id) VALUES($1,$2,$3,$4)',[tenant,user.id,action,id||null]); }
async function tenant(c,user,slug,permission) {
 p.slug(slug);
 // Locks make revocation/suspension serialize with already-authorized operations.
 // A new request always re-reads membership; no cached role or caller tenant ID.
 const i=(await c.query("SELECT * FROM pilot_institutes WHERE slug=$1 AND status IN ('trial','active') FOR SHARE",[slug])).rows[0];
 if(!i) throw p.fail('Institute unavailable',404);
 const m=(await c.query("SELECT role FROM pilot_memberships WHERE institute_id=$1 AND user_id=$2 AND status='active' FOR SHARE",[i.id,user.id])).rows[0];
 if(!m) throw p.fail('Institute unavailable',404);
 p.requirePermission(m.role,permission);
 return {institute:i,role:m.role,permissions:[...p.permissions[m.role]],user};
}
const within=(user,slug,permission,fn)=>transaction(async c=>fn(c,await tenant(c,user,slug,permission)));
async function mine(user) { return (await db.query("SELECT i.id,i.slug,i.name,i.status,m.role FROM pilot_memberships m JOIN pilot_institutes i ON i.id=m.institute_id WHERE m.user_id=$1 AND m.status='active' AND i.status IN ('trial','active') ORDER BY i.name",[user.id])).rows; }
async function publicProfile(slug) {
 p.slug(slug); const row=(await db.query("SELECT slug,name,profile FROM pilot_institutes WHERE slug=$1 AND status IN ('active','trial')",[slug])).rows[0];
 if(!row) throw p.fail('Institute unavailable',404); return row;
}
async function apply(user,raw) {
 const name=p.text(raw.name,160,2), legal=p.text(raw.legalName,200,2),slug=p.slug(raw.slug);
 return transaction(async c=>{
  const r=(await c.query('INSERT INTO pilot_applications(applicant_id,name,legal_name,requested_slug) VALUES($1,$2,$3,$4) RETURNING id,status,created_at',[user.id,name,legal,slug])).rows[0];
  await audit(c,null,user,'application.submitted',r.id); return r;
 });
}
async function applications(user) { platform(user); return (await db.query('SELECT a.*,u.email AS applicant_email FROM pilot_applications a JOIN users u ON u.id=a.applicant_id ORDER BY a.created_at DESC LIMIT 100')).rows; }
async function review(user,id,action) {
 platform(user); p.uuid(id); if(!['approve','reject'].includes(action)) throw p.fail('Choose approve or reject');
 return transaction(async c=>{
  const a=(await c.query("SELECT * FROM pilot_applications WHERE id=$1 FOR UPDATE",[id])).rows[0];
  if(!a) throw p.fail('Application not found',404);
  if(a.status!=='pending') throw p.fail('Application already reviewed',409);
  let institute=null;
  if(action==='approve') {
   institute=(await c.query('INSERT INTO pilot_institutes(name,legal_name,slug) VALUES($1,$2,$3) RETURNING id,slug,name,status',[a.name,a.legal_name,a.requested_slug])).rows[0];
   await c.query("INSERT INTO pilot_memberships(institute_id,user_id,role) VALUES($1,$2,'owner')",[institute.id,a.applicant_id]);
  }
  await c.query('UPDATE pilot_applications SET status=$2,institute_id=$3,reviewed_by=$4,reviewed_at=now() WHERE id=$1',[id,action==='approve'?'approved':'rejected',institute?.id||null,user.id]);
  await audit(c,institute?.id||null,user,'application.'+action,id); return {institute,status:action==='approve'?'approved':'rejected'};
 });
}
async function lifecycle(user,id,status) {
 platform(user); p.uuid(id); if(!['active','suspended','archived'].includes(status)) throw p.fail('Invalid lifecycle status');
 return transaction(async c=>{
  const row=(await c.query('UPDATE pilot_institutes SET status=$2,updated_at=now() WHERE id=$1 RETURNING id,slug,status',[id,status])).rows[0];
  if(!row) throw p.fail('Institute not found',404); await audit(c,id,user,'institute.'+status,id); return row;
 });
}
async function settings(user,slug,raw) {
 const profile=p.profile(raw);
 return within(user,slug,'settings:write',async(c,t)=>{
  const row=(await c.query('UPDATE pilot_institutes SET name=$2,profile=$3,updated_at=now() WHERE id=$1 RETURNING slug,name,profile',[t.institute.id,p.text(raw.name,160,2),profile])).rows[0];
  await audit(c,t.institute.id,user,'settings.updated'); return row;
 });
}
async function members(user,slug,{offset=0,search=''}={}) {
 const offsetN=Number(offset); if(!Number.isInteger(offsetN)||offsetN<0||offsetN>100000) throw p.fail('Invalid page');
 const q=p.text(search,100,0);
 return within(user,slug,'members:read',async(c,t)=>(await c.query("SELECT m.user_id,m.role,m.status,u.name,u.email FROM pilot_memberships m JOIN users u ON u.id=m.user_id WHERE m.institute_id=$1 AND (u.name ILIKE $2 OR u.email ILIKE $2) ORDER BY m.created_at,m.user_id LIMIT 50 OFFSET $3",[t.institute.id,'%'+q+'%',offsetN])).rows);
}
async function invite(user,slug,raw) {
 const email=p.email(raw.email), role=raw.role;
 if(!['admin','teacher','student'].includes(role)) throw p.fail('Invalid invitation role');
 return within(user,slug,'members:invite',async(c,t)=>{
  if(role==='admin') p.requirePermission(t.role,'staff:admin');
  const id=randomUUID(),expires=Date.now()+72*3600000,token=p.signInvite(id,expires);
  await c.query('INSERT INTO pilot_invitations(id,institute_id,email,role,token_digest,expires_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,t.institute.id,email,role,p.digest(token),new Date(expires),user.id]);
  await audit(c,t.institute.id,user,'invitation.created',id); return {id,token,expiresAt:new Date(expires).toISOString()};
 });
}
async function invitations(user,slug) { return within(user,slug,'members:invite',async(c,t)=>(await c.query('SELECT id,email,role,expires_at,revoked_at,accepted_at FROM pilot_invitations WHERE institute_id=$1 ORDER BY created_at DESC LIMIT 100',[t.institute.id])).rows); }
async function revokeInvite(user,slug,id) {
 p.uuid(id); return within(user,slug,'members:invite',async(c,t)=>{
  const row=(await c.query('SELECT role FROM pilot_invitations WHERE institute_id=$1 AND id=$2 FOR UPDATE',[t.institute.id,id])).rows[0];
  if(!row) throw p.fail('Invitation not found',404); if(row.role==='admin') p.requirePermission(t.role,'staff:admin');
  await c.query('UPDATE pilot_invitations SET revoked_at=now() WHERE institute_id=$1 AND id=$2 AND accepted_at IS NULL',[t.institute.id,id]);
  await audit(c,t.institute.id,user,'invitation.revoked',id); return {revoked:true};
 });
}
async function accept(user,token) {
 const payload=p.verifyInvite(token);
 return transaction(async c=>{
  // Resolve then lock institute before invitation, matching the issue/revoke order.
  const hint=(await c.query('SELECT institute_id FROM pilot_invitations WHERE id=$1',[payload.id])).rows[0];
  if(!hint) throw p.fail('Invitation unavailable',404);
  const i=(await c.query("SELECT id,slug FROM pilot_institutes WHERE id=$1 AND status IN ('trial','active') FOR SHARE",[hint.institute_id])).rows[0];
  if(!i) throw p.fail('Invitation unavailable',404);
  const inv=(await c.query('SELECT * FROM pilot_invitations WHERE id=$1 AND institute_id=$2 FOR UPDATE',[payload.id,i.id])).rows[0];
  if(inv.token_digest!==p.digest(token)||inv.email!==p.email(user.email)) throw p.fail('Invitation unavailable',404);
  if(inv.revoked_at||inv.accepted_at||new Date(inv.expires_at)<=new Date()) throw p.fail('Invitation expired, revoked or already used',410);
  const issuer=(await c.query("SELECT role FROM pilot_memberships WHERE institute_id=$1 AND user_id=$2 AND status='active' FOR SHARE",[i.id,inv.created_by])).rows[0];
  if(!issuer||!p.can(issuer.role,'members:invite')||(inv.role==='admin'&&!p.can(issuer.role,'staff:admin'))) throw p.fail('Invitation issuer no longer authorized',403);
  // Never let an older invite silently change an existing role or resurrect revoked membership.
  const exists=await c.query('SELECT 1 FROM pilot_memberships WHERE institute_id=$1 AND user_id=$2',[i.id,user.id]);
  if(exists.rowCount) throw p.fail('Membership already exists; ask the owner to review it',409);
  if(inv.role==='student'||inv.role==='teacher')await quotas.requireCapacity(c,i.id,inv.role==='student'?'students':'teachers');
  await c.query('INSERT INTO pilot_memberships(institute_id,user_id,role) VALUES($1,$2,$3)',[i.id,user.id,inv.role]);
  await c.query('UPDATE pilot_invitations SET accepted_at=now(),accepted_by=$2 WHERE id=$1',[inv.id,user.id]);
  await audit(c,i.id,user,'invitation.accepted',inv.id); return {slug:i.slug,role:inv.role};
 });
}
async function revokeMember(user,slug,id) {
 p.uuid(id); return within(user,slug,'members:revoke',async(c,t)=>{
  const m=(await c.query('SELECT role FROM pilot_memberships WHERE institute_id=$1 AND user_id=$2 FOR UPDATE',[t.institute.id,id])).rows[0];
  if(!m) throw p.fail('Member not found',404);
  if(m.role==='owner'||id===user.id||(m.role==='admin'&&t.role!=='owner')) throw p.fail('This membership cannot be revoked by you',403);
  await c.query("UPDATE pilot_memberships SET status='revoked',updated_at=now() WHERE institute_id=$1 AND user_id=$2",[t.institute.id,id]);
  await c.query('UPDATE pilot_invitations SET revoked_at=now() WHERE institute_id=$1 AND created_by=$2 AND accepted_at IS NULL',[t.institute.id,id]);
  await audit(c,t.institute.id,user,'membership.revoked',id); return {revoked:true};
 });
}
async function workspace(user,slug) { return within(user,slug,'workspace:read',async(c,t)=>{
 const counts=(t.role==='owner'||t.role==='admin')?(await c.query(`SELECT
 (SELECT count(*)::int FROM pilot_memberships WHERE institute_id=$1 AND role='student' AND status='active') AS students,
 (SELECT count(*)::int FROM pilot_batches WHERE institute_id=$1) AS batches,
 (SELECT count(*)::int FROM pilot_exams WHERE institute_id=$1 AND status='published') AS published_exams,
 (SELECT count(*)::int FROM pilot_attempts WHERE institute_id=$1 AND submitted_at IS NOT NULL) AS submitted_attempts`,[t.institute.id])).rows[0]:null;
 const activity=(t.role==='owner'||t.role==='admin')?(await c.query('SELECT action,created_at FROM pilot_audit_logs WHERE institute_id=$1 ORDER BY id DESC LIMIT 20',[t.institute.id])).rows:[];
 return {institute:{id:t.institute.id,slug:t.institute.slug,name:t.institute.name,status:t.institute.status,profile:t.institute.profile},role:t.role,permissions:t.permissions,counts,activity,modules:{delivery:process.env.INSTITUTE_DELIVERY_ENABLED==='true',billing:process.env.INSTITUTE_BILLING_ENABLED==='true'}};
 }); }
module.exports={transaction,platform,audit,tenant,within,mine,publicProfile,apply,applications,review,lifecycle,settings,members,invite,invitations,revokeInvite,accept,revokeMember,workspace};
