'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const service=require('../src/services/razorpay.service');
test('merchant credentials do not enable checkout without explicit opt in',()=>{
 assert.equal(service.enabled(),false);
});
test('server controls Pro price and rejects arbitrary plan',()=>{
 assert.deepEqual(service.planFor('monthly'),{plan:'pro',months:1,amountPaise:19900});
 assert.deepEqual(service.planFor('yearly'),{plan:'pro',months:12,amountPaise:199000});
 assert.equal(service.planFor('institute'),null);
 assert.equal(service.planFor('100'),null);
});
test('webhook requires raw body and genuine HMAC',()=>{
 const raw=Buffer.from('{"event":"payment.captured"}');
 const sig=crypto.createHmac('sha256','test-webhook-secret').update(raw).digest('hex');
 assert.equal(service.verifyWebhook(raw,sig,'test-webhook-secret'),true);
 assert.equal(service.verifyWebhook(raw,sig,'wrong'),false);
 assert.equal(service.verifyWebhook(Buffer.from('{}'),sig,'test-webhook-secret'),false);
 assert.equal(service.verifyWebhook(raw,'abc','test-webhook-secret'),false);
 assert.equal(service.verifyWebhook('not a buffer',sig,'test-webhook-secret'),false);
});
