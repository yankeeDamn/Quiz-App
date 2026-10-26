'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { LanguageSwitcher, useExamLanguage, useTranslatedTexts } from '@/components/exampro/exam-language';
import { ShareTestButtons } from '@/components/exampro/share-test-buttons';

type Question = {id:string;topic:string;section:number;question:string;options:string[]};
type Review = {id:string;question:string;options:string[];selected:number;correctAnswer:number;explanation:string;correct:boolean};
type Attempt = {
 id:string;testId:string;title:string;startedAt:string;deadlineAt:string;submittedAt:string|null;
 responses:Record<string,number>;
 test:{id:string;name:string;minutes:number;marksPerCorrect:number;negativeMarks:number;passPercent:number;questions:Question[];sections:{name:string;from:number;to:number}[]};
 result:null|{score:number;total:number;percentage:number;passed:boolean;correct:number;incorrect:number;skipped:number;review:Review[]}
};

function TranslatedReview({q,index}:{q:Review;index:number}) {
  const [expanded,setExpanded]=useState(false);
  const {language}=useExamLanguage();
  const source=expanded?[q.question,...q.options,q.explanation]:[];
  const translated=useTranslatedTexts(source);
  const question=expanded&&translated.texts.length?translated.texts[0]:q.question;
  const options=expanded&&translated.texts.length?translated.texts.slice(1,1+q.options.length):q.options;
  const explanation=expanded&&translated.texts.length?translated.texts[1+q.options.length]:q.explanation;
  return <article className="rounded-lg border p-4">
    <h3 className="font-semibold">{index+1}. {question}</h3>
    <p className="mt-2 text-sm">Your choice: {q.selected===-1?'Skipped':options[q.selected]} · Correct: {options[q.correctAnswer]}</p>
    <p className="mt-2 text-sm text-muted-foreground">{explanation}</p>
    {language!=='en'&&<button type="button" onClick={()=>setExpanded(v=>!v)}
      className="mt-3 text-sm font-semibold text-indigo-700 underline dark:text-indigo-300">
      {expanded?'Show original English':'Translate this review'}
    </button>}
    {expanded&&translated.warning&&<p className="mt-1 text-xs text-amber-700" role="status">{translated.warning}</p>}
  </article>;
}

