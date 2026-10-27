#!/usr/bin/env node
'use strict';

// Local-only preparation and validation. No networking, migrations or DB writes.
// Usage: node scripts/ssc-cgl-mock-01.js [--write-csv]
// CSVs follow components/admin/csv-import.tsx's exact 8-column format.
const fs=require('node:fs');
const path=require('node:path');
const content=require('../src/services/content.service');
const mocks=require('../src/services/mocks.service');
const {eligible}=require('../src/services/ssc-section-timing');
const ROOT=path.join(__dirname,'../content/ssc-cgl-2026/mock-01');
const HEAD=['question','option_a','option_b','option_c','option_d','correct_option','explanation','difficulty'];
const ALPHABET='ABCD';
const read=name=>JSON.parse(fs.readFileSync(path.join(ROOT,name),'utf8'));
const quote=value=>'"'+String(value).replace(/"/g,'""')+'"';
const normalized=s=>String(s).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const csvFor=rows=>[HEAD,...rows.map(q=>[q.question,...q.options,ALPHABET[q.answer],q.explanation,q.difficulty])]
  .map(row=>row.map(quote).join(',')).join('\r\n')+'\r\n';

function validate({checkCsv=true}={}){
 const manifest=read('manifest.json');
 const errors=[],mapped=[],allStems=new Set(),allQuestionRows=[];
 // Prevent exact repeats of stems already shipped in the starter and
 // competitive library. This cannot replace a human plagiarism review.
 const existingStarter=require('../src/data/mock-bank.json');
 const existingCompetitive=require('../src/data/competitive-questions-500.json');
 const existingStems=new Set([
   ...existingStarter.topics.flatMap(t=>t.questions.map(q=>q.q)),
   ...existingCompetitive.questions.map(q=>q.q)
 ].map(normalized));
 if(manifest.id!=='ssc-cgl-2026-mock-01'||manifest.reviewStatus!=='needs_human_review'||
    manifest.publicationAllowed!==false||manifest.mock?.active!==false)
   errors.push('Draft manifest must remain inactive and unapproved');
 if(!Array.isArray(manifest.topics)||manifest.topics.length!==4)errors.push('Four draft topics required');
 if(!Array.isArray(manifest.mock?.sections)||manifest.mock.sections.length!==4)errors.push('Four mock sections required');
 const sections=manifest.mock?.sections||[];
 for(const [index,topic] of (manifest.topics||[]).entries()){
   if(topic.active!==false)errors.push('Topic is not inactive: '+topic.id);
   const file=read(topic.file);
   if(file.topicId!==topic.id||file.section!==sections[index]?.name)errors.push('Section metadata does not match: '+topic.id);
   if(!Array.isArray(file.questions)||file.questions.length!==25)errors.push('Expected 25 questions: '+topic.id);
   if(sections[index]?.parts?.length!==1||
      sections[index].parts[0].topic!==topic.id||
      sections[index].parts[0].from!==0||sections[index].parts[0].to!==25)
     errors.push('Invalid topic range: '+topic.id);
   const rows=[];
   for(const [qindex,q] of (file.questions||[]).entries()){
     const checked=content.checkQuestion(q);
     const id=topic.id+':'+qindex;
     if(!checked.ok)errors.push(id+': '+checked.error);
     else {
       const key=normalized(checked.value.question);
       if(allStems.has(key))errors.push('Repeated stem: '+id);
       if(existingStems.has(key))errors.push('Stem already exists in bundled question banks: '+id);
       allStems.add(key);
       if(checked.value.explanation.length<25)errors.push('Explanation requires 25+ characters: '+id);
       if(!String(q.subtopic||'').trim())errors.push('Missing subtopic: '+id);
       if(q.reviewStatus!=='needs_human_review')errors.push('Question reviewStatus must remain pending: '+id);
       rows.push(checked.value);
     }
   }
   allQuestionRows.push({topic,rows});
   mapped.push({id:topic.id,name:topic.name,category:topic.category,
     questions:rows.map((q,position)=>({position,q:q.question,options:q.options,answer:q.answer,explanation:q.explanation}))});
   if(checkCsv&&rows.length===25){
     const expected=csvFor(rows);
     const actual=fs.readFileSync(path.join(ROOT,topic.csv),'utf8');
     if(actual!==expected)errors.push('CSV differs from canonical JSON: '+topic.csv);
   }
 }
 if(allStems.size!==100)errors.push('Expected 100 distinct question stems');
 if(manifest.mock?.minutes!==60||manifest.mock?.marksPerCorrect!==2||manifest.mock?.negativeMarks!==0.5)
   errors.push('Full mock requires 60 minutes and +2/-0.50 scoring');
 if(manifest.mock?.passPercent!==50)errors.push('Keep current internal practice pass threshold stable');
 const testCheck=content.checkTest(manifest.mock,(manifest.topics||[]).map(t=>t.id));
 if(!testCheck.ok)errors.push('Mock fails admin validation: '+testCheck.error);
 const bank={topics:mapped,mocks:[manifest.mock]};
 const built=mocks.build(bank,{...manifest.mock,kind:'mock'});
 if(!eligible(built))errors.push('Full mock does not activate SSC section-timing policy');
 if(built.questions.length!==100||built.sections.some(s=>s.to-s.from!==25))
   errors.push('Engine did not build all four 25-question sections');
 return {manifest,errors,allQuestionRows,built,questionCount:built.questions.length,
   sections:built.sections.map(s=>({name:s.name,questions:s.to-s.from})),reviewed:0};
}

if(require.main===module){
 try {
   const write=process.argv.includes('--write-csv');
   const result=validate({checkCsv:!write});
   if(result.errors.length)throw Error(result.errors.join('\n'));
   if(write){
     for(const {topic,rows} of result.allQuestionRows)
       fs.writeFileSync(path.join(ROOT,topic.csv),csvFor(rows),'utf8');
   }
   console.log(JSON.stringify({status:'VALID_DRAFT_NOT_APPROVED',testId:result.manifest.id,
     totalQuestions:result.questionCount,sections:result.sections,exportedCsv:write,
     editorialReview:'PENDING',productionChanges:false},null,2));
 }catch(error){console.error('SSC Mock 01 validation failed:',error.message);process.exitCode=1}
}

module.exports={validate,csvFor,normalized};
