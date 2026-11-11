'use strict';
const p=require('./policy');
const keys=['students','teachers','batches','questions','monthlyAttempts'];
function limits(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length)throw p.fail('Specify all five institute limits');
 const out={};for(const key of keys){if(!Number.isInteger(value[key])||value[key]<0||value[key]>1000000)throw p.fail('Invalid institute limit');out[key]=value[key];}return out;
}
function plan(raw){
 if(!raw||typeof raw.code!=='string'||!/^[A-Z][A-Z0-9_]{2,39}$/.test(raw.code))throw p.fail('Invalid plan code');
 if(!Number.isInteger(raw.amountPaise)||raw.amountPaise<100||raw.amountPaise>100000000||!Number.isInteger(raw.periodDays)||raw.periodDays<1||raw.periodDays>366)throw p.fail('Enter a price in whole paise and a valid term');
 return {code:raw.code,name:p.text(raw.name,120,2),amountPaise:raw.amountPaise,periodDays:raw.periodDays,limits:limits(raw.limits),active:raw.active===true};
}
function effective(subscription,now=new Date()){
 if(!subscription)return 'unconfigured';
 if(!subscription.current_period_end||new Date(subscription.current_period_end)<=now)return 'expired';
 return subscription.status;
}
function sandbox(){
 if(process.env.INSTITUTE_BILLING_ENABLED!=='true')throw p.fail('Institute billing is disabled',503);
 // This draft deliberately has no production charge path. Enabling a generic
 // consumer live-payment switch cannot activate institute sales.
 if(process.env.MONETIZATION_CASHFREE_MODE!=='sandbox'||!['test','local','staging'].includes(process.env.APP_ENV))throw p.fail('Institute billing is sandbox-only pending settlement acceptance',503);
}
module.exports={keys,limits,plan,effective,sandbox};
