'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {resolveApiOrigin: origin} = require('../exam-practice-pro/lib/api-origin');
test('deployed configuration fails closed without an explicit API', () => {
  for(const value of ['', undefined, 'garbage', 'http://localhost:3001', 'http://127.0.0.1:3001']) assert.equal(origin(value,'production'),'');
  assert.equal(origin('', 'development'), 'http://localhost:3001');
  assert.equal(origin('http://localhost:3001','production','local'), 'http://localhost:3001');
});
test('staging cannot route to production even with an explicitly wrong API', () => {
  for(const host of ['', 'exampro-staging-ui.vercel.app']) assert.equal(origin('https://quiz-app-regd.onrender.com','production','staging',host),'');
  assert.equal(origin('https://quiz-app-regd.onrender.com','production','','exampro-staging-ui.vercel.app'),'');
  assert.equal(origin('https://exampro-staging-api.onrender.com/','production','staging'), 'https://exampro-staging-api.onrender.com');
  assert.equal(origin('https://quiz-app-regd.onrender.com/','production','production'), 'https://quiz-app-regd.onrender.com');
});
test('origins reject embedded credentials, paths, parameters and unsafe schemes', () => {
  for(const v of ['https://u:p@example.com','https://example.com/api','https://example.com?x=1','https://example.com#x','http://example.com','javascript:alert(1)']) assert.equal(origin(v,'production'),'');
});
