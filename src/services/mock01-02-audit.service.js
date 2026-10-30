'use strict';
// Read-only audit. Near-duplicate scores are heuristic flags, not semantic proof.
const gate=require('./draft-testing-gate');
const quality=require('./mock-quality.service');
const content=require('./content.service');
const readiness=require('./mock-release-readiness.service');
const {key}=require('./ssc-content-pipeline.service');
const IDS=['ssc-cgl-2026-mock-01','ssc-cgl-2026-mock-02'];
const bad=(message,statusCode=400)=>Object.assign(new Error(message),{statusCode});
function tokens(s){return new Set(key(s).split(' ').filter(x=>x.length>2));}
function similarity(a,b){
 const x=tokens(a),y=tokens(b);
 if(!x.size||!y.size)return 0;
 let common=0;for(const word of x)if(y.has(word))common++;
 return common/(x.size+y.size-common);
}
function analyze(a,b){
 const exact=[],near=[],seenA=new Map();
 for(const q of a.entries){const k=key(q.question);if(!seenA.has(k))seenA.set(k,[]);seenA.get(k).push(q);}
 for(const q of b.entries){
  const k=key(q.question);
  for(const old of seenA.get(k)||[])exact.push({mock01Id:old.id,mock02Id:q.id});
  for(const old of a.entries){
   if(key(old.question)===k)continue;
   const score=similarity(old.question,q.question);
   if(score>=0.72)near.push({mock01Id:old.id,mock02Id:q.id,similarity:Number(score.toFixed(3))});
  }
 }
 near.sort((x,y)=>y.similarity-x.similarity);
 const inspect=r=>{
  const missingExplanation=r.entries.filter(e=>!String(e.explanation||'').trim()||String(e.explanation).trim().length<15);
  const badKeys=r.entries.filter(e=>!Number.isInteger(Number(e.answer))||Number(e.answer)<0||Number(e.answer)>3||!Array.isArray(e.options)||e.options.length!==4);
  const stale=r.entries.filter(e=>e.stale).length;
  return {id:r.testId,expected:r.expected,actual:r.actual,
   academicApproved:r.academicApproved,hindiVerified:r.hindiVerified,hindiRequired:r.hindiRequired,
   stale,missingExplanation:missingExplanation.map(x=>x.id),invalidAnswers:badKeys.map(x=>x.id),
   complete:r.expected===100&&r.actual===100&&missingExplanation.length===0&&badKeys.length===0};
 };
 return {exact,near:near.slice(0,100),nearCount:near.length,mocks:[inspect(a),inspect(b)],
  limits:'Jaccard token overlap flags near-duplicates only; human review required.'};
}
async function report(){
 if(!gate.enabled())throw bad('Mock audit available only on isolated staging.',404);
 const [a,b,defs]=await Promise.all([quality.list(IDS[0]),quality.list(IDS[1]),content.listTests()]);
 const result=analyze(a,b),structure=[];
 const expectedNames=[/reason/i,/general awareness|general knowledge|gk/i,/quant|aptitude|math/i,/english/i];
 for(const id of IDS){
  const d=defs.find(t=>t.id===id);
  const s=d?.sections||[];
  const valid=Boolean(d&&d.minutes===60&&Number(d.marksPerCorrect)===2&&Number(d.negativeMarks)===0.5&&s.length===4&&
   s.every((section,i)=>expectedNames[i].test(section.name)&&section.parts?.reduce((sum,p)=>sum+p.to-p.from,0)===25));
  structure.push({id,valid,sections:s.length,draft:d?!d.active:null});
 }
 result.structure=structure;
 result.publication=await Promise.all(IDS.map(async id=>{
  try{const r=await readiness.report(id);return {id,editorialReady:r.editorialReady,technicalReady:r.technicalReady,publicationBlocker:r.publicationBlocker};}
  catch(e){return {id,error:'Readiness unavailable: '+e.message};}
 }));
 result.releaseAuthorized=false;result.noWritesPerformed=true;
 return result;
}
module.exports={IDS,similarity,analyze,report};
