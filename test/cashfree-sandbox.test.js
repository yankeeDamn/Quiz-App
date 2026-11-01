'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
process.env.CASHFREE_SANDBOX_ENABLED='true';
process.env.CASHFREE_ENV='sandbox';
process.env.CASHFREE_APP_ID='sandbox-app';
process.env.CASHFREE_SECRET_KEY='sandbox-secret-for-hmac';
process.env.CASHFREE_SANDBOX_API_ORIGIN='https://exampro-staging-api.onrender.com';
process.env.CASHFREE_SANDBOX_FRONTEND_ORIGIN='https://exampro-staging-ui.vercel.app';
const gate=require('../src/services/draft-testing-gate');
const db=require('../src/config/database');
const cashfree=require('../src/services/cashfree-sandbox.service');
const original={enabled:gate.enabled,query:db.query,getClient:db.getClient,fetch:global.fetch};
const user={id:'11111111-1111-4111-8111-111111111111',email:'student@example.test'};
const sign=(raw,timestamp='1793454000')=>({
 signature:crypto.createHmac('sha256',process.env.CASHFREE_SECRET_KEY).update(timestamp).update(raw).digest('base64'),
 timestamp
});
test.after(()=>{gate.enabled=original.enabled;db.query=original.query;db.getClient=original.getClient;global.fetch=original.fetch;});
test('sandbox guard fails closed even when the feature flag alone is set',()=>{
 gate.enabled=()=>false;
 assert.equal(cashfree.enabled(),false);
 assert.throws(()=>cashfree.guard(),e=>e.statusCode===404);
 gate.enabled=()=>true;
 assert.equal(Boolean(cashfree.enabled()),true);
});
test('server prices are fixed and do not allow arbitrary amount or institute checkout',()=>{
 assert.deepEqual(cashfree.price('monthly'),{amount:199,months:1});
 assert.deepEqual(cashfree.price('yearly'),{amount:1990,months:12});
 assert.throws(()=>cashfree.price('institute'),e=>e.statusCode===400);
});
test('webhook HMAC validates timestamp plus original bytes and rejects modifications',()=>{
 gate.enabled=()=>true;
 const raw=Buffer.from('{"type":"PAYMENT_SUCCESS_WEBHOOK"}');
 const {signature,timestamp}=sign(raw);
 assert.equal(cashfree.verifySignature(raw,signature,timestamp),true);
 assert.throws(()=>cashfree.verifySignature(Buffer.from('{"type":"changed"}'),signature,timestamp),e=>e.statusCode===401);
 assert.throws(()=>cashfree.verifySignature(raw,'',timestamp),e=>e.statusCode===401);
});
test('create order checks phone, uses sandbox URL and trusted price, persists only authenticated identity',async()=>{
 gate.enabled=()=>true;
 const statements=[];
 db.query=async(sql,params)=>{statements.push({sql,params});return {rowCount:1,rows:[]};};
 global.fetch=async(url,options)=>{
  assert.match(url,/^https:\/\/sandbox\.cashfree\.com\/pg\/orders$/);
  assert.equal(options.headers['x-api-version'],'2025-01-01');
  const body=JSON.parse(options.body);
  assert.equal(body.order_amount,199);
  assert.equal(body.customer_details.customer_id,user.id);
  assert.equal(body.order_currency,'INR');
  assert.match(body.order_meta.notify_url,/staging-api\.onrender\.com/);
  return {ok:true,json:async()=>({order_id:body.order_id,payment_session_id:'session_dummy_sandbox'})};
 };
 await assert.rejects(cashfree.create(user,'monthly','0000000000'),e=>e.statusCode===400);
 const result=await cashfree.create(user,'monthly','9876543210');
 assert.match(result.orderId,/^cf_sbx_[a-f0-9]{32}$/);
 assert.equal(result.mode,'sandbox');
 assert.equal(result.amountInr,199);
 assert.equal(statements.length,2);
 assert.equal(statements[0].params[4],199);
});
test('verified PAID order grants once, including on duplicate webhook deliveries',async()=>{
 gate.enabled=()=>true;
 const orderId='cf_sbx_'+'1'.repeat(32);
 const event={type:'PAYMENT_SUCCESS_WEBHOOK',data:{
  order:{order_id:orderId,order_amount:199,order_currency:'INR'},
  payment:{payment_status:'SUCCESS',cf_payment_id:'501002'}
 }};
 const raw=Buffer.from(JSON.stringify(event)),sig=sign(raw);
 let paid=false,seen=false,grants=0;
 const local={id:orderId,status:'pending',amount_inr:199,user_id:user.id,months:1};
 db.getClient=async()=>({query:async(sql,params=[])=>{
  if(sql.startsWith('SELECT * FROM cashfree_sandbox_orders'))return {rowCount:1,rows:[{...local,status:paid?'paid':'pending'}]};
  if(sql.startsWith('SELECT fingerprint'))return {rowCount:seen?1:0,rows:seen?[{fingerprint:'x'}]:[]};
  if(sql.startsWith('SELECT id,plan,plan_expires_at FROM users'))return {rowCount:1,rows:[{id:user.id,plan:'free',plan_expires_at:null}]};
  if(sql.includes('UPDATE cashfree_sandbox_orders SET status'))paid=true;
  if(sql.includes('INSERT INTO plan_grants'))grants++;
  if(sql.includes('INSERT INTO cashfree_sandbox_webhook_events'))seen=true;
  return {rowCount:1,rows:[]};
 },release:()=>{}});
 global.fetch=async()=>({ok:true,json:async()=>({order_id:orderId,order_status:'PAID',order_currency:'INR',order_amount:199})});
 assert.equal((await cashfree.processWebhook(raw,sig.signature,sig.timestamp)).paid,true);
 assert.equal((await cashfree.processWebhook(raw,sig.signature,sig.timestamp)).duplicate,true);
 assert.equal(grants,1);
});
test('amount mismatch cannot grant or update payment to paid',async()=>{
 gate.enabled=()=>true;
 const orderId='cf_sbx_'+'2'.repeat(32);
 const raw=Buffer.from(JSON.stringify({type:'PAYMENT_SUCCESS_WEBHOOK',data:{order:{order_id:orderId,order_amount:199,order_currency:'INR'},payment:{payment_status:'SUCCESS',cf_payment_id:'8002'}}}));
 const signature=sign(raw);let grants=0,paid=false;
 db.getClient=async()=>({query:async(sql)=>{
  if(sql.startsWith('SELECT * FROM cashfree_sandbox_orders'))return {rowCount:1,rows:[{status:'pending',amount_inr:199,user_id:user.id,months:1}]};
  if(sql.startsWith('SELECT fingerprint'))return {rowCount:0,rows:[]};
  if(sql.includes('INSERT INTO plan_grants'))grants++;
  if(sql.includes("SET status='paid'"))paid=true;
  return {rowCount:1,rows:[]};
 },release:()=>{}});
 global.fetch=async()=>({ok:true,json:async()=>({order_id:orderId,order_status:'PAID',order_currency:'INR',order_amount:99})});
 const outcome=await cashfree.processWebhook(raw,signature.signature,signature.timestamp);
 assert.equal(outcome.paid,false);assert.equal(grants,0);assert.equal(paid,false);
});
test('order status is user-scoped and rejects malformed or foreign order ids',async()=>{
 gate.enabled=()=>true;
 await assert.rejects(cashfree.orderStatus(user,'cf_sbx_not-an-order'),e=>e.statusCode===404);
 await assert.rejects(cashfree.orderStatus(null,'cf_sbx_'+'3'.repeat(32)),e=>e.statusCode===404);
 const known='cf_sbx_'+'3'.repeat(32);
 db.query=async(sql,params)=>{
  assert.ok(sql.includes('WHERE id=$1 AND user_id=$2'));
  if(params[1]!==user.id||params[0]!==known)return {rowCount:0,rows:[]};
  return {rowCount:1,rows:[{id:params[0],status:'paid',amount_inr:199,billing_period:'monthly',paid_at:new Date('2026-10-27T00:00:00Z')}]};
 };
 await assert.rejects(cashfree.orderStatus(user,'cf_sbx_'+'9'.repeat(32)),e=>e.statusCode===404);
 const status=await cashfree.orderStatus(user,'cf_sbx_'+'3'.repeat(32));
 assert.equal(status.paid,true);
 assert.equal(status.status,'paid');
 assert.equal(status.amountInr,199);
});
test('order status route requires authentication and stays read-only',()=>{
 const routes=fs.readFileSync(path.resolve(__dirname,'../src/routes/cashfree.js'),'utf8');
 assert.match(routes,/router\.get\('\/orders\/:orderId\/status'/);
 assert.ok(routes.indexOf('router.use(authenticateNextAuth)')<routes.indexOf("/orders/:orderId/status"));
 assert.match(routes,/cashfree\.orderStatus\(req\.user,req\.params\.orderId\)/);
});
test('unauthenticated webhook cannot bypass signature or local raw-byte verification',()=>{
 const app=fs.readFileSync(path.resolve(__dirname,'../src/app.js'),'utf8');
 const routes=fs.readFileSync(path.resolve(__dirname,'../src/routes/cashfree.js'),'utf8');
 const admin=fs.readFileSync(path.resolve(__dirname,'../src/routes/admin.js'),'utf8');
 assert.ok(app.indexOf("express.raw({ type: 'application/json'")<app.indexOf("app.use(express.json"));
 assert.match(routes,/router\.post\('\/webhook'/);
 assert.match(routes,/cashfree\.processWebhook\(raw,req\.get\('x-webhook-signature'\)/);
 assert.match(routes,/router\.use\(authenticateNextAuth\)/);
 assert.match(admin,/router\.get\('\/cashfree\/sandbox-audit',requireHumanReviewer/);
});
