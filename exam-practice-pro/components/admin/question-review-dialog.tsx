'use client';
import {useState} from 'react';
import {CheckCircle2,LoaderCircle,ShieldCheck} from 'lucide-react';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import type {AdminQuestion} from '@/lib/admin';
import {LETTERS} from './ui';
export type QuestionAction='review'|'review_publish'|'publish'|'draft'|'access'|'retire'|'restore';
export function QuestionReviewDialog({question:q,busy,error,onClose,onConfirm,hasNext}:{question:AdminQuestion;busy:boolean;error:string;onClose:()=>void;onConfirm:(action:QuestionAction,next:boolean)=>void;hasNext:boolean}){
 const [acknowledged,setAcknowledged]=useState(false);
 const reviewed=!!q.reviewed_at&&['reviewed','published'].includes(q.review_status);
 return <Dialog open onOpenChange={open=>{if(!open&&!busy)onClose();}}>
  <DialogContent showCloseButton={!busy} className="max-h-[90dvh] overflow-y-auto rounded-3xl p-6 sm:max-w-2xl sm:p-8">
   <DialogHeader><span className="inline-flex w-fit items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200"><ShieldCheck className="h-4 w-4"/>HUMAN REVIEW · QUESTION #{q.position}</span><DialogTitle className="mt-2 text-xl font-bold">{reviewed?'Publish this reviewed question':'Check the question before publishing'}</DialogTitle><DialogDescription>{q.access_tier==='premium'?'Pro only':'Free practice'} · {q.difficulty} · {reviewed?'A review is already recorded. Publishing keeps that review.':'Confirm the wording, correct option and explanation below.'}</DialogDescription></DialogHeader>
   <h3 className="text-base font-semibold leading-7">{q.question}</h3>
   <div className="grid gap-2 sm:grid-cols-2">{q.options.map((option,i)=><div key={i} className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${i===q.answer?'border-emerald-300 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100':''}`}><span className="font-bold">{LETTERS[i]}.</span><span className="flex-1">{option}</span>{i===q.answer&&<CheckCircle2 aria-label="Correct answer" className="h-4 w-4 shrink-0 text-emerald-600"/>}</div>)}</div>
   <div className="rounded-xl border bg-muted/30 p-4"><h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Answer explanation</h4><p className="mt-2 text-sm leading-6">{q.explanation}</p></div>
   {!reviewed&&<label className="flex cursor-pointer items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 text-sm dark:border-indigo-800 dark:bg-indigo-950/30"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={acknowledged} disabled={busy} onChange={e=>setAcknowledged(e.target.checked)}/><span>I checked the question, correct answer and explanation, and approve this version for learners.</span></label>}
   {error&&<p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</p>}
   <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
    <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
    {!reviewed&&<Button type="button" variant="outline" disabled={busy||!acknowledged} onClick={()=>onConfirm('review',false)}>Mark reviewed only</Button>}
    <Button type="button" className="min-h-11 bg-indigo-600 text-white hover:bg-indigo-700" disabled={busy||(!reviewed&&!acknowledged)} onClick={()=>onConfirm(reviewed?'publish':'review_publish',false)}>{busy&&<LoaderCircle className="h-4 w-4 animate-spin"/>}{busy?'Saving…':reviewed?'Publish question':'Review & publish'}</Button>
    {hasNext&&<Button type="button" variant="outline" className="min-h-11" disabled={busy||(!reviewed&&!acknowledged)} onClick={()=>onConfirm(reviewed?'publish':'review_publish',true)}>Publish & review next →</Button>}
   </div>
   <p className="text-xs leading-5 text-muted-foreground">Publishing a question is separate from publishing its mock. Changing question text or access later resets review.</p>
  </DialogContent>
 </Dialog>;
}
