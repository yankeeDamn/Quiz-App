'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { ExamLanguageSwitcher, useExamLanguage, useExamTranslation } from '@/lib/exampro-language';
import { ShareTest } from '@/components/mocks/share-test';

type Question = {id:string;topic:string;section:number;question:string;options:string[]};
type Review = {id:string;question:string;options:string[];selected:number;correctAnswer:number;explanation:string;correct:boolean};
type Attempt = {
 id:string;testId:string;title:string;startedAt:string;deadlineAt:string;submittedAt:string|null;
 responses:Record<string,number>;
 test:{id:string;name:string;minutes:number;marksPerCorrect:number;negativeMarks:number;passPercent:number;questions:Question[];sections:{name:string;from:number;to:number}[]};
 result:null|{score:number;total:number;percentage:number;passed:boolean;correct:number;incorrect:number;skipped:number;review:Review[]}
};

function ReviewQuestion({item,index,lang}:{item:Review;index:number;lang:'en'|'hi'|'bn'}) {
 const [requested,setRequested]=useState(false);
 const translated=useExamTranslation(requested?lang:'en',requested?[item.question,...item.options,item.explanation]:[]);
 return <article className="rounded-lg border p-4">
  <h3 className="font-semibold">{index+1}. {translated.texts[0]||item.question}</h3>
  <p className="mt-2 text-sm">Your choice: {item.selected===-1?'Skipped':(translated.texts[item.selected+1]||item.options[item.selected])} · Correct: {translated.texts[item.correctAnswer+1]||item.options[item.correctAnswer]}</p>
  <p className="mt-2 text-sm text-muted-foreground">{translated.texts[5]||item.explanation}</p>
  {lang!=='en'&&!requested&&<button type="button" onClick={()=>setRequested(true)}
    className="mt-2 rounded-lg border px-3 py-2 text-xs font-semibold">Translate this review</button>}
  {requested&&translated.state==='unavailable'&&<p className="mt-2 text-xs text-amber-700">Translation unavailable; showing English.</p>}
 </article>;
}

