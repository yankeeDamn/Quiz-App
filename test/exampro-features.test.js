'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {validTexts,topicIds}=require('../src/routes/exampro-features');

test('translation accepts only small non-empty batches',()=>{
 assert.equal(validTexts(['Hello','Option A','Why?']),true);
 assert.equal(validTexts([]),false);
 assert.equal(validTexts(Array(9).fill('x')),false);
 assert.equal(validTexts(['']),false);
 assert.equal(validTexts(['a'.repeat(1001)]),false);
 assert.equal(validTexts(Array(8).fill('a'.repeat(600))),false);
});
test('competitive inventory contains exactly the four imported topics',()=>{
 assert.equal(topicIds.size,4);
 assert.deepEqual([...topicIds].sort(),[
  'comp-banking-2026','comp-railways-2026','comp-ssc-cgl-2026','comp-ssc-chsl-mts-2026'
 ]);
});
