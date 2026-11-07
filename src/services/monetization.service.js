 'use strict';
const db = require('../config/database');
const config = require('../config');
const { isPlanActive } = require('./plan.service');
const { isFullCglMock } = require('./ssc-full-mock-classifier');
const fail = (message,statusCode=400)=>Object.assign(new Error(message),{statusCode});
const enabled = ()=>process.env.MONETIZATION_ENABLED==='true';
const owner = user=>!!user?.email && config.adminEmails.includes(user.email.toLowerCase());
const PRODUCTS = Object.freeze({
 SSC_PACK_49:{title:'SSC CGL mock pass',amount:49,days:30},
 IT_EBOOK_PACK_99:{title:'IT ebook & assessment pass',amount:99,days:60},
 PRO_MONTHLY:{title:'Pro monthly',amount:199,days:30},
 PRO_ANNUAL:{title:'Pro annual',amount:999,days:365},
 SINGLE_SOLUTION_29:{title:'Live mock solutions & percentile',amount:29,days:3650},
 LIVE_ENTRY_19:{title:'Live mock entry',amount:19,days:30}
});
const SLOTS={HOME_TOP_BANNER:999,CATEGORY_NATIVE_CARD:499,EBOOK_RAIL_SPONSOR:799,RESULT_SCREEN_OFFER:699};
const CATEGORIES=['ALL','SSC','Banking','Railways','UPSC','Campus','IT'];
function text(v,max=140,required=true){if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw fail('Invalid text field');return v.trim();}
function url(v){const s=text(v,2048);let u;try{u=new URL(s);}catch{throw fail('A valid HTTPS URL is required');}if(u.protocol!=='https:'||u.username||u.password||u.hostname==='localhost'||/^(127\.|10\.|192\.168\.|\[)/.test(u.hostname))throw fail('Public HTTPS URL required');return u.href;}
function slug(v){if(typeof v!=='string'||!/^[a-z0-9][a-z0-9-]{1,59}$/.test(v))throw fail('Invalid ID');return v;}
function product(code){if(!Object.hasOwn(PRODUCTS,code))throw fail('Unknown product');return PRODUCTS[code];}
async function documents(kind){return (await db.query('SELECT id,document FROM monetization_documents WHERE kind=$1 ORDER BY updated_at DESC',[kind])).rows.map(r=>({...r.document,id:r.id}));}
async function document(kind,id){return (await db.query('SELECT document FROM monetization_documents WHERE kind=$1 AND id=$2',[kind,id])).rows[0]?.document||null;}
async function put(kind,id,doc){await db.query(`INSERT INTO monetization_documents(kind,id,document) VALUES($1,$2,$3::jsonb) ON CONFLICT(kind,id) DO UPDATE SET document=EXCLUDED.document,updated_at=now()`,[kind,id,JSON.stringify(doc)]);return {...doc,id};}
async function entitlement(user,code,resource=''){
 if(owner(user)||isPlanActive(user?.plan,user?.planExpiresAt))return true;
 if(!enabled()||!user?.id||user.id==='guest')return false;
 const r=await db.query(`SELECT 1 FROM monetization_grants WHERE user_id=$1 AND expires_at>now() AND (code IN ('PRO_MONTHLY','PRO_ANNUAL') OR (code=$2 AND resource_id=$3)) LIMIT 1`,[user.id,code,resource]);return r.rowCount>0;
}
async function mockAccess(user,summary){
 if(isPlanActive(user?.plan,user?.planExpiresAt))return true;
 if(!enabled())return false;
 return entitlement(user,isFullCglMock(summary)&&/^ssc-cgl-2026-/.test(summary.id)?'SSC_PACK_49':'__PRO_ONLY__');
}
async function grant(client,userId,code,resource,reference,actor){
 const p=product(code);
 // Advisory lock + unique reference prevent duplicate and concurrent extensions.
 await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[reference]);
 const seen=await client.query('SELECT * FROM monetization_grants WHERE reference=$1',[reference]);
 if(seen.rowCount){if(seen.rows[0].user_id!==userId||seen.rows[0].code!==code||seen.rows[0].resource_id!==resource)throw fail('Reference already used for a different grant',409);return {duplicate:true};}
 await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId]);
 await client.query(`INSERT INTO monetization_grants(user_id,code,resource_id,expires_at,reference,granted_by)
 VALUES($1,$2,$3,GREATEST(now(),COALESCE((SELECT MAX(expires_at) FROM monetization_grants WHERE user_id=$1 AND code=$2 AND resource_id=$3),now()))+($4*interval '1 day'),$5,$6)`,[userId,code,resource,p.days,reference,actor]);
 if(code==='PRO_MONTHLY'||code==='PRO_ANNUAL'){
  // Preserve Institute membership; never downgrade it on a Pro purchase.
  await client.query(`UPDATE users SET plan=CASE WHEN plan='institute' AND plan_expires_at>now() THEN plan ELSE 'pro' END,plan_expires_at=GREATEST(now(),COALESCE(plan_expires_at,now()))+($2*interval '1 day'),payment_status='paid',updated_at=now() WHERE id=$1`,[userId,p.days]);
 }
 return {granted:true};
}
async function transaction(fn){const c=await db.getClient();try{await c.query('BEGIN');const result=await fn(c);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
async function validateResource(user,code,resource){
 if(!['SINGLE_SOLUTION_29','LIVE_ENTRY_19'].includes(code)){if(resource)throw fail('This product has no resource ID');return;}
 slug(resource);const event=await document('event',resource);if(!event?.active)throw fail('Live event unavailable',404);
 if(code==='LIVE_ENTRY_19'&&(event.entryFee!==19||Date.now()>=Date.parse(event.endsAt)))throw fail('Paid entry unavailable');
 if(code==='SINGLE_SOLUTION_29'){
  if(Date.now()<Date.parse(event.endsAt))throw fail('Solutions become available after the event closes');
  const r=await db.query(`SELECT 1 FROM exam_attempts_v2 a JOIN monetization_registrations r ON r.user_id=a.user_id AND r.event_id=$3 WHERE a.user_id=$1 AND a.test_id=$2 AND a.submitted_at IS NOT NULL AND a.started_at >= $4 AND a.started_at <= $5 LIMIT 1`,[user.id,event.mockId,resource,event.startsAt,event.endsAt]);
  if(!r.rowCount)throw fail('Complete this live mock before purchasing its solutions');
 }
}
async function manual(raw,actor){
 product(raw.code);const email=text(raw.email,255).toLowerCase(),reference=text(raw.reference,120);
 if(reference.length<8||raw.paymentVerified!==true)throw fail('Verify the payment and supply its unique reference');
 const u=(await db.query('SELECT id,email FROM users WHERE LOWER(email)=$1',[email])).rows[0];if(!u)throw fail('Ask the student to sign in first',404);
 const resource=raw.resourceId||'';await validateResource(u,raw.code,resource);
 return transaction(c=>grant(c,u.id,raw.code,resource,'manual:'+reference,actor.email));
}
function validateAd(raw){
 if(!Object.hasOwn(SLOTS,raw.slotType)||!CATEGORIES.includes(raw.targetCategory)||![7,30].includes(raw.durationDays))throw fail('Invalid slot, category or duration');
 if(raw.durationDays===30&&raw.slotType!=='HOME_TOP_BANNER')throw fail('Monthly booking is available only for the homepage banner');
 const email=text(raw.contactEmail,255);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw fail('Valid contact email required');
 const phone=text(raw.whatsappNumber,15);if(!/^[1-9]\d{9,14}$/.test(phone))throw fail('Use country code and WhatsApp digits');
 return {advertiserName:text(raw.advertiserName,80),contactEmail:email,whatsappNumber:phone,slotType:raw.slotType,targetCategory:raw.targetCategory,headline:text(raw.headline,70),subtext:text(raw.subtext,140),ctaLabel:text(raw.ctaLabel,40),destinationUrl:url(raw.destinationUrl),badgeText:text(raw.badgeText||'Sponsored',70),durationDays:raw.durationDays,paymentReference:text(raw.paymentReference,120),amountInr:raw.durationDays===30?2999:SLOTS[raw.slotType],status:'pending_review',expiresAt:null};
}
const activeAd=a=>a.status==='active'&&Date.parse(a.expiresAt)>Date.now();
async function ads(){return (await documents('ad')).filter(activeAd).map(({id,slotType,targetCategory,headline,subtext,ctaLabel,destinationUrl,badgeText,expiresAt})=>({id,slotType,targetCategory,headline,subtext,ctaLabel,destinationUrl,badgeText,expiresAt}));}
async function track(kind,id,raw){
 if(!['impression','click'].includes(raw.event)||!/^[a-f0-9-]{36}$/i.test(raw.sessionId||''))throw fail('Invalid telemetry');
 const d=await document(kind,id);if(!d||(kind==='ad'?!activeAd(d):!d.active))throw fail('Placement unavailable',404);
 await db.query('INSERT INTO monetization_metrics(kind,id,event,session_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[kind,id,raw.event,raw.sessionId]);return {recorded:true};
}
async function adAction(id,action,verified){
 return transaction(async c=>{
  const r=await c.query("SELECT document FROM monetization_documents WHERE kind='ad' AND id=$1 FOR UPDATE",[id]);if(!r.rowCount)throw fail('Ad not found',404);const d=r.rows[0].document;
  if(action==='delete'){await c.query("DELETE FROM monetization_documents WHERE kind='ad' AND id=$1",[id]);return {deleted:true};}
  if(action==='approve'){if(verified!==true)throw fail('Confirm payment and creative review first');d.status='active';d.expiresAt=new Date(Date.now()+d.durationDays*86400000).toISOString();}
  else if(action==='pause')d.status='paused';
  else if(action==='extend'){if(verified!==true)throw fail('Confirm renewal payment');d.status='active';d.expiresAt=new Date(Math.max(Date.now(),Date.parse(d.expiresAt)||0)+7*86400000).toISOString();}
  else throw fail('Invalid action');
  await c.query("UPDATE monetization_documents SET document=$2::jsonb,updated_at=now() WHERE kind='ad' AND id=$1",[id,JSON.stringify(d)]);return d;
 });
}
async function save(kind,id,r){
 slug(id);let d;
 if(kind==='institute'){
  if(!/^#[0-9a-f]{6}$/i.test(r.accentColor)||!Array.isArray(r.assignedTestIds)||r.assignedTestIds.length>100||!r.assignedTestIds.every(x=>/^[a-z0-9-]{1,60}$/.test(x))||!Number.isInteger(r.monthlyFeeInr)||r.monthlyFeeInr<3500||r.monthlyFeeInr>10000||!/^\d{10,15}$/.test(r.whatsapp))throw fail('Invalid institute profile');
  d={name:text(r.name,100),tagline:text(r.tagline,160,false),accentColor:r.accentColor,logo:r.logo?url(r.logo):'',whatsapp:r.whatsapp,assignedTestIds:r.assignedTestIds,monthlyFeeInr:r.monthlyFeeInr,active:r.active===true};
 }else if(kind==='event'){
  if(![0,19].includes(r.entryFee)||!Number.isFinite(Date.parse(r.startsAt))||!Number.isFinite(Date.parse(r.endsAt))||Date.parse(r.endsAt)<=Date.parse(r.startsAt))throw fail('Valid event dates and entry fee required');
  const found=await require('./mocks.service').findMock(slug(r.mockId));if(!found||found.tier!=='free')throw fail('Select a published Free mock; existing mock access is preserved');
  d={title:text(r.title,140),prizeNote:text(r.prizeNote,200,false),mockId:r.mockId,startsAt:new Date(r.startsAt).toISOString(),endsAt:new Date(r.endsAt).toISOString(),entryFee:r.entryFee,active:r.active===true};
 }else if(kind==='affiliate'){d={topic:text(r.topic,80),title:text(r.title,120),destinationUrl:url(r.destinationUrl),active:r.active===true};}
 else if(kind==='ebook'){
  if(!Number.isInteger(r.freePreviewChapters)||r.freePreviewChapters<2||r.freePreviewChapters>50)throw fail('Preview must include at least two chapters');
  if(require('../../content/ebooks-starter.json').some(b=>b.slug===id)&&r.isFreemiumGated)throw fail('Built-in public editions cannot be paywalled. Create an original premium ebook.');
  const book=(await db.query('SELECT document FROM ebooks WHERE slug=$1 AND NOT archived',[id])).rows[0];
  if(!book)throw fail('Ebook not found',404);
  if(r.isFreemiumGated&&r.requireProForPdf!==false&&book.document.pdfUrl&&book.document.pdfUrl!==`/api/v1/ebooks/${id}/pdf`)throw fail('Upload the PDF through Ebook Studio before protecting it; public external PDF links cannot be secured');
  d={isFreemiumGated:r.isFreemiumGated===true,freePreviewChapters:r.freePreviewChapters,requireProForPdf:r.requireProForPdf!==false};
 }else throw fail('Invalid configuration kind');return put(kind,id,d);
}
async function ebookPolicy(slug,user){
 if(!enabled())return null;const p=await document('ebook',slug);if(!p?.isFreemiumGated)return null;
 return {...p,locked:!await entitlement(user,'IT_EBOOK_PACK_99')};
}
module.exports={enabled,owner,PRODUCTS,SLOTS,CATEGORIES,fail,product,documents,document,put,entitlement,mockAccess,grant,transaction,manual,validateResource,validateAd,ads,track,adAction,save,ebookPolicy,url,activeAd};
