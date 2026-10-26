'use client';
import {useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import {Header} from '@/components/layout/header';
import {Footer} from '@/components/layout/footer';
import {api} from '@/lib/api';
import {ProAnalytics} from '@/components/results/pro-analytics';
type Attempt={title:string;submittedAt:string|null;testId:string;result:null|{score:number;total:number;percentage:number;passed:boolean;review:{id:string;question:string;options:string[];selected:number;correctAnswer:number;explanation:string}[]}};
export default function ReviewPage(){
 const {id}=useParams<{id:string}>();const [item,setItem]=useState<Attempt|null>(null);const [error,setError]=useState('');
 useEffect(()=>{let active=true;void api<{attempt:Attempt}>(`/api/v1/exam-attempts/${encodeURIComponent(id)}`).then(r=>{if(!active)return;if(r.success&&r.data)setItem(r.data.attempt);else setError(r.error?.message||'Attempt unavailable');});return()=>{active=false}},[id]);
 return <><Header/><main className="mx-auto w-full max-w-4xl flex-1 space-y-5 px-4 py-10">
 <Link href="/dashboard" className="text-sm underline">Back to dashboard</Link>
 {error&&<p role="alert">{error}</p>}
 {!item&&!error&&<p>Loading saved result…</p>}
 {item&&!item.submittedAt&&<section className="rounded-xl border p-5"><h1 className="text-xl font-bold">Exam still in progress</h1><p>Your existing answers can be recovered on the exam page, subject to the server deadline.</p><Link className="mt-3 inline-block underline" href={`/india-mocks/${item.testId}`}>Return to exam</Link></section>}
 {item?.result&&<><h1 className="text-2xl font-bold">{item.title} — Saved result</h1><p className="text-xl font-semibold">{item.result.score} / {item.result.total} marks ({item.result.percentage}%) · {item.result.passed?'Passed':'Not passed'}</p>
 <ProAnalytics attemptId={id} />
 {item.result.review.map((q,i)=><article key={q.id} className="rounded-lg border bg-card p-4"><h2 className="font-semibold">{i+1}. {q.question}</h2><p className="mt-2 text-sm">Your choice: {q.selected===-1?'Skipped':q.options[q.selected]}; correct: {q.options[q.correctAnswer]}</p><p className="mt-2 text-sm text-muted-foreground">{q.explanation}</p></article>)}</>}
 </main><Footer/></>
}