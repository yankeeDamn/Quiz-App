 'use strict';
const {Router}=require('express');
const {rateLimit}=require('express-rate-limit');
const {randomUUID}=require('node:crypto');
const db=require('../config/database');
const m=require('../services/monetization.service');
const pay=require('../services/monetization-payments.service');
const advertising=require('../services/advertising-verification.service');
const {authenticateNextAuth}=require('../middleware/nextauth');
function createRouter(identity=authenticateNextAuth){
 const r=Router(),wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next),ok=(res,data)=>res.json({success:true,data});
 r.use((req,res,next)=>/^\/(monetization|ads|payments|admin\/monetization)(\/|$)/.test(req.path)?next():next('router'));
 r.use((_req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
 r.use((req,res,next)=>m.enabled()?next():res.status(404).json({success:false,error:{message:'Monetization setup is not enabled yet.'}}));
 const publicLimit=rateLimit({windowMs:60000,limit:60,standardHeaders:'draft-7',legacyHeaders:false});
 const submitLimit=rateLimit({windowMs:3600000,limit:5,standardHeaders:'draft-7',legacyHeaders:false});
 r.get('/monetization/config',wrap(async(_req,res)=>ok(res,{products:m.PRODUCTS,upiId:process.env.MONETIZATION_UPI_ID||'',checkout:(()=>{try{return pay.settings().mode;}catch{return null;}})()})));
 r.get('/monetization/me',identity,wrap(async(req,res)=>ok(res,{adFree:await m.entitlement(req.user,'__PRO_ONLY__'),ssc:await m.entitlement(req.user,'SSC_PACK_49'),ebooks:await m.entitlement(req.user,'IT_EBOOK_PACK_99')})));
 r.get('/ads',publicLimit,wrap(async(_req,res)=>ok(res,{ads:await m.ads()})));
 r.post('/ads/submit',submitLimit,wrap(async(req,res)=>{const id=randomUUID();await m.put('ad',id,m.validateAd(req.body));res.status(201);ok(res,{id,status:'pending_review'});}));
 r.post('/ads/:id/track',publicLimit,wrap(async(req,res)=>ok(res,await m.track('ad',req.params.id,req.body))));
 r.get('/monetization/affiliates',publicLimit,wrap(async(_req,res)=>ok(res,{affiliates:(await m.documents('affiliate')).filter(a=>a.active)})));
 r.post('/monetization/affiliates/:id/track',publicLimit,wrap(async(req,res)=>ok(res,await m.track('affiliate',req.params.id,{...req.body,event:'click'}))));
 r.get('/monetization/events',publicLimit,wrap(async(_req,res)=>{
  const events=(await m.documents('event')).filter(e=>e.active);
  const counts=(await db.query('SELECT event_id,count(*)::int AS count FROM monetization_registrations GROUP BY event_id')).rows;
  ok(res,{events:events.map(e=>({...e,registered:counts.find(c=>c.event_id===e.id)?.count||0}))});
 }));
 r.post('/monetization/events/:id/register',identity,wrap(async(req,res)=>{
  const e=await m.document('event',req.params.id);if(!e?.active||Date.now()>Date.parse(e.endsAt))throw m.fail('Registration closed',409);
  if(e.entryFee===19&&!await m.entitlement(req.user,'LIVE_ENTRY_19',req.params.id))throw m.fail('Paid event entry required',403);
  await db.query('INSERT INTO monetization_registrations(event_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.params.id,req.user.id]);ok(res,{registered:true,mockId:e.mockId,startsAt:e.startsAt});
 }));
 r.get('/monetization/events/:id/results',identity,wrap(async(req,res)=>{
  const e=await m.document('event',req.params.id);if(!e?.active||Date.now()<Date.parse(e.endsAt))throw m.fail('Results are not available yet',409);
  if(!await m.entitlement(req.user,'SINGLE_SOLUTION_29',req.params.id))throw m.fail('Unlock the event solutions to view this report',403);
  const rows=(await db.query(`SELECT DISTINCT ON(a.user_id) a.user_id,a.id,a.result,a.snapshot FROM exam_attempts_v2 a JOIN monetization_registrations r ON r.user_id=a.user_id AND r.event_id=$1 WHERE a.test_id=$2 AND a.submitted_at IS NOT NULL AND a.started_at >= $3 AND a.started_at <= $4 ORDER BY a.user_id,a.started_at ASC`,[req.params.id,e.mockId,e.startsAt,e.endsAt])).rows;
  const own=rows.find(a=>a.user_id===req.user.id);if(!own)throw m.fail('No completed event attempt',404);
  const score=Number(own.result?.percentage||0),better=rows.filter(a=>Number(a.result?.percentage||0)>score).length,below=rows.filter(a=>Number(a.result?.percentage||0)<score).length;
  ok(res,{rank:better+1,participants:rows.length,percentile:rows.length?100*below/rows.length:0,method:'First completed attempt per registered participant; percentile is percentage scoring strictly below you.',solutions:own.snapshot.questions.map(q=>({id:q.id,question:q.question,answer:q.answer,explanation:q.explanation}))});
 }));
 r.get('/monetization/institutes/:id',publicLimit,wrap(async(req,res)=>{
  const d=await m.document('institute',req.params.id);if(!d?.active)throw m.fail('Institute not found',404);
  const catalogue=await require('../services/mocks.service').listMocks();const {monthlyFeeInr,...profile}=d;
  ok(res,{...profile,id:req.params.id,tests:catalogue.filter(t=>d.assignedTestIds.includes(t.id))});
 }));
 r.get('/monetization/institutes/:id/leaderboard',identity,wrap(async(req,res)=>{
  const d=await m.document('institute',req.params.id);if(!d?.active)throw m.fail('Institute not found',404);
  const member=await db.query('SELECT 1 FROM monetization_members WHERE institute_id=$1 AND user_id=$2',[req.params.id,req.user.id]);if(!member.rowCount&&!m.owner(req.user))throw m.fail('Batch membership required',403);
  const rows=(await db.query(`SELECT a.user_id,MAX((a.result->>'percentage')::numeric) AS percentage FROM exam_attempts_v2 a JOIN monetization_members m ON m.user_id=a.user_id AND m.institute_id=$1 WHERE a.test_id=ANY($2::text[]) AND a.submitted_at IS NOT NULL GROUP BY a.user_id ORDER BY percentage DESC LIMIT 50`,[req.params.id,d.assignedTestIds])).rows;
  ok(res,{leaders:rows.map((x,i)=>({rank:i+1,name:x.user_id===req.user.id?'You':'Batch learner '+(i+1),percentage:Number(x.percentage)}))});
 }));
 r.post('/payments/create-order',identity,publicLimit,wrap(async(req,res)=>ok(res,await pay.create(req.user,req.body))));
 r.post('/payments/webhook',wrap(async(req,res)=>ok(res,await pay.webhook(req.body,req.get('x-webhook-signature'),req.get('x-webhook-timestamp')))));
 r.get('/payments/orders/:id',identity,publicLimit,wrap(async(req,res)=>ok(res,await pay.reconcile(req.params.id,req.user.id))));
 r.use('/admin/monetization',identity,(req,res,next)=>m.owner(req.user)?next():res.status(403).json({success:false,error:{message:'Owner admin access required'}}));
 r.get('/admin/monetization',wrap(async(req,res)=>{
  const [ads,institutes,events,affiliates,ebooks,metrics]=await Promise.all([m.documents('ad'),m.documents('institute'),m.documents('event'),m.documents('affiliate'),m.documents('ebook'),db.query("SELECT kind,id,event,count(*)::int AS count FROM monetization_metrics GROUP BY kind,id,event")]);
  ok(res,{advertisingPaymentVerification:advertising.enabled(),adPayments:await advertising.payments(req.user),ads:ads.map(a=>({...a,status:a.status==='active'&&!m.activeAd(a)?'expired':a.status,impressions:metrics.rows.find(x=>x.kind==='ad'&&x.id===a.id&&x.event==='impression')?.count||0,clicks:metrics.rows.find(x=>x.kind==='ad'&&x.id===a.id&&x.event==='click')?.count||0})),institutes,events,affiliates,ebooks});
 }));
 r.post('/admin/monetization/grants',wrap(async(req,res)=>ok(res,await m.manual(req.body,req.user))));
 r.post('/admin/monetization/ads/:id',wrap(async(req,res)=>ok(res,await m.adAction(req.params.id,req.body,req.user))));
 r.post('/admin/monetization/ads/:id/verify-payment',wrap(async(req,res)=>ok(res,await advertising.verify(req.params.id,req.body,req.user))));
 r.put('/admin/monetization/config/:kind/:id',wrap(async(req,res)=>ok(res,await m.save(req.params.kind,req.params.id,req.body))));
 r.post('/admin/monetization/institutes/:id/members',wrap(async(req,res)=>{
  if(!await m.document('institute',req.params.id))throw m.fail('Institute not found',404);
  const u=(await db.query('SELECT id FROM users WHERE LOWER(email)=LOWER($1)',[req.body.email])).rows[0];if(!u)throw m.fail('Student must sign in first',404);
  await db.query('INSERT INTO monetization_members(institute_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.params.id,u.id]);ok(res,{added:true});
 }));
 return r;
}
module.exports={router:createRouter(),createRouter};