export function SecureExam({testId}:{testId:string}) {
 const {data:session,status} = useSession();
 const [attempt,setAttempt] = useState<Attempt|null>(null);
 const [responses,setResponses] = useState<Record<string,number>>({});
 const [busy,setBusy] = useState(false);
 const [error,setError] = useState('');
 const [seconds,setSeconds] = useState(0);
 const [current,setCurrent] = useState(0);
 const [saved,setSaved] = useState(true);
 // Review flags are UI-only; answer submissions and deadlines remain server-authoritative.
 const [marked,setMarked] = useState<Record<string,boolean>>({});
 const {t} = useExamLanguage();
 const displayed = attempt?.test.questions[current];
 const translated = useTranslatedTexts(displayed?[displayed.question,...displayed.options]:[]);
 const submitLock=useRef(false);
 const latest=useRef<Record<string,number>>({});

 const update = useCallback((id:string,value:number) => {
   setResponses(previous => {
     const next={...previous};if(value===-1) delete next[id];else next[id]=value;
     latest.current=next;return next;
   });
   setSaved(false);
 },[]);

 useEffect(()=>{
   if (status!=='authenticated'||!session?.user?.email)return;
   let cancelled=false;
   void api<{attempt:Attempt}>('/api/v1/exam-attempts/start',{method:'POST',body:{testId}})
    .then(r=>{
      if(cancelled)return;
      if(!r.success||!r.data)throw Error(r.error?.message||'Cannot start your exam');
      setAttempt(r.data.attempt);
      setResponses(r.data.attempt.responses);
      latest.current=r.data.attempt.responses;
      setSeconds(Math.max(0,Math.ceil((new Date(r.data.attempt.deadlineAt).getTime()-Date.now())/1000)));
    }).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'Cannot start your exam')});
   return ()=>{cancelled=true};
 },[status,session?.user?.email,testId]);

 const submit = useCallback(async()=>{
   if(!attempt || attempt.submittedAt || submitLock.current)return;
   submitLock.current=true;setBusy(true);setError('');
   try{
     const r=await api<{attempt:Attempt}>(`/api/v1/exam-attempts/${attempt.id}/submit`,{method:'POST',body:{responses:latest.current}});
     if(!r.success||!r.data)throw Error(r.error?.message||'Submission failed');
     setAttempt(r.data.attempt);
     setSaved(true);
   } catch(e){setError(e instanceof Error?e.message:'Submission failed');}
   finally{setBusy(false);submitLock.current=false}
 },[attempt]);

 useEffect(()=>{
   if(!attempt||attempt.submittedAt)return;
   const clock=()=>{
     const left=Math.max(0,Math.ceil((new Date(attempt.deadlineAt).getTime()-Date.now())/1000));
     setSeconds(left);
     if(left===0)void submit();
   };
   clock();const interval=window.setInterval(clock,1000);return()=>window.clearInterval(interval);
 },[attempt,submit]);

 useEffect(()=>{
   if(!attempt||attempt.submittedAt||saved)return;
   let cancelled=false;
   const timeout=window.setTimeout(async()=>{
     const saving=latest.current;
     try {
       const r=await api<{attempt:Attempt}>(`/api/v1/exam-attempts/${attempt.id}/progress`,{method:'PUT',body:{responses:saving}});
       if(!r.success)throw Error(r.error?.message||'Could not save progress');
       if(!cancelled && saving===latest.current){setSaved(true);setError('');}
     } catch(e) {if(!cancelled)setError(e instanceof Error?e.message:'Progress not saved. Try submitting.')}
   },500);
   return()=>{cancelled=true;window.clearTimeout(timeout)};
 },[attempt,saved,responses]);

 if(status==='loading')return <p className="p-6" aria-busy="true">Checking sign-in…</p>;
 if(status!=='authenticated'||!session?.user?.email)return <section className="rounded-xl border p-6"><h1 className="text-xl font-bold">Sign in to take a scored exam</h1><p className="mt-2 text-sm text-muted-foreground">Guest practice is available, but scored exams require a verified Google or GitHub account to sync results across devices.</p><Button className="mt-4" asChild><Link href={`/auth/signin?callbackUrl=${encodeURIComponent('/india-mocks/'+testId)}`}>Sign in</Link></Button></section>;
 if(error&&!attempt)return <div className="rounded-lg border p-5" role="alert">{error}<p className="mt-2 text-sm">Check that the API, Neon database and OAuth credentials are configured, then reload the page.</p></div>;
 if(!attempt)return <p className="p-6" aria-busy="true">Starting or recovering your saved exam…</p>;
 if(attempt.submittedAt&&attempt.result)return <section className="space-y-6">
   <div className="rounded-xl border bg-card p-6"><h1 className="text-2xl font-bold">{attempt.title} — Result</h1><p className="mt-2 text-xl font-semibold">{attempt.result.score} / {attempt.result.total} marks ({attempt.result.percentage}%)</p><p>{attempt.result.passed?'Passed':'Not passed'} · {attempt.result.correct} correct · {attempt.result.incorrect} incorrect · {attempt.result.skipped} skipped</p><Button className="mt-4" asChild><Link href="/dashboard">View dashboard</Link></Button></div>
   <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-bold">Answer review</h2><ShareTestButtons testId={testId} title={attempt.title} compact/>
    </div>
   {attempt.result.review.map((q,i)=><TranslatedReview key={q.id} q={q} index={i}/> )}
 </section>;
 const questions=attempt.test.questions;
 const question=questions[current];
 const selected=responses[question.id]??-1;
 const mm=Math.floor(seconds/60),ss=String(seconds%60).padStart(2,'0');
 return <section className="space-y-5">
   <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-4">
     <div><h1 className="text-xl font-bold">{attempt.title}</h1><p className="text-sm text-muted-foreground">{Object.keys(responses).length}/{questions.length} answered · {saved?t('save'):t('saving')}</p></div>
     <div className="flex flex-wrap items-center gap-2">
      <LanguageSwitcher small/><ShareTestButtons testId={testId} title={attempt.title} compact/>
      <div role="timer" className="font-mono text-xl font-bold">{mm}:{ss}</div>
     </div>
   </div>
   {error&&<p className="rounded-lg border border-red-500 p-3 text-sm" role="alert">{error}</p>}
   <div className="flex flex-wrap gap-2" role="group" aria-label="Exam sections">
     {attempt.test.sections.map((section,i)=><button key={i} type="button" onClick={()=>setCurrent(Math.min(Math.max(section.from,0),questions.length-1))}
       aria-pressed={current>=section.from && current<section.to}
       className={'min-h-10 rounded-lg border px-3 py-2 text-sm font-semibold ' +
         (current>=section.from && current<section.to ? 'border-indigo-600 bg-indigo-50 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100' : 'hover:bg-muted')}>
       {section.name}
     </button>)}
   </div>
   <article className="rounded-xl border bg-card p-5">
     <p className="text-sm text-muted-foreground">{t('question')} {current+1} of {questions.length}</p>
     <h2 className="mt-3 text-lg font-semibold">{translated.texts[0]||question.question}</h2>
     {translated.warning&&<p className="mt-2 text-xs text-amber-700 dark:text-amber-300" role="status">{translated.warning}</p>}
     <fieldset className="mt-4 space-y-2">
       <legend className="sr-only">{t('answer')}</legend>
       {question.options.map((choice,i)=><label key={i} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted"><input type="radio" name={question.id} checked={selected===i} onChange={()=>update(question.id,i)}/><span>{String.fromCharCode(65+i)}. {translated.texts[i+1]||choice}</span></label>)}
     </fieldset>
     <div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" onClick={()=>update(question.id,-1)}>Clear answer</Button><Button variant="outline" aria-pressed={Boolean(marked[question.id])} onClick={()=>setMarked(old=>({...old,[question.id]:!old[question.id]}))}>{marked[question.id]?'Unmark review':'Mark for review'}</Button><Button variant="outline" disabled={current===0} onClick={()=>setCurrent(x=>x-1)}>{t('previous')}</Button><Button disabled={current===questions.length-1} onClick={()=>setCurrent(x=>x+1)}>{t('next')}</Button></div>
   </article>
   <div aria-label="Question status legend" className="flex flex-wrap gap-3 text-xs text-muted-foreground">
     <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-sm bg-slate-200 dark:bg-slate-700"/> Unanswered</span>
     <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-sm bg-emerald-500"/> Answered</span>
     <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-full bg-purple-500"/> Marked for review</span>
     <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-sm border-2 border-indigo-500"/> Current</span>
   </div>
   <div className="flex flex-wrap gap-2" role="group" aria-label="Question navigation">{questions.map((q,i)=>{
     const answered=responses[q.id]!==undefined;
     const flag=Boolean(marked[q.id]);
     return <button type="button" key={q.id} aria-label={'Question '+(i+1)+(answered?', answered':' , unanswered')+(flag?', marked for review':'')}
       aria-current={i===current?'true':undefined} onClick={()=>setCurrent(i)}
       className={'h-10 min-w-10 border text-sm font-semibold ' +
         (flag ? 'rounded-full bg-purple-600 text-white' :
         answered ? 'rounded-lg bg-emerald-600 text-white' :
         'rounded-lg bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-white') +
         (i===current ? ' border-indigo-500 ring-2 ring-indigo-500 ring-offset-2' : ' border-transparent')}>
       {i+1}
     </button>;
   })}</div>
   <p className="text-xs text-muted-foreground">Marks for review are visual reminders in this browser tab; only your selected answers are saved to the server.</p>
   <Button disabled={busy} onClick={()=>void submit()}>{busy?t('saving'):t('submit')}</Button>
   <p className="text-xs text-muted-foreground">This is a server-timed exam. Refreshing the page recovers saved answers and the original deadline. Answers and explanations appear only after submission.</p>
 </section>;
}
