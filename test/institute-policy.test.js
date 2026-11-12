'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const p=require('../src/services/institutes/policy');
const {randomUUID}=require('node:crypto');
process.env.INSTITUTE_INVITATION_SECRET='synthetic-institute-invitation-secret-only';
test('explicit permissions deny unknown roles and student authoring',()=>{
 assert.equal(p.can('__proto__','workspace:read'),false);
 assert.equal(p.can('student','questions:write'),false);
 assert.equal(p.can('teacher','members:read'),false);
 assert.equal(p.can('teacher','questions:review'),false);
 assert.equal(p.can('admin','staff:admin'),false);
 assert.equal(p.can('owner','staff:admin'),true);
});
test('invitations bind purpose and expiry with a tamper-evident signature',()=>{
 const id=randomUUID(),token=p.signInvite(id,Date.now()+60000);
 assert.equal(p.verifyInvite(token).id,id);
 assert.throws(()=>p.verifyInvite(token+'x'));
 assert.throws(()=>p.verifyInvite(p.signInvite(id,Date.now()-1000)),/expired/);
 assert.throws(()=>p.verifyInvite('malformed'));
 assert.equal(p.digest(token).length,64);
});
test('branding rejects executable and remotely loaded logos',()=>{
 assert.throws(()=>p.profile({logo:'https://example.com/tracker.png'}));
 assert.throws(()=>p.profile({logo:'data:image/svg+xml;base64,PHN2Zz4='}));
 assert.throws(()=>p.profile({accentColor:'red; background:url(x)'}));
 assert.equal(p.profile({tagline:' My institute '}).tagline,'My institute');
});
test('manual institute migration cannot be triggered by existing auto-migrate',()=>{
 const fs=require('node:fs');assert.equal(fs.readFileSync('src/db/migrate.js','utf8').includes('institute-foundation.sql'),false);
});
