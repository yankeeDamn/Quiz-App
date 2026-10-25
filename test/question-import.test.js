'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const { inspect }=require('../src/services/question-import');
const good={question:'What is a virtual machine?',options:['A','B','C','D'],answer:0,explanation:'A hosted computer.',difficulty:'Easy'};
test('CSV import validation produces row-specific errors',()=>{
 const checked=inspect([good,{...good,question:'Invalid',answer:6}],[]);
 assert.equal(checked.errors[0].row,3);assert.equal(checked.values.length,1);
});
test('detect duplicates within file and database',()=>{
 const result=inspect([good,{...good}],['Different question']);
 assert.equal(result.errors[0].row,3);
 assert.match(result.errors[0].message,/Duplicate/);
 const existing=inspect([good],[good.question.toUpperCase()]);
 assert.equal(existing.errors[0].row,2);
});
