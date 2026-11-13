'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),m=require('../src/services/monetization.service');
test('advertising destinations reject literal IPs, local names, credentials and nonstandard ports',()=>{
 for(const url of ['https://169.254.169.254','https://172.16.1.1','https://8.8.8.8','https://[::1]','https://0x7f000001','https://localhost.','https://host.local.','https://internal','https://example.test:8443','https://user:password@example.test'])assert.throws(()=>m.url(url),url);
 assert.equal(m.url('https://example.test/path?q=one'),'https://example.test/path?q=one');
});
test('sandbox advertising approval never enables public delivery in production',()=>{
 const previous=process.env.APP_ENV;
 try{process.env.APP_ENV='production';assert.equal(m.activeAd({status:'active',expiresAt:'2099-01-01',paymentMode:'sandbox'}),false);assert.equal(m.activeAd({status:'active',expiresAt:'2099-01-01'}),true);process.env.APP_ENV='staging';assert.equal(m.activeAd({status:'active',expiresAt:'2099-01-01',paymentMode:'sandbox'}),true);}
 finally{if(previous===undefined)delete process.env.APP_ENV;else process.env.APP_ENV=previous;}
});
