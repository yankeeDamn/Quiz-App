'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {question,csv,definition}=require('../src/services/institutes/content-policy');
const q={external_id:'stable-id',topic:'Synthetic',difficulty:'Easy',prompt:' Select one ',options:['one','two','three','four'],correct_option:'A',explanation:'Synthetic explanation'};
test('private question validation rejects duplicated options and fingerprints likely duplicates',()=>{
 assert.throws(()=>question({...q,options:['one',' one ','three','four']}),/distinct/);
 assert.throws(()=>question({...q,correct_option:'E'}));
 assert.equal(question(q).fingerprint,question({...q,prompt:'SELECT   ONE',options:[...q.options].reverse()}).fingerprint);
});
test('CSV parser accepts quoted commas and newlines, rejects malformed documents before writing',()=>{
 const h='external_id,topic,difficulty,prompt,option_a,option_b,option_c,option_d,correct_option,explanation,language\r\n';
 const parsed=csv(h+'id,topic,Easy,"Select, one",one,two,three,four,A,"Line\nwith ""quote""",en\r\n');
 assert.equal(parsed[0].prompt,'Select, one');assert.equal(parsed[0].explanation,'Line\nwith "quote"');
 assert.throws(()=>csv(h+'id,topic,Easy,"unclosed'));assert.throws(()=>csv(h+'"id"invalid'));
});
test('exam definition rejects duplicate IDs, invalid windows and caller-coerced numeric fields',()=>{
 const id=randomUUID(),d={title:'Synthetic',bankId:randomUUID(),minutes:5,marksPerCorrect:2,negativeMarks:0.5,passPercent:50,startsAt:'2026-01-01T00:00:00Z',endsAt:'2026-01-02T00:00:00Z',sections:[{name:'One',questionIds:[id]}]};
 assert.equal(definition(d).sections[0].questionIds[0],id);
 assert.throws(()=>definition({...d,minutes:'5'}));assert.throws(()=>definition({...d,endsAt:d.startsAt}));
 assert.throws(()=>definition({...d,sections:[...d.sections,{name:'Two',questionIds:[id]}]}),/Duplicate/);
});
