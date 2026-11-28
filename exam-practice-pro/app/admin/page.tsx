/* eslint-disable react-hooks/set-state-in-effect -- authorize the account when the session changes */
'use client';

import { StudyPlanManager } from '@/components/study-plans/manager';
import { MonetizationTab } from '@/components/admin/monetization-tab';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ArrowUpRight, BriefcaseBusiness, ChevronRight, CreditCard, FileQuestion, GraduationCap, LoaderCircle, ShieldCheck, LayoutDashboard, Menu, PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { CommandPalette } from '@/components/ui/command-palette';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { CommandMetrics } from '@/components/admin/command-metrics';
import { QaTab } from '@/components/admin/qa-tab';
import { CashfreeSandboxAudit } from '@/components/admin/cashfree-sandbox-audit';
import { AdminOverview } from '@/components/admin/overview';
import { PlansTab } from '@/components/admin/plans-tab';
import { QuestionsTab } from '@/components/admin/questions-tab';
import { TestsTab } from '@/components/admin/tests-tab';
import { PracticeLibraryTab } from '@/components/admin/practice-library-tab';
import { admin, type AdminSection } from '@/lib/admin';

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, description: 'Your content, publishing queue and service status at a glance.' },
  { id: 'study-plans', label: 'Study Plans', icon: GraduationCap, description: 'Build syllabus-based plans, preview daily tasks and manage publication.' },
  { id: 'monetization', label: 'Monetization, Ads & B2B', icon: CreditCard, description: 'Manage verified payments, sponsors, coaching portals and live events.' },
  { id: 'tests', label: 'Mocks & Tests Manager', icon: GraduationCap, description: 'Review, publish and manage Free and Pro mock tests.' },
  { id: 'questions', label: 'Question Bank', icon: FileQuestion, description: 'Search topics, import questions and maintain the practice library.' },
  { id: 'plans', label: 'User Plans & Manual Grants', icon: CreditCard, description: 'Review access and manage independently verified plan grants.' },
  { id: 'payments', label: 'Cashfree Payment Audit', icon: CreditCard, description: 'Inspect sandbox orders and verified webhook activity.' },
  { id: 'qa', label: 'Beta Learners & QA', icon: ShieldCheck, description: 'Staging invitations, feedback and release readiness.' },
] as const;

