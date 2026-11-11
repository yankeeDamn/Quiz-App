'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),p=require('../src/services/institutes/billing-policy');
const valid={code:'SYNTHETIC',name:'Synthetic plan only',amountPaise:12345,periodDays:30,active:true,limits:{students:10,teachers:1,batches:2,questions:100,monthlyAttempts:200}};
test('institute plan prices and complete bounded limits are platform-configurable',()=>{
 assert.deepEqual(p.plan(valid),valid);
 for(const amountPaise of [0,-1,1.5,100000001])assert.throws(()=>p.plan({...valid,amountPaise}));
 assert.throws(()=>p.plan({...valid,code:'__proto__'}));assert.throws(()=>p.plan({...valid,limits:{students:10}}));
 assert.throws(()=>p.plan({...valid,limits:{...valid.limits,questions:-1}}));assert.throws(()=>p.plan({...valid,limits:{...valid.limits,unknown:1}}));
});
test('subscription expiry overrides stored status without granting consumer Pro',()=>{
 assert.equal(p.effective(null),'unconfigured');assert.equal(p.effective({status:'active',current_period_end:'2000-01-01'}),'expired');
 assert.equal(p.effective({status:'active',current_period_end:'2099-01-01',cancel_at_period_end:true}),'active');
});
test('consumer live switch cannot enable institute production billing',()=>{
 const keys=['INSTITUTE_BILLING_ENABLED','MONETIZATION_CASHFREE_MODE','APP_ENV','MONETIZATION_LIVE_PAYMENTS_ENABLED'];const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{process.env.INSTITUTE_BILLING_ENABLED='true';process.env.MONETIZATION_CASHFREE_MODE='production';process.env.APP_ENV='production';process.env.MONETIZATION_LIVE_PAYMENTS_ENABLED='true';assert.throws(()=>p.sandbox(),/sandbox-only/);
 process.env.MONETIZATION_CASHFREE_MODE='sandbox';assert.throws(()=>p.sandbox(),/sandbox-only/);process.env.APP_ENV='staging';assert.doesNotThrow(()=>p.sandbox());}
 finally{for(const k of keys)if(previous[k]===undefined)delete process.env[k];else process.env[k]=previous[k];}
});
