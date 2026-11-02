'use client';
import { useEffect, useState } from 'react';
import { CreditCard, FileQuestion, GraduationCap, ListChecks, Users, RefreshCw } from 'lucide-react';
import { admin, type AdminSection } from '@/lib/admin';

type Metrics={questions:{total:number;active:number;topics:number};publication:{published:number;drafts:number};catalogue:{total:number;free:number;pro:number};attempts:{submitted:number;accuracy:number|null};plans:{active:number;manualGrants:number};checkedAt:string};
export function CommandMetrics({onNavigate}:{onNavigate:(section:AdminSection)=>void}){
  const [data,setData]=useState<Metrics|null>(null),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
  useEffect(()=>{
    let cancelled=false;
    const load=async()=>{
      const r=await admin<Metrics>('/command-center');
      if(cancelled)return;
      if(r.ok){setData(r.data);setError('');}else setError(r.message);
    };
    const changed=()=>{void load();};
    void load();window.addEventListener('exampro-catalogue-changed',changed);
    return ()=>{cancelled=true;window.removeEventListener('exampro-catalogue-changed',changed);};
  },[refresh]);
  const metrics=[
    {label:'Total question bank',value:data?.questions.total,detail:data?`${data.questions.active} active · ${data.questions.topics} topics`:'All database questions',icon:FileQuestion,section:'questions' as const,tint:'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/50'},
    {label:'Live mock catalogue',value:data?.catalogue.total,detail:data?`${data.catalogue.free} Free · ${data.catalogue.pro} Pro, including topic tests`:'Published and complete tests',icon:GraduationCap,section:'tests' as const,tint:'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50'},
    {label:'Test publication',value:data?.publication.published,detail:data?`${data.publication.published} active definitions · ${data.publication.drafts} drafts`:'Active definitions may have content blockers',icon:ListChecks,section:'tests' as const,tint:'text-amber-600 bg-amber-50 dark:bg-amber-950/50'},
    {label:'Student attempts',value:data?.attempts.submitted,detail:data?`${data.attempts.accuracy===null?'No accuracy yet':`${data.attempts.accuracy}% average accuracy`} · submitted mocks`:'Excludes private admin drafts',icon:Users,section:'overview' as const,tint:'text-sky-600 bg-sky-50 dark:bg-sky-950/50'},
    {label:'Pro access',value:data?.plans.active,detail:data?`${data.plans.manualGrants} manual grants · not revenue`:'Active Pro / Institute accounts',icon:CreditCard,section:'plans' as const,tint:'text-violet-600 bg-violet-50 dark:bg-violet-950/50'},
  ];
  return <section className="mb-7 space-y-3" aria-label="Executive metrics">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Workspace pulse</p><button type="button" className="inline-flex min-h-9 items-center gap-1 text-xs text-muted-foreground hover:text-foreground" onClick={()=>setRefresh(n=>n+1)}><RefreshCw className="h-3 w-3"/>Refresh metrics</button></div>
    {error&&<p role="alert" className="text-sm text-amber-700 dark:text-amber-300">{error}{data&&' Showing the last loaded metrics.'}</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{metrics.map(m=><button key={m.label} type="button" onClick={()=>onNavigate(m.section)} className="rounded-2xl border bg-card p-4 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-indigo-500"><span className={`mb-4 inline-flex h-9 w-9 items-center justify-center rounded-xl ${m.tint}`}><m.icon className="h-4 w-4"/></span><p className="text-2xl font-extrabold tabular-nums">{m.value===undefined?'—':m.value.toLocaleString('en-IN')}</p><h2 className="mt-1 text-xs font-semibold">{m.label}</h2><p className="mt-2 text-[11px] leading-5 text-muted-foreground">{m.detail}</p></button>)}</div>
    {data&&<p className="text-[11px] text-muted-foreground">Checked {new Date(data.checkedAt).toLocaleTimeString('en-IN')} · Payment sandbox records are test transactions.</p>}
  </section>;
}