type Gate = { state: 'loading' } | { state: 'signin' } | { state: 'denied' } | { state: 'error'; message: string } | { state: 'ok' };

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [gate, setGate] = useState<Gate>({ state: 'loading' });
  const [section, setSection] = useState<AdminSection>('overview');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  useEffect(()=>{const sync=()=>{const s=new URLSearchParams(window.location.search).get('section');setSection(s && (SECTIONS.some(x=>x.id===s)||s==='practice'||s==='catalogue') ? s as AdminSection : 'overview');};sync();window.addEventListener('popstate',sync);return()=>window.removeEventListener('popstate',sync);},[]);
  const [questionTopic,setQuestionTopic]=useState('');
  const [questionMock,setQuestionMock]=useState<string|undefined>();
  const [focusedMock,setFocusedMock]=useState('');
  const [attempt, setAttempt] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const selected = SECTIONS.find((item) => item.id === (section==='practice'?'questions':section==='catalogue'?'tests':section)) ?? {label:'Overview', description:'Your content, publishing queue and service status at a glance.'};
  const account = session?.user?.email;
  const [authorizedAccount, setAuthorizedAccount] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setAuthorizedAccount(null);
    if (status === 'loading') { setGate({ state: 'loading' }); return; }
    if (!account) { setGate({ state: 'signin' }); return; }
    setGate({ state: 'loading' });
    void admin('/me').then((result) => {
      if (cancelled) return;
      if (result.ok) { setAuthorizedAccount(account ?? null); setGate({ state: 'ok' }); }
      else if (result.status === 403 && /not an admin/i.test(result.message)) setGate({ state: 'denied' });
      else if (result.status === 401) setGate({ state: 'signin' });
      else setGate({ state: 'error', message: result.message });
    });
    return () => { cancelled = true; };
  }, [status, account, attempt]);

  const authorized = status === 'authenticated' && !!account && authorizedAccount === account && gate.state === 'ok';
  const navigate = (next: AdminSection,focusMock='') => { if(next==='tests')setFocusedMock(focusMock);setSection(next);setMobileOpen(false);setCreateOpen(false);const url=new URL(window.location.href);url.searchParams.set('section',next);if(url.href!==window.location.href)window.history.pushState(null,'',url); requestAnimationFrame(() => heading.current?.focus()); };

  return (
    <>
      <Header />
      <main className="ep-admin min-w-0 flex-1 bg-background/80 dark:bg-background/40">
        {!authorized ? (
          <div className="mx-auto max-w-xl px-4 py-16 sm:py-24">
            <div className="rounded-3xl border bg-card p-8 shadow-sm">
              <ShieldCheck className="mb-5 h-10 w-10 text-accent-ink dark:text-accent-ink" aria-hidden="true" />
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">ExamPro workspace</p>
              <h1 className="mt-2 text-2xl font-bold">Owner administration</h1>
              {(status === 'loading' || gate.state === 'loading' || gate.state === 'ok') && <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground" role="status"><LoaderCircle className="h-4 w-4 animate-spin" /> Checking your account…</p>}
              {gate.state === 'signin' && <><p className="mt-4 text-sm text-muted-foreground">Sign in with your authorized Google or GitHub account to manage ExamPro.</p><Button className="mt-6 bg-primary text-primary-foreground hover:bg-primary-hover" asChild><Link href="/auth/signin?callbackUrl=/admin">Sign in to workspace</Link></Button></>}
              {gate.state === 'denied' && <div className="mt-5 text-sm" role="alert"><p className="font-semibold">This account does not have admin access.</p><p className="mt-2 break-words text-muted-foreground">Signed in as {account ?? 'a guest'}. Ask the site owner to review access for this account.</p></div>}
              {gate.state === 'error' && <div className="mt-5 text-sm" role="alert"><p className="text-muted-foreground">{gate.message}</p><Button variant="outline" className="mt-4" onClick={() => setAttempt((n) => n + 1)}>Try again</Button></div>}
            </div>
          </div>
        ) : (
          <div className={`mx-auto grid w-full max-w-[1600px] min-w-0 ${collapsed?'lg:grid-cols-[76px_minmax(0,1fr)]':'lg:grid-cols-[240px_minmax(0,1fr)]'}`}>
            <aside className="hidden min-w-0 border-b bg-card lg:block lg:border-b-0 lg:border-r">
              <div className="space-y-6 px-4 py-6 lg:sticky lg:top-20 lg:px-5 lg:py-8">
                <Button variant="ghost" size="icon" aria-label={collapsed?"Expand sidebar":"Collapse sidebar"} aria-expanded={!collapsed} onClick={()=>setCollapsed(v=>!v)}>{collapsed?<PanelLeftOpen/>:<PanelLeftClose/>}</Button><div className={collapsed?"hidden":"px-3"}><p className="text-xs font-bold uppercase tracking-[0.18em] text-accent-ink dark:text-accent-ink">ExamPro</p><p className="mt-1 text-lg font-bold tracking-tight">Command center</p></div>
                <nav aria-label="Admin sections" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
                  {SECTIONS.map((item) => <button key={item.id} type="button" aria-current={(section === item.id || (section==='catalogue'&&item.id==='tests') || (section==='practice'&&item.id==='questions')) ? 'page' : undefined} aria-label={item.label} title={collapsed?item.label:undefined} aria-controls="admin-section" onClick={() => navigate(item.id)} className={`flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${(section === item.id || (section==='catalogue'&&item.id==='tests') || (section==='practice'&&item.id==='questions')) ? 'border-l-2 border-primary bg-accent-soft text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />{!collapsed&&item.label}</button>)}
                </nav>
                <div className={collapsed?"hidden":"space-y-3 border-t px-3 pt-5"}><p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Quick links</p>{process.env.NEXT_PUBLIC_INSTITUTES_ENABLED==='true'&&<Link href="/admin/institutes" className="flex min-h-10 items-center text-sm text-muted-foreground">Institute applications</Link>}<button type="button" className="min-h-10 text-sm font-semibold text-accent-ink" onClick={()=>navigate('overview')}>Workspace overview</button><Link href="/certifications?tab=start-learning" className="flex min-h-10 items-center text-sm text-muted-foreground">Manage ebooks</Link><Link href="/admin/design-system" className="flex min-h-10 items-center text-sm text-muted-foreground">Design system</Link><Link href="/" className="flex min-h-10 items-center justify-between text-sm text-muted-foreground hover:text-accent-ink">View student site <ArrowUpRight className="h-4 w-4" /></Link><Link href="/government-jobs" className="flex min-h-10 items-center justify-between text-sm text-muted-foreground hover:text-accent-ink">Government jobs <BriefcaseBusiness className="h-4 w-4" /></Link></div>
                <div className={collapsed?"hidden":"rounded-2xl border bg-muted/30 p-4"}><ShieldCheck className="h-5 w-5 text-emerald-600" /><p className="mt-2 text-xs font-semibold">Verified administrator</p><p className="mt-1 break-all text-xs text-muted-foreground">{account}</p></div>
              </div>
            </aside>
            <div className="min-w-0 px-4 py-6 sm:px-7 lg:px-8 lg:py-8">
              <div className="mb-5 flex flex-wrap items-center gap-2"><Button variant="outline" className="lg:hidden" onClick={()=>setMobileOpen(true)}><Menu/> Sections</Button><CommandPalette items={SECTIONS.map(item=>({label:item.label,href:`/admin?section=${item.id}`}))} onSelect={href=>{const next=new URL(href,window.location.origin).searchParams.get("section");if(SECTIONS.some(item=>item.id===next))navigate(next as AdminSection);}}/><Button onClick={()=>setCreateOpen(true)}><Plus/> Create</Button></div><Dialog open={mobileOpen} onOpenChange={setMobileOpen}><DialogContent className="top-auto bottom-0 left-0 w-full max-w-none translate-x-0 translate-y-0 rounded-b-none sm:max-w-none"><DialogTitle>Workspace sections</DialogTitle><DialogDescription>Open an existing administration screen.</DialogDescription><nav className="grid max-h-[65vh] gap-2 overflow-auto" aria-label="Mobile admin sections">{SECTIONS.map(item=><Button key={item.id} variant={section===item.id?"default":"ghost"} onClick={()=>navigate(item.id)}>{item.label}</Button>)}</nav><Link href="/certifications?tab=start-learning">Manage ebooks</Link><Link href="/admin/design-system">Design system</Link></DialogContent></Dialog><Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogTitle>Create content</DialogTitle><DialogDescription>Open the existing editor to create a draft.</DialogDescription><Button onClick={()=>navigate("tests")}>Mock test editor</Button><Button onClick={()=>navigate("study-plans")}>Study plan editor</Button><Button onClick={()=>navigate("questions")}>Import questions</Button><Button asChild variant="outline"><Link href="/certifications?tab=start-learning">Existing ebook and PDF studio</Link></Button></DialogContent></Dialog><div className="mb-7 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0"><p className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">Workspace <ChevronRight className="h-3 w-3" /> {selected.label}</p><h1 ref={heading} tabIndex={-1} className="text-3xl font-bold tracking-tight focus:outline-none">{selected.label}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{selected.description}</p></div>
                <Button variant="outline" className="min-h-11 rounded-xl bg-card" asChild><Link href="/exampro">Open exam hall <ArrowUpRight /></Link></Button>
              </div>
              {section==="overview"&&<CommandMetrics onNavigate={navigate}/>}<section id="admin-section" aria-label={selected.label} className="min-w-0">
                {section === 'study-plans' && <StudyPlanManager/>}
                {section === 'monetization' && <MonetizationTab/>}
                {section === 'overview' && <AdminOverview onNavigate={navigate} />}
                {(section === 'questions'||section === 'practice') && <div className="space-y-5"><div className="flex flex-wrap gap-2"><Button variant={section==='questions'?'default':'outline'} onClick={()=>navigate('questions')}>Database question bank</Button><Button variant={section==='practice'?'default':'outline'} onClick={()=>navigate('practice')}>Practice & IT library</Button></div>{section==='questions'?<QuestionsTab initialTopic={questionTopic} mockId={questionMock} onBackToMocks={()=>navigate('tests',questionMock??'')}/>:<PracticeLibraryTab/>}</div>}
                {(section === 'tests'||section==='catalogue') && <TestsTab key={section+focusedMock} initialView={section==='catalogue'?'live':'all'} initialTestId={focusedMock} onEditQuestions={(topic,testId)=>{setQuestionTopic(topic);setQuestionMock(testId);navigate('questions');}} />}
                {section === 'payments' && <CashfreeSandboxAudit/>}{section === 'qa' && <QaTab/>}
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
