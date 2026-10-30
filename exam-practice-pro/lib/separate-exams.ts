import packs from '@/../content/separate-exam-practice-starter.json';
import type {MockTest,MockSummary,MockQuestion} from '@/lib/mocks';

// Independent, original practice packs. No scored attempts or publication state.
export const EXAM_PRACTICE_PACKS = [
 {id:'railways-rrb-starter',key:'railways-rrb',name:'Railways RRB Starter',exam:'Railways'},
 {id:'banking-ibps-starter',key:'banking-ibps',name:'Banking IBPS Starter',exam:'Banking'},
 {id:'upsc-gs-starter',key:'upsc-gs',name:'UPSC General Studies Starter',exam:'UPSC / PSC'},
] as const;
export function buildSeparatePractice(id:string):MockTest|null {
 const spec=EXAM_PRACTICE_PACKS.find(x=>x.id===id);
 if(!spec)return null;
 const rows=packs[spec.key];
 const questions:MockQuestion[]=rows.map((row,index)=>({
  id:spec.id+':'+index,topic:spec.id,topicName:spec.name,section:0,
  question:row.question,options:row.options,answer:row.answer,explanation:row.explanation,
 }));
 return {id:spec.id,name:spec.name,exam:spec.exam,kind:'topic',tier:'free',level:'Practice',minutes:20,
  questionCount:questions.length,marksPerCorrect:1,negativeMarks:0,
  sections:[{name:spec.name,from:0,to:questions.length}],questions};
}
export function separateSummaries():MockSummary[]{
 return EXAM_PRACTICE_PACKS.map(x=>{
  const t=buildSeparatePractice(x.id)!;
  return {...t,sections:t.sections.map(s=>s.name)};
 });
}