export function SecureExam({testId}:{testId:string}) {
 const {data:session,status} = useSession();
 const {lang,setLang,labels}=useExamLanguage();
 const [attempt,setAttempt] = useState<Attempt|null>(null);
 const [responses,setResponses] = useState<Record<string,number>>({});
 const [busy,setBusy] = useState(false);
 const [error,setError] = useState('');
 const [seconds,setSeconds] = useState(0);
 const [current,setCurrent] = useState(0);
 const [saved,setSaved] = useState(true);
 // Review flags are UI-only; answer submissions and deadlines remain server-authoritative.
 const [marked,setMarked] = useState<Record<string,boolean>>({});
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

 const visible=attempt && !attempt.submittedAt ? attempt.test.questions[current] : null;
 const translation=useExamTranslation(lang,visible?[visible.question,...visible.options]:[]);
 if(status==='loading')return <p className="p-6" aria-busy="true">Checking sign-in…</p>;
 if(status!=='authenticated'||!session?.user?.email)return <section className="rounded-xl border p-6"><h1 className="text-xl font-bold">Sign in to take a scored exam</h1><p className="mt-2 text-sm text-muted-foreground">Guest practice is available, but scored exams require a verified Google or GitHub account to sync results across devices.</p><Button className="mt-4" asChild><Link href={`/auth/signin?callbackUrl=${encodeURIComponent('/india-mocks/'+testId)}`}>Sign in</Link></Button></section>;
 if(error&&!attempt)return <div className="rounded-lg border p-5" role="alert">{error}<p className="mt-2 text-sm">Check that the API, Neon database and OAuth credentials are configured, then reload the page.</p></div>;
 if(!attempt)return <p className="p-6" aria-busy="true">Starting or recovering your saved exam…</p>;
 if(attempt.submittedAt&&attempt.result)return <section className="space-y-6">
   <div className="rounded-xl border bg-card p-6"><h1 className="text-2xl font-bold">{attempt.title} — Result</h1><div className="mt-3 flex flex-wrap gap-3"><ExamLanguageSwitcher lang={lang} onChange={setLang}/><ShareTest id={testId} title={attempt.title} lang={lang}/></div><p className="mt-2 text-xl font-semibold">{attempt.result.score} / {attempt.result.total} marks ({attempt.result.percentage}%)</p><p>{attempt.result.passed?'Passed':'Not passed'} · {attempt.result.correct} correct · {attempt.result.incorrect} incorrect · {attempt.result.skipped} skipped</p><Button className="mt-4" asChild><Link href="/dashboard">View dashboard</Link></Button></div>
   <h2 className="text-xl font-bold">Answer review</h2>
   {attempt.result.review.map((q,i)=><ReviewQuestion key={q.id} item={q} index={i} lang={lang}/>)}
 </section>;
 const questions=attempt.test.questions;
 const question=questions[current];
 const selected=responses[question.id]??-1;
 const mm=Math.floor(seconds/60),ss=String(seconds%60).padStart(2,'0');
 return <section className="space-y-5">
   <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-4">
     <div><h1 className="text-xl font-bold">{attempt.title}</h1><p className="text-sm text-muted-foreground">{Object.keys(responses).length}/{questions.length} {labels.answered} · {saved?labels.saved:labels.saving}</p></div>
     <div className="flex flex-wrap items-center gap-2"><ExamLanguageSwitcher lang={lang} onChange={setLang}/><div role="timer" className="font-mono text-xl font-bold">{mm}:{ss}</div></div>
   </div>
   {error&&<p className="rounded-lg border border-red-500 p-3 text-sm" role="alert">{error}</p>}
   {translation.state==='unavailable'&&lang!=='en'&&<p role="status" className="text-xs text-amber-700 dark:text-amber-300">{labels.translateError}</p>}
   <div className="flex flex-wrap gap-2" role="group" aria-label="Exam sections">
     {attempt.test.sections.map((section,i)=><button key={i} type="button" onClick={()=>setCurrent(Math.min(Math.max(section.from,0),questions.length-1))}
       aria-pressed={current>=section.from && current<section.to}
       className={'min-h-10 rounded-lg border px-3 py-2 text-sm font-semibold ' +
         (current>=section.from && current<section.to ? 'border-indigo-600 bg-indigo-50 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100' : 'hover:bg-muted')}>
       {section.name}
     </button>)}
   </div>
   <article className="rounded-xl border bg-card p-5">
     <p className="text-sm text-muted-foreground">{labels.question} {current+1} {labels.of} {questions.length}</p>
     <h2 className="mt-3 text-lg font-semibold">{translation.texts[0]||question.question}</h2>
     <fieldset className="mt-4 space-y-2">
       <legend className="sr-only">Select your answer</legend>
       {question.options.map((choice,i)=><label key={i} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted"><input type="radio" name={question.id} checked={selected===i} onChange={()=>update(question.id,i)}/><span>{String.fromCharCode(65+i)}. {translation.texts[i+1]||choice}</span></label>)}
     </fieldset>
     <div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" onClick={()=>update(question.id,-1)}>{labels.clear}</Button><Button variant="outline" aria-pressed={Boolean(marked[question.id])} onClick={()=>setMarked(old=>({...old,[question.id]:!old[question.id]}))}>{marked[question.id]?'Unmark review':'Mark for review'}</Button><Button variant="outline" disabled={current===0} onClick={()=>setCurrent(x=>x-1)}>{labels.previous}</Button><Button disabled={current===questions.length-1} onClick={()=>setCurrent(x=>x+1)}>{labels.next}</Button></div>
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
   <ShareTest id={testId} title={attempt.title} lang={lang} compact/><Button disabled={busy} onClick={()=>void submit()}>{busy?'Submitting…':labels.submit}</Button>
   <p className="text-xs text-muted-foreground">This is a server-timed exam. Refreshing the page recovers saved answers and the original deadline. Answers and explanations appear only after submission.</p>
 </section>;
}
