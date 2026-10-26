'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {api} from '@/lib/api';
type Group={name:string;total:number;attempted:number;correct:number;incorrect:number;skipped:number;accuracy:number|null;score?:number};
type Report={questions:number;score:number;totalMarks:number;percentage:number;accuracy:number|null;elapsedSeconds:number;allowedSeconds:number;sections:Group[];topics:Group[];weakTopics:{topicId:string;name:string;incorrect:number;skipped:number;suggestion:string}[];methodology:string};
type State={status:'loading'|'ready'|'upgrade'|'error';data?:Report;message?:string};
function Metric({label,value}:{label:string;value:string}){return <div className="rounded-xl border bg-card p-4"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-xl font-bold tabular-nums">{value}</dd></div>}
const clock=(seconds:number)=>`${Math.floor(seconds/60)}m ${seconds%60}s`;
export function ProAnalytics({attemptId}:{attemptId:string}){
 const [state,setState]=useState<State>({status:'loading'});
 useEffect(()=>{
  let active=true;
  void api<{report:Report}>(`/api/v1/exam-attempts/${encodeURIComponent(attemptId)}/analytics`).then(r=>{
   if(!active)return;
   if(r.success&&r.data)setState({status:'ready',data:r.data.report});
   else if(r.error?.code==='PLAN_REQUIRED')setState({status:'upgrade'});
   else setState({status:'error',message:r.error?.message||'Could not load Pro analytics.'});
  }).catch(()=>active&&setState({status:'error',message:'Analytics are temporarily unavailable.'}));
  return ()=>{active=false};
 },[attemptId]);
 if(state.status==='loading')return <section aria-busy="true" className="rounded-2xl border p-5"><h2 className="text-xl font-bold">Post-test analytics</h2><p className="mt-2 text-sm text-muted-foreground">Checking detailed report access…</p></section>;
 if(state.status==='upgrade')return <section className="rounded-2xl border p-5"><h2 className="text-xl font-bold">Unlock your detailed Pro report</h2><p className="mt-2 text-sm text-muted-foreground">Your free score and question explanations stay available below. Pro adds section performance, topic accuracy and focused revision priorities.</p><Link href="/pricing" className="mt-3 inline-block rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white">See Pro plans</Link></section>;
 if(state.status==='error'||!state.data)return <section role="status" className="rounded-2xl border p-5 text-sm">{state.message||'Detailed report unavailable.'} Your basic result is still available below.</section>;
 const r=state.data;
 return <section className="space-y-6 rounded-2xl border bg-background p-5 sm:p-7" aria-label="Pro post-test analytics">
  <div><p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">ExamPro Pro</p><h2 className="mt-1 text-2xl font-bold">Your post-test performance</h2></div>
  <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3"><Metric label="Score" value={`${r.score} / ${r.totalMarks}`}/><Metric label="Attempt accuracy" value={r.accuracy===null?'—':`${r.accuracy}%`}/><Metric label="Total duration" value={clock(r.elapsedSeconds)}/></dl>
  <div><h3 className="text-lg font-semibold">Section breakdown</h3><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-2">Section</th><th className="p-2">Correct</th><th className="p-2">Wrong</th><th className="p-2">Skipped</th><th className="p-2">Accuracy</th></tr></thead><tbody>{r.sections.map((s,i)=><tr key={i} className="border-b"><td className="p-2 font-medium">{s.name}</td><td className="p-2">{s.correct}</td><td className="p-2">{s.incorrect}</td><td className="p-2">{s.skipped}</td><td className="p-2">{s.accuracy===null?'—':`${s.accuracy}%`}</td></tr>)}</tbody></table></div></div>
  <div><h3 className="text-lg font-semibold">Topic accuracy</h3><div className="mt-3 space-y-3">{r.topics.map((t,i)=><div key={i}><div className="flex justify-between gap-2 text-sm"><span className="font-medium">{t.name}</span><span className="tabular-nums">{t.accuracy===null?'Not attempted':`${t.accuracy}% (${t.correct}/${t.attempted})`}</span></div><div className="mt-1 h-2 rounded-full bg-muted"><div className="h-full rounded-full bg-indigo-600" style={{width:`${t.accuracy??0}%`}}/></div></div>)}</div></div>
  <div><h3 className="text-lg font-semibold">Suggested revision priorities</h3>{r.weakTopics.length?<ol className="mt-2 space-y-2">{r.weakTopics.map(t=><li key={t.topicId} className="rounded-lg bg-muted/40 p-3 text-sm"><strong>{t.name}</strong>: {t.incorrect} incorrect, {t.skipped} skipped. {t.suggestion}</li>)}</ol>:<p className="mt-2 text-sm">No missed questions in the completed attempt. Continue practising to check consistency.</p>}</div>
  <p className="text-xs leading-relaxed text-muted-foreground">{r.methodology}</p>
 </section>;
}
