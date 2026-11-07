'use client';

import { MicroPasses } from '@/components/payments/micro-passes';
import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Crown, Lock } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { PLANS, inr, planPrice } from '@/lib/plans';
import type { MockSummary } from '@/lib/mocks';

type Preview = {version:string;questions:{id:string;question:string;options:string[]}[]};
type Result = {correct:number;total:number;solutions:{id:string;answer:number;explanation:string}[]};

export function ProMockModal({test,onClose}:{test:MockSummary;onClose:()=>void}) {
  const [preview,setPreview] = useState<Preview|null>(null);
  const [answers,setAnswers] = useState<number[]>([]);
  const [result,setResult] = useState<Result|null>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const pro = PLANS.find(p=>p.id==='pro')!;
  const count = test.previewQuestionCount ?? 0;
  const load = async()=>{
    setBusy(true);setError('');
    const r = await api<{preview:Preview}>(`/api/v1/mocks/${encodeURIComponent(test.id)}/preview`,{public:true});
    setBusy(false);
    if(r.success&&r.data){setPreview(r.data.preview);setAnswers(r.data.preview.questions.map(()=>-1));setResult(null);}
    else setError(r.error?.message||'Preview is temporarily unavailable.');
  };
  const submit = async()=>{
    if(!preview)return;
    setBusy(true);setError('');
    const r = await api<{result:Result}>(`/api/v1/mocks/${encodeURIComponent(test.id)}/preview/submit`,{public:true,method:'POST',body:{version:preview.version,answers}});
    setBusy(false);
    if(r.success&&r.data)setResult(r.data.result);else setError(r.error?.message||'Could not check this preview.');
  };
  return <Dialog open onOpenChange={open=>{if(!open)onClose();}}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl p-6 sm:max-w-2xl sm:p-8">
      <DialogHeader>
        <span className="mb-2 inline-flex w-fit items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200"><Crown className="h-4 w-4"/>PRO · {test.exam}</span>
        <DialogTitle className="pr-6 text-2xl font-bold leading-snug">{test.name}</DialogTitle>
        <DialogDescription>{test.questionCount} questions · {test.minutes} minutes · Original exam practice</DialogDescription>
      </DialogHeader>
      {!preview ? <>
        <ul className="my-3 space-y-3 text-sm">{[
          `${test.questionCount} questions across ${test.sections.length} sections`,
          test.sectionTimingMinutes ? `${test.sectionTimingMinutes}-minute section locks for the standard timing profile` : `${test.minutes}-minute server-timed exam`,
          'Saved answers, server grading and text solutions after submission',
          'Section performance and topic analysis',
        ].map(feature=><li key={feature} className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-600"/>{feature}</li>)}</ul>
        <div className="grid gap-3 sm:grid-cols-2">
          {count>0&&<Button variant="outline" disabled={busy} className="min-h-12 whitespace-normal" onClick={()=>void load()}>{busy?'Loading preview…':`Take ${count}-Question Free Preview`}</Button>}
          <Button asChild className="min-h-12 bg-gradient-to-r from-indigo-600 to-violet-600 text-white"><Link href="/pricing"><Lock className="h-4 w-4"/>Upgrade to Pro</Link></Button>
        </div>
        <p className="text-xs text-muted-foreground">{inr(planPrice(pro,false).amount)}/month or {inr(planPrice(pro,true).amount)}/year. See current plans and payment options.</p>
      </> : <div className="space-y-5">
        <p className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200">Free preview · {preview.questions.length} fixed sample questions · Untimed · Results are not saved as an exam attempt.</p>
        {preview.questions.map((q,index)=>{
          const solution=result?.solutions.find(s=>s.id===q.id);
          return <fieldset key={q.id} className="space-y-2 rounded-xl border p-4"><legend className="px-1 text-xs font-semibold">Question {index+1}</legend><p className="text-sm font-semibold">{q.question}</p>
            {q.options.map((option,i)=><label key={i} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${solution?.answer===i?'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30':''}`}><input type="radio" className="mt-1" name={`preview-${index}`} disabled={!!result||busy} checked={answers[index]===i} onChange={()=>setAnswers(a=>a.map((v,n)=>n===index?i:v))}/><span>{option}</span></label>)}
            {solution&&<p className="pt-2 text-sm text-muted-foreground"><strong>Solution: </strong>{solution.explanation}</p>}
          </fieldset>;
        })}
        {result?<p role="status" className="text-lg font-bold">{result.correct}/{result.total} correct</p>:<Button disabled={busy} onClick={()=>void submit()}>{busy?'Checking…':'Check preview answers'}</Button>}
        <Button asChild variant="outline"><Link href="/pricing">Unlock the complete mock →</Link></Button>
      </div>}
      <MicroPasses compact/>
      {error&&<p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p>}
    </DialogContent>
  </Dialog>;
}
