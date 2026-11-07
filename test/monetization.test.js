'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
process.env.ADMIN_EMAILS='owner@example.test';
process.env.MONETIZATION_ENABLED='true';
const m=require('../src/services/monetization.service'),pay=require('../src/services/monetization-payments.service'),db=require('../src/config/database');
const original={query:db.query,getClient:db.getClient,fetch:global.fetch};
const user={id:'11111111-1111-4111-8111-111111111111',email:'learner@example.test',plan:'free'};
const ad={advertiserName:'Academy',contactEmail:'ads@example.test',whatsappNumber:'919986418638',slotType:'HOME_TOP_BANNER',targetCategory:'SSC',headline:'New practice batch',subtext:'Learn with reviewed mocks',ctaLabel:'Learn more',destinationUrl:'https://example.test/course',badgeText:'Partner',durationDays:7,paymentReference:'UTR-123456789'};
test.afterEach(()=>{db.query=original.query;db.getClient=original.getClient;global.fetch=original.fetch;});
test('products have fixed prices, scope and expiry; unrecognised products fail closed',()=>{
 assert.equal(m.product('SSC_PACK_49').days,30);assert.equal(m.product('IT_EBOOK_PACK_99').days,60);assert.equal(m.product('PRO_ANNUAL').amount,999);
 assert.throws(()=>m.product('__proto__'));assert.throws(()=>m.product('fake'));
});
test('ad validation ignores injected approval and pricing, and rejects script URLs and invalid slots',()=>{
 const a=m.validateAd({...ad,status:'active',amountInr:1,impressions:10000});assert.equal(a.status,'pending_review');assert.equal(a.amountInr,999);assert.equal(a.impressions,undefined);
 for(const destinationUrl of ['javascript:alert(1)','http://example.test','https://user:pass@example.test'])assert.throws(()=>m.validateAd({...ad,destinationUrl}));
 assert.throws(()=>m.validateAd({...ad,slotType:'__proto__'}));assert.throws(()=>m.validateAd({...ad,headline:'a'.repeat(71)}));assert.throws(()=>m.validateAd({...ad,slotType:'CATEGORY_NATIVE_CARD',durationDays:30}));
});
test('ad publication requires active status and a future expiry',()=>{
 assert.equal(m.activeAd({status:'pending_review',expiresAt:'2099-01-01'}),false);assert.equal(m.activeAd({status:'active',expiresAt:'2000-01-01'}),false);assert.equal(m.activeAd({status:'active',expiresAt:'2099-01-01'}),true);
});
test('SSC pass cannot grant unrelated premium mocks; server checks resource scope and expiry',async()=>{
 const requested=[];db.query=async(sql,p)=>{assert.match(sql,/expires_at>now\(\)/);requested.push(p[1]);return {rowCount:p[1]==='SSC_PACK_49'?1:0,rows:[]};};
 assert.equal(await m.mockAccess(user,{id:'ssc-cgl-2026-mock-01'}),true);assert.equal(await m.mockAccess(user,{id:'bank-po-mock-01'}),false);assert.equal(await m.entitlement(user,'IT_EBOOK_PACK_99'),false);
 assert.deepEqual(requested,['SSC_PACK_49','__PRO_ONLY__','IT_EBOOK_PACK_99']);
});
test('browser role or plan labels do not bypass expiry or server grants',async()=>{
 db.query=async()=>({rowCount:0,rows:[]});assert.equal(await m.entitlement({...user,role:'admin',plan:'pro',planExpiresAt:'2000-01-01'},'IT_EBOOK_PACK_99'),false);
 assert.equal(m.owner({...user,role:'admin'}),false);assert.equal(await m.entitlement(null,'IT_EBOOK_PACK_99'),false);
});
test('manual payment requires a verified reference and an existing user',async()=>{
 await assert.rejects(m.manual({...user,code:'SSC_PACK_49',reference:'UTR123456'},user),/Verify/);
 db.query=async()=>({rows:[],rowCount:0});await assert.rejects(m.manual({email:user.email,code:'SSC_PACK_49',reference:'UTR123456',paymentVerified:true},user),/sign in/);
});
test('grant retries are idempotent and conflicting reference reuse is rejected',async()=>{
 let mutations=0;const client={query:async(sql)=>{if(sql.startsWith('INSERT')||sql.startsWith('UPDATE'))mutations++;return sql.includes('WHERE reference=')?{rowCount:1,rows:[{user_id:user.id,code:'SSC_PACK_49',resource_id:''}]}:{rowCount:0,rows:[]};}};
 assert.deepEqual(await m.grant(client,user.id,'SSC_PACK_49','','manual:UTR123','owner'),{duplicate:true});assert.equal(mutations,0);
 await assert.rejects(m.grant(client,user.id,'IT_EBOOK_PACK_99','','manual:UTR123','owner'),/different grant/);
});
test('public ad response strips advertiser contact and payment data and excludes pending/expired ads',async()=>{
 db.query=async()=>({rows:[{id:'active',document:{...m.validateAd(ad),status:'active',expiresAt:'2099-01-01'}},{id:'pending',document:m.validateAd(ad)}]});
 const result=await m.ads();assert.equal(result.length,1);assert.equal(result[0].id,'active');assert.doesNotMatch(JSON.stringify(result),/contactEmail|paymentReference|whatsappNumber/);
});
test('bundled public editions cannot be silently paywalled',async()=>{
 await assert.rejects(m.save('ebook','python-mastery',{isFreemiumGated:true,freePreviewChapters:2}),/public editions/);
 await assert.rejects(m.save('ebook','new-book',{isFreemiumGated:true,freePreviewChapters:1}),/at least two/);
});
test('ebook API redacts paid chapters and blocks PDF, practice and assessment starts',async()=>{
 const book=structuredClone(require('../content/ebooks-starter.json')[0]);book.slug='original-premium';book.pdfUrl='/api/v1/ebooks/original-premium/pdf';
 db.query=async(sql)=>sql.includes('monetization_documents')?{rows:[{document:{isFreemiumGated:true,freePreviewChapters:2,requireProForPdf:true}}]}:{rows:[],rowCount:0};
 const local={query:async(sql)=>sql.includes('FROM ebooks ')?{rows:[{slug:book.slug,visibility:'public',document:book,revision:1}]}:{rows:[]},getClient:async()=>({...local,release(){}})};
 const books=require('../src/services/ebooks.service').createEbooksService(local);
 const preview=await books.get(book.slug,user);assert.equal(preview.chapters.length,2);assert.equal(preview.pdfUrl,undefined);assert.equal(preview.allowPdfDownload,false);assert.equal(preview.finalExamQuestions,undefined);
 await assert.rejects(books.practice(book.slug,user),/pass or Pro/);await assert.rejects(books.pdf(book.slug,user),/pass or Pro/);await assert.rejects(books.start(book.slug,user,{}),/pass or Pro/);
});
function configure(){process.env.MONETIZATION_CASHFREE_MODE='sandbox';process.env.MONETIZATION_CASHFREE_APP_ID='test-app';process.env.MONETIZATION_CASHFREE_SECRET='test-only-secret';process.env.MONETIZATION_FRONTEND_ORIGIN='https://exampro-staging-ui.vercel.app';process.env.MONETIZATION_API_ORIGIN='https://staging.example.test';}
test('live payments require a separate explicit switch; webhook HMAC covers original bytes',()=>{
 configure();process.env.MONETIZATION_CASHFREE_MODE='production';delete process.env.MONETIZATION_LIVE_PAYMENTS_ENABLED;assert.throws(()=>pay.settings(),/disabled/);configure();
 const raw=Buffer.from('{"type":"PAYMENT_SUCCESS_WEBHOOK"}'),timestamp='1793454000';const signature=crypto.createHmac('sha256',process.env.MONETIZATION_CASHFREE_SECRET).update(timestamp).update(raw).digest('base64');assert.doesNotThrow(()=>pay.verify(raw,signature,timestamp));assert.throws(()=>pay.verify(Buffer.from('{}'),signature,timestamp),/signature/);
});
test('Cashfree order amount and identity come from server rather than the request',async()=>{
 configure();db.query=async()=>({rows:[],rowCount:1});global.fetch=async(url,options)=>{assert.match(url,/sandbox.cashfree.com/);const body=JSON.parse(options.body);assert.equal(body.order_amount,49);assert.equal(body.customer_details.customer_id,user.id);return {ok:true,json:async()=>({order_id:body.order_id,payment_session_id:'session-test'})};};
 const r=await pay.create(user,{code:'SSC_PACK_49',phone:'9986418638',amount:1,userId:'attacker'});assert.equal(r.amountInr,49);
});
test('payment reconciliation rejects mismatched amount and user identity without granting',async()=>{
 configure();const id='ep_'+'a'.repeat(32);db.query=async()=>({rows:[{id,user_id:user.id,amount_inr:49,mode:'sandbox',status:'pending'}],rowCount:1});db.getClient=async()=>{throw Error('must not grant');};
 global.fetch=async()=>({ok:true,json:async()=>({order_id:id,order_status:'PAID',order_amount:1,order_currency:'INR',customer_details:{customer_id:user.id}})});assert.deepEqual(await pay.reconcile(id,user.id),{status:'pending'});
});
test('admin routes reject anonymous and non-owner identities; legacy routes pass through',async()=>{
 const express=require('express'),app=express();app.use(express.json());const identity=(req,res,next)=>{if(!req.get('x-test-email'))return res.sendStatus(401);req.user={...user,email:req.get('x-test-email')};next();};app.use(require('../src/routes/monetization').createRouter(identity));app.get('/health',(_req,res)=>res.json({healthy:true}));app.use((e,_req,res,_next)=>res.status(e.statusCode||500).json({message:e.message}));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});const base='http://127.0.0.1:'+server.address().port;
 try{assert.equal((await fetch(base+'/admin/monetization')).status,401);assert.equal((await fetch(base+'/admin/monetization',{headers:{'x-test-email':user.email}})).status,403);assert.equal((await fetch(base+'/health')).status,200);}finally{await new Promise(resolve=>server.close(resolve));}
});
test('verified Cashfree settlement grants exactly once across webhook/status retries',async()=>{
 configure();const id='ep_'+'b'.repeat(32),row={id,user_id:user.id,code:'SSC_PACK_49',resource_id:'',amount_inr:49,mode:'sandbox',status:'pending'};let grants=0,commits=0;
 db.query=async()=>({rows:[row],rowCount:1});
 db.getClient=async()=>({release(){},query:async(sql)=>{
  if(sql==='COMMIT')commits++;
  if(sql.includes('FROM monetization_orders'))return {rows:[row],rowCount:1};
  if(sql.includes('WHERE reference='))return {rows:[],rowCount:0};
  if(sql.startsWith('INSERT INTO monetization_grants'))grants++;
  if(sql.startsWith('UPDATE monetization_orders'))row.status='paid';
  return {rows:[],rowCount:1};
 }});
 global.fetch=async()=>({ok:true,json:async()=>({order_id:id,order_status:'PAID',order_amount:49,order_currency:'INR',customer_details:{customer_id:user.id}})});
 assert.deepEqual(await pay.reconcile(id,user.id),{status:'paid'});assert.deepEqual(await pay.reconcile(id,user.id),{status:'paid'});assert.equal(grants,1);assert.equal(commits,1);
});
