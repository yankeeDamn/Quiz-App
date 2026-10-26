'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {checkTranslation}=require('../src/routes/translation');
test('translation only permits hi/bn and short nonempty strings',()=>{
 assert.deepEqual(checkTranslation({lang:'bn',texts:[' Hello ','World']}),{lang:'bn',texts:['Hello','World']});
 assert.equal(checkTranslation({lang:'xx',texts:['Hello']}),null);
 assert.equal(checkTranslation({lang:'hi',texts:[]}),null);
 assert.equal(checkTranslation({lang:'hi',texts:Array(7).fill('Hi')}),null);
 assert.equal(checkTranslation({lang:'hi',texts:['a'.repeat(1001)]}),null);
});
