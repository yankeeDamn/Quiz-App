'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, BookOpen, CheckCircle2, FileClock, FileQuestion, GraduationCap, Layers3, RefreshCw, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { admin, type AdminSection, type AdminTest, type AdminTopic } from '@/lib/admin';
import { api } from '@/lib/api';
import { checkedAt, jobsErrorMessage, type GovernmentJobsResponse } from '@/lib/government-jobs';
import { card } from './ui';

type ContentState = { topics: AdminTopic[]; tests: AdminTest[] };

export function AdminOverview({ onNavigate }: { onNavigate: (section: AdminSection) => void }) {
  const [content, setContent] = useState<ContentState | null>(null);
  const [contentError, setContentError] = useState('');
  const [feed, setFeed] = useState<GovernmentJobsResponse | null>(null);
  const [feedError, setFeedError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [topics, tests] = await Promise.all([
        admin<{ topics: AdminTopic[] }>('/topics'), admin<{ tests: AdminTest[] }>('/tests'),
      ]);
      if (cancelled) return;
      if (topics.ok && tests.ok) {
        setContent({ topics: topics.data.topics, tests: tests.data.tests });
        setContentError('');
      } else {
        setContentError(!topics.ok ? topics.message : !tests.ok ? tests.message : 'Could not load content counts.');
      }
      setLoading(false);
    })();
    void api<GovernmentJobsResponse>('/api/v1/government-jobs', { public: true }).then((result) => {
      if (cancelled) return;
      if (result.success && result.data) { setFeed(result.data); setFeedError(''); }
      else setFeedError(jobsErrorMessage(result.error));
    });
    return () => { cancelled = true; };
  }, [attempt]);

  const published = content?.tests.filter((test) => test.active).length;
  const drafts = content?.tests.filter((test) => !test.active) ?? [];
  const metrics = [
    { label: 'Questions in bank', value: content?.topics.reduce((sum, topic) => sum + topic.total, 0), detail: 'Includes active and retired rows', icon: FileQuestion, tint: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300' },
    { label: 'Published mocks', value: published, detail: 'Full mock tests in the catalogue', icon: GraduationCap, tint: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' },
    { label: 'Draft mocks', value: content ? drafts.length : undefined, detail: 'Awaiting review or publication', icon: FileClock, tint: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
    { label: 'Active topics', value: content?.topics.filter((topic) => topic.active).length, detail: content ? `Across ${content.topics.length} total topics` : 'Loading topics', icon: Layers3, tint: 'bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300' },
  ];

  return <div className="space-y-6">
    <section className="relative overflow-hidden rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-600 to-violet-700 p-6 text-white sm:p-8 dark:border-indigo-800">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="max-w-lg"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-100">Ready for the next milestone</p><h2 className="mt-2 text-2xl font-bold tracking-tight">Make every practice session count.</h2><p className="mt-3 text-sm leading-6 text-indigo-100">Build a strong question bank, review your mock tests and give learners a clear path forward.</p></div>
        <Button onClick={() => onNavigate('questions')} className="min-h-11 rounded-xl bg-white px-5 text-indigo-700 shadow-sm hover:bg-indigo-50">Manage question bank <ArrowRight /></Button>
      </div>
    </section>

    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-bold">Content overview</h2><button type="button" disabled={loading} onClick={() => { setLoading(true); setAttempt((value) => value + 1); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh overview</button></div>
    {contentError && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-200">{contentError}{content && ' Showing the last loaded counts.'}</p>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy={loading}>
      {metrics.map((metric) => <section key={metric.label} className={card}><div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${metric.tint}`}><metric.icon className="h-5 w-5" aria-hidden="true" /></div><p className="text-3xl font-bold tabular-nums tracking-tight">{metric.value === undefined ? '—' : metric.value.toLocaleString('en-IN')}</p><h3 className="mt-1 text-sm font-semibold">{metric.label}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{metric.detail}</p></section>)}
    </div>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <section className={card}>
        <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">Publishing queue</h2><p className="mt-1 text-xs text-muted-foreground">Draft tests stay private until you publish them.</p></div><FileClock className="h-5 w-5 shrink-0 text-amber-600" /></div>
        {content ? <div className="mt-5 divide-y">{drafts.slice(0, 4).map((test) => <div key={test.id} className="flex items-center justify-between gap-3 py-4"><div className="min-w-0"><h3 className="truncate text-sm font-semibold" title={test.name}>{test.name}</h3><p className="mt-1 text-xs text-muted-foreground">{test.exam} · {test.minutes} minutes</p></div><span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">Draft</span></div>)}{drafts.length === 0 && <div className="py-8 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" /><p className="mt-3 text-sm font-semibold">No drafts in the queue</p><p className="mt-1 text-xs text-muted-foreground">Create your next mock test when you are ready.</p></div>}</div> : <p className="py-8 text-sm text-muted-foreground">{loading ? 'Loading your mock tests…' : 'Publishing queue could not be loaded.'}</p>}
        <Button variant="outline" className="mt-4 w-full rounded-xl" onClick={() => onNavigate('tests')}>Manage mock tests <ArrowRight /></Button>
      </section>
      <section className={card}><h2 className="font-bold">Your publishing workflow</h2><p className="mt-1 text-xs text-muted-foreground">Three steps from question to practice.</p><ol className="mt-6 space-y-6">{[
        { title: 'Build the question bank', detail: 'Add topics, questions and explanations.', section: 'questions' as const },
        { title: 'Review the mock test', detail: 'Check sections, timing and release readiness.', section: 'tests' as const },
        { title: 'Publish when ready', detail: 'Activate reviewed content for students.', section: 'tests' as const },
      ].map((step, index) => <li key={step.title} className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-muted/50 text-xs font-bold text-indigo-600 dark:text-indigo-300">{index + 1}</span><div><button type="button" className="text-left text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-indigo-500" onClick={() => onNavigate(step.section)}>{step.title}</button><p className="mt-1 text-xs leading-5 text-muted-foreground">{step.detail}</p></div></li>)}</ol><div className="mt-6 border-t pt-4"><button type="button" onClick={() => onNavigate('practice')} className="flex min-h-10 items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-300"><BookOpen className="h-4 w-4" /> Open practice library <ArrowRight className="h-4 w-4" /></button></div></section>
    </div>

    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 font-bold"><Radio className="h-4 w-4 text-indigo-600 dark:text-indigo-300" /> Government jobs feed</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Source health helps explain missing official notices.</p></div><Link href="/government-jobs" className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-indigo-600 dark:text-indigo-300">View jobs page <ArrowUpRight className="h-4 w-4" /></Link></div>
      {feedError ? <div role="alert" className="mt-4 rounded-xl border border-amber-300 bg-amber-50/60 p-4 text-sm dark:bg-amber-950/20"><p>{feedError}</p><p className="mt-2 text-xs text-muted-foreground">A 404 means Render is missing the jobs route. Deploy the latest main commit, then refresh this overview. Updating Vercel alone does not update the API.</p></div> : !feed ? <p className="mt-4 text-sm text-muted-foreground">Checking the public jobs API…</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2">{feed.sources.map((source) => <div key={source.id} className="rounded-xl border bg-muted/20 p-4"><p className="text-sm font-semibold">{source.name}</p><p className={`mt-1 text-xs font-semibold ${source.status === 'ok' ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>{source.status === 'ok' ? 'Source checked' : source.status === 'stale' ? 'Showing older data' : 'Source unavailable'}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{source.message || `Last successful check: ${checkedAt(source.checkedAt)}`}</p></div>)}</div>}
    </section>
  </div>;
}
