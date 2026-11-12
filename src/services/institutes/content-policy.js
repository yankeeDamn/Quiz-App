'use strict';
const p=require('./policy');
const {createHash}=require('node:crypto');
function number(value,min,max,integer=false) {
 if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value))) throw p.fail('Invalid numeric field');
 return value;
}
function question(raw) {
 const q={external_id:p.text(raw.external_id,100),topic:p.text(raw.topic,120),difficulty:raw.difficulty,prompt:p.text(raw.prompt,4000),explanation:p.text(raw.explanation,6000),correct_option:raw.correct_option,language:raw.language||'en'};
 if(!['Easy','Medium','Hard'].includes(q.difficulty)||!['A','B','C','D'].includes(q.correct_option)||!['en','hi','bn'].includes(q.language)) throw p.fail('Invalid difficulty, answer or language');
 if(!Array.isArray(raw.options)||raw.options.length!==4) throw p.fail('Exactly four options required');
 q.options=raw.options.map(x=>p.text(x,1000));
 if(new Set(q.options.map(normalize)).size!==4) throw p.fail('Options must be distinct');
 q.fingerprint=createHash('sha256').update(JSON.stringify([normalize(q.prompt),...q.options.map(normalize).sort()])).digest('hex');
 return q;
}
function normalize(text) { return text.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim(); }
function definition(raw) {
 if(!Array.isArray(raw.sections)||!raw.sections.length||raw.sections.length>20) throw p.fail('Use 1–20 sections');
 const seen=new Set();
 const sections=raw.sections.map(s=>{
  const name=p.text(s.name,100);
  if(!Array.isArray(s.questionIds)||!s.questionIds.length) throw p.fail('Every section needs questions');
  const questionIds=s.questionIds.map(id=>{p.uuid(id);if(seen.has(id))throw p.fail('Duplicate question');seen.add(id);return id;});
  return {name,questionIds};
 });
 if(seen.size>200) throw p.fail('Maximum 200 questions');
 const startsAt=new Date(raw.startsAt),endsAt=new Date(raw.endsAt);
 if(!raw.startsAt||!raw.endsAt||!Number.isFinite(+startsAt)||!Number.isFinite(+endsAt)||endsAt<=startsAt) throw p.fail('Valid start and end times required');
 return {title:p.text(raw.title,160),bankId:p.uuid(raw.bankId),minutes:number(raw.minutes,1,240,true),marksPerCorrect:number(raw.marksPerCorrect,0.01,10),negativeMarks:number(raw.negativeMarks,0,10),passPercent:number(raw.passPercent,0,100),sections,startsAt:startsAt.toISOString(),endsAt:endsAt.toISOString()};
}
// Strict bounded RFC-style CSV parser; quoted commas/newlines and doubled quotes supported.
function csv(source) {
 if(typeof source!=='string'||Buffer.byteLength(source)>200000) throw p.fail('CSV must be under 200 KB');
 const rows=[];let row=[],field='',quoted=false,closed=false;
 for(let i=0;i<source.length;i++) {
  const ch=source[i];
  if(quoted){if(ch==='"'){if(source[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=ch;continue;}
  if(ch==='"'){if(field||closed)throw p.fail('Malformed CSV quote');quoted=true;continue;}
  if(ch===','||ch==='\n'||ch==='\r') {
   row.push(field);field='';closed=false;
   if(ch!==','){if(ch==='\r'&&source[i+1]==='\n')i++;rows.push(row);row=[];if(rows.length>101)throw p.fail('Maximum 100 CSV questions');}
  } else {if(closed)throw p.fail('Malformed CSV after quote');field+=ch;}
 }
 if(quoted)throw p.fail('Unclosed CSV quote');
 if(field||row.length||closed){row.push(field);rows.push(row);}
 const headers=['external_id','topic','difficulty','prompt','option_a','option_b','option_c','option_d','correct_option','explanation','language'];
 if(JSON.stringify(rows.shift())!==JSON.stringify(headers)||!rows.length||rows.length>100) throw p.fail('CSV headers or row count invalid');
 return rows.map(r=>{if(r.length!==headers.length)throw p.fail('CSV column count invalid');const q=Object.fromEntries(headers.map((h,i)=>[h,r[i]]));return question({...q,options:[q.option_a,q.option_b,q.option_c,q.option_d]});});
}
module.exports={number,question,definition,csv};
