'use strict';
process.env.NODE_ENV='test';
process.env.AUTH_SECRET='test-auth-secret-test-auth-secret';
process.env.JWT_SECRET='test-jwt-secret';
process.env.RAZORPAY_WEBHOOK_SECRET='webhook-test-secret';
delete process.env.RAZORPAY_KEY_ID;
delete process.env.RAZORPAY_KEY_SECRET;
delete process.env.RAZORPAY_CHECKOUT_ENABLED;
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const http=require('node:http');
const app=require('../src/app');
let server,base;
test.before(async()=>{server=http.createServer(app);await new Promise(done=>server.listen(0,done));base='http://127.0.0.1:'+server.address().port});
test.after(()=>server.close());
test('payment checkout stays disabled until owner enables it',async()=>{
 const r=await fetch(base+'/api/v1/payments/config');
 assert.equal(r.status,200);
 assert.equal((await r.json()).data.enabled,false);
});
test('no order can be created anonymously',async()=>{
 const r=await fetch(base+'/api/v1/payments/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({plan:'pro',term:'monthly'})});
 assert.equal(r.status,401);
});
test('raw signed webhook rejects tampering and acknowledges unrelated event',async()=>{
 const body=JSON.stringify({event:'payment.failed'});
 const bad=await fetch(base+'/api/v1/payments/webhook',{method:'POST',headers:{'content-type':'application/json','x-razorpay-signature':'invalid'},body});
 assert.equal(bad.status,401);
 const sig=crypto.createHmac('sha256',process.env.RAZORPAY_WEBHOOK_SECRET).update(Buffer.from(body)).digest('hex');
 const okay=await fetch(base+'/api/v1/payments/webhook',{method:'POST',headers:{'content-type':'application/json','x-razorpay-signature':sig},body});
 assert.equal(okay.status,200);
 assert.equal((await okay.json()).ignored,true);
});
