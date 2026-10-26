'use client';

import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {api} from '@/lib/api';
import {fetchMock,type MockQuestion,type MockTest} from '@/lib/mocks';
import {ExamEngine} from '@/components/mocks/exam-engine';

type Topic={
 id:string;name:string;category:string;active:boolean;
 questionCount:number;activeQuestionCount:number;available:boolean;practiceTestId:string;
};

export function CompetitiveTopicBuilder(){
 const [topics,setTopics]=useState<Topic[]>([]);
 const [selection,setSelection]=useState<string[]>([]);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const [creating,setCreating]=useState(false);
 const [session,setSession]=useState<MockTest|null>(null);
 const [limit,setLimit]=useState(10);
 useEffect(()=>{
  let ok=true;
  api<{topics:Topic[]}>('/api/v1/mocks/competitive-topics',{public:true})
   .then(r=>{
    if(!ok)return;
    if(!r.success || !r.data)throw Error(r.error?.message||'Could not load topics');
    setTopics(r.data.topics);
   }).catch(()=>{if(ok)setError('Topic status is temporarily unavailable. Open the live catalogue instead.');})
   .finally(()=>{if(ok)setLoading(false);});
  return()=>{ok=false;};
 },[]);
 const selected=useMemo(()=>topics.filter(t=>selection.includes(t.id)&&t.available),[selection,topics]);
 const total=topics.reduce((sum,t)=>sum+t.questionCount,0);

 async function build(){
  if(!selected.length||creating)return;
  setCreating(true);setError('');
  try{
   const loads=await Promise.all(selected.map(t=>fetchMock(t.practiceTestId,'practice')));
   if(loads.some(x=>x.status!=='ok'))throw Error('A selected topic is no longer available; refresh the catalogue.');
   const questions:MockQuestion[]=[];
   const sections:MockTest['sections']=[];
   for(let i=0;i<selected.length;i++){
    const result=loads[i];
    if(result.status!=='ok')continue;
    const from=questions.length;
    const picked=result.test.questions.slice(0,limit).map(q=>({...q,section:i}));
    questions.push(...picked);
    sections.push({name:selected[i].name,from,to:questions.length});
   }
   if(!questions.length)throw Error('No reviewed questions are available from these topics.');
   const mock:MockTest={
    id:'custom-competitive-practice',name:'My competitive practice set',exam:'Custom practice',
    kind:'topic',tier:'free',level:'Practice',minutes:Math.max(15,questions.length),
    questionCount:questions.length,marksPerCorrect:1,negativeMarks:0,
    sections,questions,
   };
   setSession(mock);
  }catch(e){setError(e instanceof Error?e.message:'Could not create a practice session');}
  finally{setCreating(false);}
 }
 return <section className="mx-auto max-w-6xl px-4 py-12" id="build-topics">
  <div className="flex flex-wrap items-end justify-between gap-4">
   <div>
    <p className="ep-eyebrow">Live Neon question bank</p>
    <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">Build a competitive practice set</h2>
    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
     Four SSC, Banking and Railway groups · {loading?'checking totals…':total+' questions staged'}.
     Only reviewed, active topics can be used. Custom sets are unscored practice sessions, not official exams.
    </p>
   </div>
   <Link href="/admin" className="text-sm font-semibold text-indigo-700 underline dark:text-indigo-300">Owner review dashboard</Link>
  </div>
  {error&&<p role="alert" className="mt-4 rounded-lg border border-amber-400 p-3 text-sm">{error}</p>}
  {loading&&<p role="status" className="mt-4 text-sm text-muted-foreground">Checking topic availability…</p>}
  <div className="mt-5 grid gap-3 sm:grid-cols-2" aria-label="Competitive question groups">
   {topics.map(topic=><label key={topic.id} className={'flex min-w-0 items-start gap-3 rounded-xl border p-4 '+(topic.available?'bg-card':'bg-muted/30')}>
    <input type="checkbox" className="mt-1 h-4 w-4" disabled={!topic.available || session!==null}
      checked={selection.includes(topic.id)} onChange={e=>setSelection(xs=>e.target.checked?[...xs,topic.id]:xs.filter(x=>x!==topic.id))}/>
    <span className="min-w-0 flex-1">
     <span className="block text-sm font-bold">{topic.name}</span>
     <span className="mt-1 block text-xs text-muted-foreground">{topic.questionCount} questions · {topic.category}</span>
     <span className={'mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold '+(topic.available?'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300':'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300')}>
      {topic.available?'Available for practice':'Awaiting owner review'}
     </span>
     {topic.available&&<Link href={'/india-mocks/'+encodeURIComponent(topic.practiceTestId)+'?mode=practice'} className="mt-2 block text-xs font-semibold text-indigo-700 underline dark:text-indigo-300">Open full topic practice</Link>}
    </span>
   </label>)}
  </div>
  {!session&&!!topics.length&&<div className="mt-5 flex flex-wrap items-end gap-3">
   <label className="grid gap-1 text-sm font-medium">Questions per selected topic
    <select className="min-h-11 rounded-lg border bg-card px-3" value={limit} onChange={e=>setLimit(Number(e.target.value))}>
     {[5,10,25].map(n=><option key={n} value={n}>{n}</option>)}
    </select>
   </label>
   <button type="button" disabled={!selected.length||creating} onClick={()=>void build()}
    className="min-h-11 rounded-lg bg-indigo-700 px-5 py-2 font-semibold text-white disabled:opacity-50">
    {creating?'Preparing…':`Start practice · ${selected.length*limit} questions`}
   </button>
  </div>}
  {session&&<div className="mt-8 rounded-xl border bg-background p-3 sm:p-5">
   <div className="flex flex-wrap justify-between gap-3">
    <p className="font-semibold">Custom practice · {session.questions.length} questions</p>
    <button className="text-sm font-semibold underline" type="button" onClick={()=>setSession(null)}>Close practice</button>
   </div>
   <ExamEngine key={session.sections.map(x=>x.name).join('|')+session.questions.length} test={session} mode="practice"/>
  </div>}
  {!topics.length&&!loading&&!error&&<p className="mt-4 text-sm text-muted-foreground">No competitive topics have been configured.</p>}
 </section>;
}
