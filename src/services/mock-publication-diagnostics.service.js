'use strict';
const db = require('../config/database');
const content = require('./content.service');
const quality = require('./mock-quality.service');
const {isFullCglMock} = require('./ssc-full-mock-classifier');
const fail=(message,statusCode=409)=>Object.assign(new Error(message),{statusCode});

/** Counts and topic identifiers only. Never return stems, choices or keys. */
function describe(definition,topics,questions) {
  const ids=[...new Set(definition.sections.flatMap(s=>s.parts.map(p=>p.topic)))];
  const checked=content.checkTest(definition,ids);
  if(!checked.ok)throw fail('Mock configuration needs correction: '+checked.error);
  const ranges=checked.value.sections.flatMap(s=>s.parts);
  const reports=ids.map(id=>{
    const topic=topics.find(t=>t.id===id);
    const positions=new Set(ranges.filter(p=>p.topic===id).flatMap(p=>Array.from({length:p.to-p.from},(_,i)=>p.from+i)));
    const selected=questions.filter(q=>q.topic_id===id&&positions.has(q.position));
    const present=new Set(selected.map(q=>q.position));
    const unreviewed=selected.filter(q=>!q.reviewed_at||!['reviewed','published'].includes(q.review_status)).length;
    const unpublished=selected.filter(q=>q.review_status!=='published').length;
    const retired=selected.filter(q=>!q.active).length;
    const tierMismatch=definition.tier==='free'?selected.filter(q=>q.access_tier!=='free').length:0;
    const ready=selected.filter(q=>topic?.active&&q.active&&q.review_status==='published'&&q.reviewed_at&&
      (definition.tier!=='free'||q.access_tier==='free')).length;
    return {id,name:topic?.name||id,exists:!!topic,active:topic?.active===true,expected:positions.size,
      present:present.size,missing:positions.size-present.size,duplicates:selected.length-present.size,
      unreviewed,unpublished,retired,tierMismatch,ready};
  });
  const sum=key=>reports.reduce((n,t)=>n+t[key],0);
  return {expected:sum('expected'),present:sum('present'),ready:sum('ready'),missing:sum('missing'),
    unreviewed:sum('unreviewed'),unpublished:sum('unpublished'),retired:sum('retired'),
    tierMismatch:sum('tierMismatch'),duplicates:sum('duplicates'),topics:reports};
}
async function report(testId) {
  const definition=(await content.listTests()).find(t=>t.id===testId);
  if(!definition)throw fail('Mock test not found.',404);
  const ids=[...new Set(definition.sections.flatMap(s=>(s.parts||[]).map(p=>p.topic)))];
  const [topics,questions]=await Promise.all([
    db.query('SELECT id, name, active FROM mock_topics WHERE id = ANY($1::text[])',[ids]),
    db.query(`SELECT topic_id, position, active, review_status, reviewed_at, access_tier
      FROM mock_questions WHERE topic_id = ANY($1::text[]) ORDER BY topic_id,position`,[ids]),
  ]);
  const counts=describe(definition,topics.rows,questions.rows);
  const technical=await content.publicationReadiness(definition);
  const editorial=isFullCglMock(definition)?await quality.readiness(testId):null;
  return {testId,name:definition.name,active:definition.active,liveInCatalogue:definition.liveInCatalogue,
    ...counts,technicalReady:technical.ok===true,editorialRequired:!!editorial,
    editorialReady:editorial?editorial.ok===true:null,
    blockers:[!technical.ok&&technical.error,editorial&&!editorial.ok&&editorial.error].filter(Boolean),
    canPublish:technical.ok===true&&(!editorial||editorial.ok===true)};
}
module.exports={report,describe};
