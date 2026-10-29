'use strict';
const crypto = require('node:crypto');
const db = require('../config/database');

const bad = (message, statusCode=400)=>Object.assign(new Error(message),{statusCode});
const statusValues = ['pending','approved','changes_required'];
const hindiValues = ['pending','verified','changes_required','not_required'];
const hiPattern = /[\u0900-\u097F]/;

function sourceHash(q) {
  return crypto.createHash('sha256')
    .update(JSON.stringify([q.question,q.options,q.answer,q.explanation,q.difficulty]))
    .digest('hex');
}
function expectedRanges(definition) {
  const ranges=definition?.sections?.flatMap(s=>s.parts||[])||[];
  if(!ranges.length)throw bad('Test has no question ranges.',409);
  return ranges;
}
async function loadQuestions(testId) {
  const {rows:defs}=await db.query('SELECT id, name, sections, active FROM mock_tests WHERE id=$1',[testId]);
  if(!defs.length)throw bad('Mock test not found.',404);
  const ranges=expectedRanges(defs[0]);
  const topicIds=[...new Set(ranges.map(p=>p.topic))];
  const {rows}=await db.query(`SELECT id,topic_id,position,question,options,answer,explanation,difficulty,active
    FROM mock_questions WHERE topic_id = ANY($1::text[]) ORDER BY topic_id,position`,[topicIds]);
  const selected=rows.filter(q=>ranges.some(p=>p.topic===q.topic_id&&q.position>=p.from&&q.position<p.to));
  selected.sort((a,b)=>{
    const ix=q=>ranges.findIndex(p=>p.topic===q.topic_id&&q.position>=p.from&&q.position<p.to);
    return ix(a)-ix(b) || a.position-b.position;
  });
  return {definition:defs[0],questions:selected,expected:ranges.reduce((n,p)=>n+p.to-p.from,0)};
}
async function list(testId) {
  const {definition,questions,expected}=await loadQuestions(testId);
  const ids=questions.map(q=>q.id);
  const {rows:reviews}=ids.length
    ?await db.query('SELECT * FROM mock_question_reviews WHERE test_id=$1 AND question_id = ANY($2::uuid[])',[testId,ids])
    :{rows:[]};
  const byId=new Map(reviews.map(r=>[r.question_id,r]));
  const entries=questions.map(q=>{
    const v=byId.get(q.id),hash=sourceHash(q),current=v?.content_hash===hash;
    const requiresHindi=!/english/i.test(q.topic_id);
    return {
      id:q.id,topicId:q.topic_id,position:q.position,question:q.question,
      options:q.options,answer:q.answer,explanation:q.explanation,difficulty:q.difficulty,
      active:q.active,
      academicStatus:current?v.academic_status:'pending',
      academicReviewer:current?v.academic_reviewer:null,
      academicNotes:current?v.academic_notes:'',
      hindiRequired:requiresHindi,
      hindiStatus:current?v.hindi_status:'pending',
      hindiQuestion:current?v.hindi_question||'':'',
      hindiOptions:current?(v.hindi_options||['','','','']):['','','',''],
      hindiExplanation:current?v.hindi_explanation||'':'',
      hindiReviewer:current?v.hindi_reviewer:null,
      stale:Boolean(v&&!current),
    };
  });
  const academicApproved=entries.filter(e=>e.academicStatus==='approved').length;
  const hindiRequired=entries.filter(e=>e.hindiRequired).length;
  const hindiVerified=entries.filter(e=>e.hindiRequired&&e.hindiStatus==='verified').length;
  return {
    testId,name:definition.name,draft:!definition.active,expected,actual:entries.length,
    academicApproved,hindiRequired,hindiVerified,
    ready:entries.length===expected&&academicApproved===expected&&hindiVerified===hindiRequired,
    entries,
  };
}
async function update(testId,questionId,payload,email) {
  const {definition,questions}=await loadQuestions(testId);
  if(definition.active)throw bad('Reviews may only be changed while a mock is Draft.',409);
  const q=questions.find(q=>q.id===questionId);
  if(!q)throw bad('Question is not in this mock.',404);
  const academicStatus=payload?.academicStatus;
  const hindiStatus=payload?.hindiStatus;
  if(!statusValues.includes(academicStatus)||!hindiValues.includes(hindiStatus))throw bad('Invalid review statuses.');
  const hindiRequired=!/english/i.test(q.topic_id);
  if(hindiRequired&&hindiStatus==='not_required')throw bad('SSC requires Hindi content for non-English sections.');
  if(!hindiRequired&&hindiStatus==='verified')throw bad('Hindi translation is not required for English Comprehension.');
  const notes=String(payload.academicNotes||'').trim();
  if(notes.length>1500)throw bad('Review notes must be at most 1500 characters.');
  const question=String(payload.hindiQuestion||'').trim();
  const options=payload.hindiOptions;
  const explanation=String(payload.hindiExplanation||'').trim();
  if(hindiStatus==='verified'){
    if(question.length<5||!hiPattern.test(question)||
       !Array.isArray(options)||options.length!==4||
       options.some(o=>typeof o!=='string'||!hiPattern.test(o)||!o.trim())||
       !hiPattern.test(explanation))throw bad('Verified Hindi requires human-reviewed Devanagari question, four choices and explanation.');
  }
  const validOptions=Array.isArray(options)&&options.length===4?options.map(v=>String(v).trim()):['','','',''];
  await db.query(`INSERT INTO mock_question_reviews
    (test_id,question_id,content_hash,academic_status,academic_reviewer,academic_notes,
     hindi_status,hindi_question,hindi_options,hindi_explanation,hindi_reviewer)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)
    ON CONFLICT (test_id,question_id) DO UPDATE SET
      content_hash=EXCLUDED.content_hash,academic_status=EXCLUDED.academic_status,
      academic_reviewer=EXCLUDED.academic_reviewer,academic_notes=EXCLUDED.academic_notes,
      hindi_status=EXCLUDED.hindi_status,hindi_question=EXCLUDED.hindi_question,
      hindi_options=EXCLUDED.hindi_options,hindi_explanation=EXCLUDED.hindi_explanation,
      hindi_reviewer=EXCLUDED.hindi_reviewer,updated_at=NOW()`,
      [testId,questionId,sourceHash(q),academicStatus,academicStatus==='approved'?email:null,notes,
       hindiStatus,question||null,JSON.stringify(validOptions),explanation||null,hindiStatus==='verified'?email:null]);
  return {success:true};
}
async function readiness(testId){
  const result=await list(testId);
  if(result.expected!==result.actual||!result.ready)return {
    ok:false,error:`Editorial sign-off incomplete: ${result.academicApproved}/${result.expected} academic approvals and ${result.hindiVerified}/${result.hindiRequired} human-verified Hindi translations. Check stale or missing rows.`,
  };
  return {ok:true};
}

/** Use only human-verified, unmodified Hindi strings in scored exam payloads. */
async function attachApprovedHindi(testId,builtExam) {
  const {questions}=await loadQuestions(testId);
  const ids=questions.map(q=>q.id);
  if(!ids.length)return builtExam;
  const {rows}=await db.query(`SELECT question_id,content_hash,hindi_status,hindi_question,hindi_options
    FROM mock_question_reviews WHERE test_id=$1 AND question_id = ANY($2::uuid[])`,[testId,ids]);
  const byId=new Map(questions.map(q=>[q.id,q]));
  const approved=new Map();
  for(const r of rows) {
    const source=byId.get(r.question_id);
    if(source&&r.hindi_status==='verified'&&r.content_hash===sourceHash(source)&&
       Array.isArray(r.hindi_options)&&r.hindi_options.length===4) {
      approved.set(source.topic_id+':'+source.position,{
        question:r.hindi_question,options:r.hindi_options,
      });
    }
  }
  return {...builtExam,questions:builtExam.questions.map(q=>{
    const hi=approved.get(q.id);
    return hi?{...q,hindi:hi}:q;
  })};
}
module.exports={sourceHash,loadQuestions,list,update,readiness,attachApprovedHindi};
