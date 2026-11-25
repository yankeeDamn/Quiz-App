import packs from '@/../content/separate-exam-practice-starter.json';
import type {MockTest,MockSummary,MockQuestion} from '@/lib/mocks';
import type {StarterPackContent,StarterPackQuestion} from '@/lib/starter-packs';

// Independent, original practice packs. No scored attempts or publication state.
// Free for everyone and practice-only. Admins can edit them; the bundled JSON is the fallback.
export const EXAM_PRACTICE_PACKS = [
 {id:'railways-rrb-starter',key:'railways-rrb',name:'Railways RRB Starter',exam:'Railways'},
 {id:'banking-ibps-starter',key:'banking-ibps',name:'Banking IBPS Starter',exam:'Banking'},
 {id:'upsc-gs-starter',key:'upsc-gs',name:'UPSC General Studies Starter',exam:'UPSC / PSC'},
] as const;

/** Bundled questions, with the same "<pack>:<index>" IDs the backend uses. */
function bundledRows(spec:(typeof EXAM_PRACTICE_PACKS)[number]):StarterPackQuestion[]{
 return packs[spec.key].map((row,index)=>({
  id:spec.id+':'+index,question:row.question,options:row.options,answer:row.answer,
  explanation:row.explanation,difficulty:row.difficulty,
 }));
}

/** Use admin-saved questions when available and valid, otherwise the bundled pack. */
function rowsFor(spec:(typeof EXAM_PRACTICE_PACKS)[number],saved?:StarterPackContent):StarterPackQuestion[]{
 const rows=saved?.[spec.id];
 const usable=Array.isArray(rows)&&rows.length>0&&rows.every(r=>
  r&&typeof r.id==='string'&&typeof r.question==='string'&&Array.isArray(r.options)&&r.options.length===4&&
  Number.isInteger(r.answer)&&r.answer>=0&&r.answer<4&&typeof r.explanation==='string');
 return usable?rows:bundledRows(spec);
}

export function buildSeparatePractice(id:string,saved?:StarterPackContent):MockTest|null {
 const spec=EXAM_PRACTICE_PACKS.find(x=>x.id===id);
 if(!spec)return null;
 const questions:MockQuestion[]=rowsFor(spec,saved).map((row,index)=>({
  id:row.id||spec.id+':'+index,topic:spec.id,topicName:spec.name,section:0,
  question:row.question,options:row.options,answer:row.answer,explanation:row.explanation,
 }));
 return {id:spec.id,name:spec.name,exam:spec.exam,kind:'topic',underReview:true,tier:'free',level:'Practice',minutes:20,
  questionCount:questions.length,marksPerCorrect:1,negativeMarks:0,
  sections:[{name:spec.name,from:0,to:questions.length}],questions};
}
export function separateSummaries(saved?:StarterPackContent):MockSummary[]{
 return EXAM_PRACTICE_PACKS.map(x=>{
  const t=buildSeparatePractice(x.id,saved)!;
  return {id:t.id,name:t.name,exam:t.exam,kind:t.kind,tier:t.tier,level:t.level,minutes:t.minutes,questionCount:t.questionCount,
    marksPerCorrect:t.marksPerCorrect,negativeMarks:t.negativeMarks,underReview:t.underReview,sections:t.sections.map(s=>s.name)};
 });
}
