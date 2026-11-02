'use strict';
// Nonsensitive generated fixtures. No production stems, choices or rationales.
const structure = require('./bank-structure.json');
const question = (id, index = 0) => ({
  question: `Synthetic fixture ${id}: select the labelled option ${index % 4}.`,
  options: ['Label 0','Label 1','Label 2','Label 3'], answer: index % 4,
  explanation: `Fixture rationale: the requested label is ${index % 4}; this is test data only.`,
  difficulty: 'Moderate', subtopic: 'Fixture', reviewStatus: 'needs_human_review',
});
function starter() {
  return {topics:structure.topics.map(({count,...t})=>({...t,
    questions:Array.from({length:count},(_,i)=>{const q=question(t.id+'-'+i,i);return {q:q.question,options:q.options,answer:q.answer,explanation:q.explanation,reviewStatus:'published',accessTier:'free'};}),
  })),mocks:structuredClone(structure.mocks)};
}
function competitive() {
  const {GROUPS}=require('../../src/db/seed-competitive');
  return {questions:GROUPS.flatMap((g,n)=>Array.from({length:125},(_,i)=>{
    const q=question(`competitive-${n}-${i}`,i);
    return {exam:g.exam,q:q.question,options:q.options,answer:'ABCD'[q.answer],correct:q.options[q.answer],why:q.explanation};
  }))};
}
function mock02() {
  return Object.fromEntries(['reasoning','general-awareness','quant','english'].map(s=>[s,
    Array.from({length:25},(_,i)=>question('mock02-'+s+'-'+i,i))]));
}
let fixtureRoot;
function mock01Root() {
  if(fixtureRoot)return fixtureRoot;
  const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
  fixtureRoot=fs.mkdtempSync(path.join(os.tmpdir(),'exampro-synthetic-'));
  const manifest=require('../../content/ssc-cgl-2026/mock-01/manifest.json');
  fs.writeFileSync(path.join(fixtureRoot,'manifest.json'),JSON.stringify(manifest));
  const {csvFor}=require('../../scripts/ssc-cgl-mock-01');
  const records=[];
  manifest.topics.forEach((t,s)=>{
    const questions=Array.from({length:25},(_,i)=>question('mock01-'+s+'-'+i,s*25+i));
    fs.writeFileSync(path.join(fixtureRoot,t.file),JSON.stringify({topicId:t.id,section:manifest.mock.sections[s].name,questions}));
    fs.writeFileSync(path.join(fixtureRoot,t.csv),csvFor(questions));
    records.push(...questions.map((q,i)=>({file:t.file,number:i+1,answerLetter:'ABCD'[q.answer],answerText:q.options[q.answer],evidence:q.explanation,auditDisposition:'AI_DESK_REVIEWED_HUMAN_SIGNOFF_PENDING'})));
  });
  fs.writeFileSync(path.join(fixtureRoot,'quality-review.json'),JSON.stringify({publicationApproved:false,records}));
  process.once('exit',()=>fs.rmSync(fixtureRoot,{recursive:true,force:true}));
  return fixtureRoot;
}
const validateMock01 = options => require('../../scripts/ssc-cgl-mock-01').validate({root:mock01Root(),existingStarter:starter(),existingCompetitive:competitive(),...options});
module.exports={question,starter,competitive,mock02,mock01Root,validateMock01};
