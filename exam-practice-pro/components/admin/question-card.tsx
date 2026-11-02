'use client';
import {CheckCircle2,ClipboardCheck,EyeOff,LoaderCircle,Pencil,RotateCcw,ShieldCheck} from 'lucide-react';
import {Button} from '@/components/ui/button';
import type {AdminQuestion} from '@/lib/admin';
import {LETTERS} from './ui';
import type {QuestionAction} from './question-review-dialog';
export function questionStage(q:AdminQuestion){
 if(!q.active)return 'retired';
 if(!q.reviewed_at||q.review_status==='draft')return 'needs-review';
 return q.review_status==='published'?'published':'reviewed';
}
export function QuestionCard({question:q,busy,onReview,onEdit,onAction,onAccess,message}:{question:AdminQuestion;busy:boolean;onReview:()=>void;onEdit:()=>void;onAction:(action:QuestionAction)=>void;onAccess:(tier:'free'|'premium')=>void;message?:{kind:'ok'|'error';text:string}}){
 const stage=questionStage(q);
 const badges={published:['Published & reviewed','bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'],reviewed:['Reviewed · ready to publish','bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200'],'needs-review':['Needs human review','bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'],retired:['Retired · hidden','bg-muted text-muted-foreground']};
 return <article id={`question-${q.id}`} className={`rounded-2xl border bg-card p-4 shadow-sm sm:p-6 ${stage==='retired'?'border-dashed':'border-border/80'}`} aria-label={`Question ${q.position}`} aria-busy={busy}>
  <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-muted px-2 py-1 font-mono text-xs font-semibold">#{q.position}</span><span className={`rounded-full px-3 py-1 text-xs font-semibold ${badges[stage][1]}`}>{badges[stage][0]}</span><span className="text-xs text-muted-foreground">{q.difficulty}</span></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${q.access_tier==='premium'?'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200':'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'}`}>{q.access_tier==='premium'?'★ PRO ONLY':'● FREE PRACTICE'}</span></div>
  <h3 className="mt-4 text-base font-semibold leading-7">{q.question}</h3>
  <div className="mt-3 grid gap-2 sm:grid-cols-2">{q.options.map((option,i)=><div key={i} className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm ${q.answer===i?'border-emerald-200 bg-emerald-50/70 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100':'bg-muted/15 text-muted-foreground'}`}><span className="font-semibold">{LETTERS[i]}.</span><span className="flex-1">{option}</span>{q.answer===i&&<CheckCircle2 aria-label="Correct answer" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"/>}</div>)}</div>
  <div className="mt-3 rounded-xl bg-muted/30 px-4 py-3"><p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Explanation</p><p className="mt-1 text-sm leading-6">{q.explanation}</p></div>
  {message&&<p role={message.kind==='error'?'alert':'status'} className={`mt-3 rounded-xl border p-3 text-sm ${message.kind==='error'?'border-red-300 text-red-700 dark:text-red-300':'border-emerald-300 text-emerald-800 dark:text-emerald-200'}`}>{message.text}</p>}
  {!q.revision&&<p className="mt-3 text-xs text-amber-800 dark:text-amber-300">Refresh this topic after the updated API is available to enable question actions.</p>}
  <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
   {stage==='retired'?<Button type="button" variant="outline" className="min-h-11" disabled={busy||!q.revision} onClick={()=>onAction('restore')}><RotateCcw/>Restore question</Button>:stage==='published'?<Button type="button" variant="secondary" className="min-h-11 text-emerald-700 dark:text-emerald-300" disabled><CheckCircle2/>Published</Button>:<Button type="button" className="min-h-11 bg-indigo-600 text-white hover:bg-indigo-700" disabled={busy||!q.revision} onClick={onReview}>{busy?<LoaderCircle className="animate-spin"/>:stage==='reviewed'?<ClipboardCheck/>:<ShieldCheck/>}{stage==='reviewed'?'Publish reviewed question':'Review & publish'}</Button>}
   <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={onEdit}><Pencil/>Edit question</Button>
   <label className="ml-auto flex min-h-11 flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">Question access<select aria-label={`Access for question ${q.position}`} className="min-h-11 rounded-xl border bg-background px-3 text-sm text-foreground disabled:opacity-50" value={q.access_tier} disabled={busy||!q.revision} onChange={e=>onAccess(e.target.value as 'free'|'premium')}><option value="free">Free practice</option><option value="premium">Pro only</option></select></label>
   <details className="relative"><summary className="flex min-h-11 cursor-pointer items-center rounded-xl border px-3 text-xs font-semibold hover:bg-muted">More actions</summary><div className="absolute right-0 z-10 mt-2 grid min-w-52 gap-1 rounded-xl border bg-popover p-2 shadow-lg">{stage!=='retired'&&<Button type="button" variant="ghost" className="justify-start" disabled={busy||!q.revision} onClick={()=>onAction('retire')}><EyeOff/>Retire question</Button>}{q.review_status!=='draft'&&<Button type="button" variant="ghost" className="justify-start" disabled={busy||!q.revision} onClick={()=>onAction('draft')}><RotateCcw/>Return to draft</Button>}</div></details>
  </div>
 </article>;
}
