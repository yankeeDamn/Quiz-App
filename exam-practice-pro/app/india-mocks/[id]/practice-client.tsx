'use client';
import { useEffect,useState } from 'react';
import Link from 'next/link';
import type { IndiaExam } from '@/data/india-exams';
export function PracticeClient({exam}:{exam:IndiaExam}){
 const [answers,setAnswers]=useState<Record<string,number>>({});
 const [seconds,setSeconds]=useState(600);
 const [finished,setFinished]=useState(false);
 useEffect(()=>{if(finished)return;const timer=setInterval(()=>setSeconds(s=>Math.max(0,s-1)),1000);return()=>clearInterval(timer)},[finished]);
 const expired=seconds===0,done=finished||expired;
 const score=exam.questions.filter(q=>answers[q.id]===q.answer).length;
 return <main className="mx-auto max-w-3xl px-5 py-10">
 <Link href="/india-mocks" className="text-sm text-blue-700 hover:underline">← All mock tests</Link>
 <div className="mt-6 flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm text-blue-600">{exam.category}</p><h1 className="text-3xl font-bold">{exam.title}</h1></div><span role="timer" className="rounded-xl border px-4 py-2 font-mono text-lg">{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</span></div>
 {done&&<section aria-live="polite" className="mt-7 rounded-2xl bg-blue-50 p-6 text-blue-950"><h2 className="text-xl font-bold">Your result: {score}/{exam.questions.length}</h2><p>{Math.round(score/exam.questions.length*100)}% correct · {expired&&!finished?'Time expired. ':''}Review explanations below.</p><p className="mt-2 text-xs">Practice-only scoring in your browser. No student record is saved.</p></section>}
 <div className="mt-8 space-y-6">{exam.questions.map((q,i)=><section key={q.id} className="rounded-2xl border p-5"><h2 className="font-semibold">{i+1}. {q.question}</h2><fieldset disabled={done} className="mt-4 space-y-2"><legend className="sr-only">Select an answer</legend>{q.options.map((option,j)=><label key={j} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3"><input type="radio" name={q.id} checked={answers[q.id]===j} onChange={()=>setAnswers(a=>({...a,[q.id]:j}))}/>{option}</label>)}</fieldset>{done&&<p className="mt-3 text-sm text-green-700 dark:text-green-400">Correct: {q.options[q.answer]}. {q.explanation}</p>}</section>)}</div>
 {!done?<button className="mt-8 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700" onClick={()=>setFinished(true)}>Submit and view result</button>:<Link className="mt-8 inline-block rounded-lg bg-blue-600 px-6 py-3 text-white" href="/india-mocks">Try another mock →</Link>}
 </main>;
}
