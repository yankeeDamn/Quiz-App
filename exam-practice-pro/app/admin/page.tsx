/* eslint-disable react-hooks/set-state-in-effect -- authorize the account when the session changes */
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ArrowUpRight, BookOpen, BriefcaseBusiness, ChevronRight, CreditCard, FileQuestion, GraduationCap, LayoutDashboard, LoaderCircle, ShieldCheck } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { AdminOverview } from '@/components/admin/overview';
import { PlansTab } from '@/components/admin/plans-tab';
import { QuestionsTab } from '@/components/admin/questions-tab';
import { TestsTab } from '@/components/admin/tests-tab';
import { PracticeLibraryTab } from '@/components/admin/practice-library-tab';
import { admin, type AdminSection } from '@/lib/admin';

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, description: 'Your content, publishing queue and service status at a glance.' },
  { id: 'questions', label: 'Question bank', icon: FileQuestion, description: 'Create topics, import questions and refine explanations.' },
  { id: 'tests', label: 'Mock tests', icon: GraduationCap, description: 'Build exams, review questions and manage publication.' },
  { id: 'practice', label: 'Practice library', icon: BookOpen, description: 'Manage free quizzes and IT certification practice.' },
  { id: 'plans', label: 'Plans & payments', icon: CreditCard, description: 'Review access, payment records and Pro plan grants.' },
] as const;

type Gate = { state: 'loading' } | { state: 'signin' } | { state: 'denied' } | { state: 'error'; message: string } | { state: 'ok' };

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [gate, setGate] = useState<Gate>({ state: 'loading' });
  const [section, setSection] = useState<AdminSection>('overview');
  const [attempt, setAttempt] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const selected = SECTIONS.find((item) => item.id === section)!;
  const account = session?.user?.email;
  const [authorizedAccount, setAuthorizedAccount] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setAuthorizedAccount(null);
    if (status === 'loading') { setGate({ state: 'loading' }); return; }
    if (!session?.user) { setGate({ state: 'signin' }); return; }
    setGate({ state: 'loading' });
    void admin('/me').then((result) => {
      if (cancelled) return;
      if (result.ok) { setAuthorizedAccount(account ?? null); setGate({ state: 'ok' }); }
      else if (result.status === 403 && /not an admin/i.test(result.message)) setGate({ state: 'denied' });
      else if (result.status === 401) setGate({ state: 'signin' });
      else setGate({ state: 'error', message: result.message });
    });
    return () => { cancelled = true; };
  }, [status, session?.user, account, attempt]);

  const authorized = status === 'authenticated' && !!account && authorizedAccount === account && gate.state === 'ok';
  const navigate = (next: AdminSection) => { setSection(next); requestAnimationFrame(() => heading.current?.focus()); };

  return (
    <>
      <Header />
      <main className="ep-admin min-w-0 flex-1 bg-slate-50/80 dark:bg-slate-950/40">
        {!authorized ? (
          <div className="mx-auto max-w-xl px-4 py-16 sm:py-24">
            <div className="rounded-3xl border bg-card p-8 shadow-sm">
              <ShieldCheck className="mb-5 h-10 w-10 text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">ExamPro workspace</p>
              <h1 className="mt-2 text-2xl font-bold">Owner administration</h1>
              {(status === 'loading' || gate.state === 'loading' || gate.state === 'ok') && <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground" role="status"><LoaderCircle className="h-4 w-4 animate-spin" /> Checking your account…</p>}
              {gate.state === 'signin' && <><p className="mt-4 text-sm text-muted-foreground">Sign in with your authorized Google or GitHub account to manage ExamPro.</p><Button className="mt-6 bg-indigo-600 text-white hover:bg-indigo-700" asChild><Link href="/auth/signin?callbackUrl=/admin">Sign in to workspace</Link></Button></>}
              {gate.state === 'denied' && <div className="mt-5 text-sm" role="alert"><p className="font-semibold">This account does not have admin access.</p><p className="mt-2 break-words text-muted-foreground">Signed in as {account ?? 'a guest'}. Ask the site owner to review access for this account.</p></div>}
              {gate.state === 'error' && <div className="mt-5 text-sm" role="alert"><p className="text-muted-foreground">{gate.message}</p><Button variant="outline" className="mt-4" onClick={() => setAttempt((n) => n + 1)}>Try again</Button></div>}
            </div>
          </div>
        ) : (
          <div className="mx-auto grid w-full max-w-[1600px] min-w-0 lg:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="min-w-0 border-b bg-card lg:border-b-0 lg:border-r">
              <div className="space-y-6 px-4 py-6 lg:sticky lg:top-20 lg:px-5 lg:py-8">
                <div className="hidden px-3 lg:block"><p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">ExamPro</p><p className="mt-1 text-lg font-bold tracking-tight">Admin workspace</p></div>
                <nav aria-label="Admin sections" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
                  {SECTIONS.map((item) => <button key={item.id} type="button" aria-current={section === item.id ? 'page' : undefined} aria-controls="admin-section" onClick={() => navigate(item.id)} className={`flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ${section === item.id ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />{item.label}</button>)}
                </nav>
                <div className="hidden space-y-3 border-t px-3 pt-5 lg:block"><p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Quick links</p><Link href="/" className="flex min-h-10 items-center justify-between text-sm text-muted-foreground hover:text-indigo-600">View student site <ArrowUpRight className="h-4 w-4" /></Link><Link href="/government-jobs" className="flex min-h-10 items-center justify-between text-sm text-muted-foreground hover:text-indigo-600">Government jobs <BriefcaseBusiness className="h-4 w-4" /></Link></div>
                <div className="hidden rounded-2xl border bg-muted/30 p-4 lg:block"><ShieldCheck className="h-5 w-5 text-emerald-600" /><p className="mt-2 text-xs font-semibold">Verified administrator</p><p className="mt-1 break-all text-xs text-muted-foreground">{account}</p></div>
              </div>
            </aside>
            <div className="min-w-0 px-4 py-6 sm:px-7 lg:px-8 lg:py-8">
              <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0"><p className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">Workspace <ChevronRight className="h-3 w-3" /> {selected.label}</p><h1 ref={heading} tabIndex={-1} className="text-3xl font-bold tracking-tight focus:outline-none">{selected.label}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{selected.description}</p></div>
                <Button variant="outline" className="min-h-11 rounded-xl bg-card" asChild><Link href="/exampro">Open exam hall <ArrowUpRight /></Link></Button>
              </div>
              <section id="admin-section" aria-label={selected.label} className="min-w-0">
                {section === 'overview' && <AdminOverview onNavigate={navigate} />}
                {section === 'questions' && <QuestionsTab />}
                {section === 'tests' && <TestsTab />}
                {section === 'practice' && <PracticeLibraryTab />}
                {section === 'plans' && <PlansTab />}
              </section>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
