'use client';
import Link from 'next/link';
import { Clock, Crown, FileQuestion, Lock, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ShareTestButtons } from '@/components/exampro/share-test-buttons';
import { ContentReviewBadge } from '@/components/shared/content-review';
import { isProTest, type MockSummary, type PlanState } from '@/lib/mocks';

export function MockCard({test:t,plan,onPreview}:{test:MockSummary;plan:PlanState;onPreview:(test:MockSummary)=>void}) {
  const pro=isProTest(t);
  return <article className={`relative flex h-full flex-col gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-lg ${pro?'border-indigo-300 shadow-indigo-500/10 dark:border-indigo-700':'border-border'}`}>
    {pro&&<div aria-hidden className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-indigo-500 to-violet-500"/>}
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-semibold text-muted-foreground">{t.exam}</span><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${pro?'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200':'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'}`}>{pro?<><Crown className="h-3.5 w-3.5"/>PRO · {t.questionCount===100?'Full Length':'Mock Test'}</>:'● Free Practice'}</span></div>
    <h3 className="text-lg font-bold leading-snug">{t.name}</h3>
    <ContentReviewBadge underReview={t.underReview!==false}/>
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground"><span className="flex items-center gap-1"><FileQuestion className="h-4 w-4"/>{t.questionCount} questions</span><span className="flex items-center gap-1"><Clock className="h-4 w-4"/>{t.minutes} min</span><span>+{t.marksPerCorrect} / −{t.negativeMarks}</span></div>
    <p className={`rounded-xl p-3 text-xs leading-5 ${pro?'bg-indigo-50 text-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-200':'bg-muted/50 text-muted-foreground'}`}>{t.sections.join(' · ')}{t.sectionTimingMinutes&&<span className="mt-1 flex items-center gap-1 font-semibold"><Timer className="h-3.5 w-3.5"/>{t.sectionTimingMinutes}m section locks</span>}</p>
    <div className="mt-auto grid gap-2">
      {pro&&!plan.active?<Button disabled={!plan.loaded} className="min-h-11 bg-gradient-to-r from-indigo-600 to-violet-600 text-white" onClick={()=>onPreview(t)}><Lock className="h-4 w-4"/>{plan.loaded?'Unlock with Pro / Free Preview':'Checking plan…'}</Button>:<>
        {!t.practiceOnly&&<Button asChild className={pro?'min-h-11 bg-indigo-600 text-white hover:bg-indigo-700':'min-h-11'}><Link href={`/india-mocks/${t.id}?mode=test`}>{pro?'Start Pro Exam →':'Start Free Test'}</Link></Button>}
        {!pro&&t.kind==='topic'&&<Button variant="outline" asChild className="min-h-11"><Link href={`/india-mocks/${t.id}?mode=practice`}>Practice Mode</Link></Button>}
      </>}
    </div>
    <ShareTestButtons testId={t.id} title={t.name} compact testMode={t.practiceOnly?'practice':'test'}/>
  </article>;
}
