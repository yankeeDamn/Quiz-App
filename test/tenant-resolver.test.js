'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {resolveTenantSlug,normalizeHostname}=require('../src/services/tenant-resolver');
test('resolves only valid institute subdomains',()=>{
 assert.equal(resolveTenantSlug('apex.example.in','example.in'),'apex');
 assert.equal(resolveTenantSlug('APEX.example.in:443','example.in'),'apex');
 for(const host of ['example.in','evil-example.in','foo.bar.example.in','admin.example.in','a..example.in','apex.example.in.evil.com']){
  assert.equal(resolveTenantSlug(host,'example.in'),null);
 }
});
test('normalizes hostnames without trusting arbitrary syntax',()=>{
 assert.equal(normalizeHostname('Acme.Example.in:443'),'acme.example.in');
 assert.equal(normalizeHostname('foo/bar.example.in'),null);
});
