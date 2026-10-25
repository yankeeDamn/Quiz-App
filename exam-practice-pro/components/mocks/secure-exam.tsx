'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

type Question = {id:string;topic:string;section:number;question:string;options:string[]};
type Review = {id:string;question:string;options:string[];selected:number;correctAnswer:number;explanation:string;correct:boolean};
type Attempt = {
 id:string;testId:string;title:string;startedAt:string;deadlineAt:string;submittedAt:string|null;
 responses:Record<string,number>;
 test:{id:string;name:string;minutes:number;marksPerCorrect:number;negativeMarks:number;passPercent:number;questions:Question[];sections:{name:string;from:number;to:number}[]};
 result:null|{score:number;total:number;percentage:number;passed:boolean;correct:number;incorrect:number;skipped:number;review:Review[]}
};

export function SecureExam({testId}:{testId:string}) {
 const {data:session,status} = useSession();
 const [attempt,setAttempt] = useState<Attempt|null>(null);
 const [responses,setResponses] = useState<Record<string,number>>({});
 const [busy,setBusy] = useState(false);
 const [error,setError] = useState('');
 const [seconds,setSeconds] = useState(0);
 const [current,setCurrent] = useState(0);
 const [saved,setSaved] = useState(true);
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
   <h2 className="text-xl font-bold">Answer review</h2>
   {attempt.result.review.map((q,i)=><article key={q.id} className="rounded-lg border p-4"><h3 className="font-semibold">{i+1}. {q.question}</h3><p className="mt-2 text-sm">Your choice: {q.selected===-1?'Skipped':q.options[q.selected]} · Correct: {q.options[q.correctAnswer]}</p><p className="mt-2 text-sm text-muted-foreground">{q.explanation}</p></article>)}
 </section>;
 const questions=attempt.test.questions;
 const question=questions[current];
 const selected=responses[question.id]??-1;
 const mm=Math.floor(seconds/60),ss=String(seconds%60).padStart(2,'0');
 return <section className="space-y-5">
   <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-4">
     <div><h1 className="text-xl font-bold">{attempt.title}</h1><p className="text-sm text-muted-foreground">{Object.keys(responses).length}/{questions.length} answered · {saved?'Progress saved':'Saving…'}</p></div>
     <div role="timer" className="font-mono text-xl font-bold">{mm}:{ss}</div>
   </div>
   {error&&<p className="rounded-lg border border-red-500 p-3 text-sm" role="alert">{error}</p>}
   <article className="rounded-xl border bg-card p-5">
     <p className="text-sm text-muted-foreground">Question {current+1} of {questions.length}</p>
     <h2 className="mt-3 text-lg font-semibold">{question.question}</h2>
     <fieldset className="mt-4 space-y-2">
       <legend className="sr-only">Select your answer</legend>
       {question.options.map((choice,i)=><label key={i} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted"><input type="radio" name={question.id} checked={selected===i} onChange={()=>update(question.id,i)}/><span>{String.fromCharCode(65+i)}. {choice}</span></label>)}
     </fieldset>
     <div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" onClick={()=>update(question.id,-1)}>Clear answer</Button><Button variant="outline" disabled={current===0} onClick={()=>setCurrent(x=>x-1)}>Previous</Button><Button disabled={current===questions.length-1} onClick={()=>setCurrent(x=>x+1)}>Next</Button></div>
   </article>
   <div className="flex flex-wrap gap-2">{questions.map((q,i)=><button key={q.id} aria-label={`Question ${i+1}`} aria-current={i===current?'true':undefined} onClick={()=>setCurrent(i)} className={`h-10 min-w-10 rounded-lg border text-sm ${i===current?'border-indigo-600 ring-2 ring-indigo-400':''} ${responses[q.id]!==undefined?'bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-200':''}`}>{i+1}</button>)}</div>
   <Button disabled={busy} onClick={()=>void submit()}>{busy?'Submitting…':'Submit exam'}</Button>
   <p className="text-xs text-muted-foreground">This is a server-timed exam. Refreshing the page recovers saved answers and the original deadline. Answers and explanations appear only after submission.</p>
 </section>;
}
