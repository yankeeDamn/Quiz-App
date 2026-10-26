'use client';
/* eslint-disable react-hooks/set-state-in-effect -- restoring browser-only branding after mount */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Building2, Check, ChevronRight, Clock3, LayoutDashboard, MessageCircle, Palette, RotateCcw, ShieldCheck, X } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/motion';
import { fetchCatalog, type MockSummary } from '@/lib/mocks';
import { whatsappLink, WHATSAPP_NUMBER } from '@/lib/plans';

type Portal = { name: string; tagline: string; color: string; batches: string; whatsapp: string; group: string; logo: string };
type Role = 'student' | 'teacher' | 'institute';
type CatalogState = 'loading' | 'slow' | 'error' | 'ready';
// Storage key and saved shape are a contract with already-saved browsers. Do not change.
const STORAGE = 'exampro:portal-preview:v1';
const INITIAL: Portal = { name: '', tagline: 'Mock tests for every batch', color: '#1949C7', batches: 'Foundation, Advanced', whatsapp: '', group: '', logo: '' };
const COLORS: { hex: string; label: string }[] = [
  { hex: '#D9480F', label: 'Orange' }, { hex: '#1949C7', label: 'Blue' }, { hex: '#0F766E', label: 'Teal' }, { hex: '#AD2164', label: 'Magenta' },
  { hex: '#6D28D9', label: 'Violet' }, { hex: '#B45309', label: 'Amber' }, { hex: '#15803D', label: 'Green' }, { hex: '#101A33', label: 'Navy' },
];
const PRESETS = [
  { label: 'SSC academy', name: 'SSC Academy', tagline: 'Prepare. Practice. Succeed.', color: '#1949C7', batches: 'SSC CGL, SSC CHSL' },
  { label: 'Bank exam academy', name: 'Bank Exam Academy', tagline: 'Your next selection starts here.', color: '#0F766E', batches: 'Bank PO, Clerk' },
  { label: 'School foundation', name: 'School Foundation', tagline: 'Stronger basics, brighter futures.', color: '#AD2164', batches: 'Class 9, Class 10' },
];
const ROLES: Record<Role, { title: string; detail: string }[]> = {
  student: [
    { title: 'Pick a mock test', detail: 'Browse published India mocks and certification practice.' },
    { title: 'Take your test', detail: 'Answer timed questions with automatic saving and a real server deadline.' },
    { title: 'Review your results', detail: 'Find explanations and saved attempts in your dashboard.' },
  ],
  teacher: [
    { title: 'Sign in as the owner', detail: 'Use the Google or GitHub account that has been given owner access.' },
    { title: 'Create questions', detail: 'Use the admin dashboard or import an original, reviewed question CSV.' },
    { title: 'Publish a mock', detail: 'Preview the draft and publish it to the live catalogue.' },
  ],
  institute: [
    { title: 'Design a preview', detail: 'Try your colours, logo, batches and contact links below.' },
    { title: 'Explore the dashboard', detail: 'Preview the planned institute tools; no private institute data is stored there yet.' },
    { title: 'Request onboarding', detail: 'Contact ExamPro about full institute accounts and batch management.' },
  ],
};
const logoPattern = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
function restore(raw: unknown): Portal {
  if (!raw || typeof raw !== 'object') return INITIAL;
  const x = raw as Record<string, unknown>;
  const str = (k: keyof Portal, max: number): string => typeof x[k] === 'string' ? (x[k] as string).slice(0,max) : INITIAL[k];
  return { name: str('name',40), tagline: str('tagline',60), batches: str('batches',160),
    whatsapp: str('whatsapp',25), group: str('group',250),
    color: typeof x.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(x.color) ? x.color : INITIAL.color,
    logo: typeof x.logo === 'string' && x.logo.length < 750000 && logoPattern.test(x.logo) ? x.logo : '' };
}
/**
 * Turns what an institute typed into a wa.me number.
 *  - empty            -> '' (caller falls back to the ExamPro number)
 *  - recognisable     -> digits with country code
 *  - anything else    -> null (caller shows a warning; we never silently route
 *                        an institute's counsellor button to the platform owner)
 */
function waNumber(value: string): string | null {
  const typed = value.replace(/\D/g, '');
  if (!typed) return '';
  const digits = typed.replace(/^0+/, ''); // "098765 43210" -> 9876543210
  if (digits.length === 10 && /^[6-9]/.test(digits)) return '91' + digits;
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits[2])) return digits;
  if (digits.length >= 11 && digits.length <= 15 && !digits.startsWith('91')) return digits; // other countries
  return null;
}
function groupUrl(value: string): string | null {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && u.hostname === 'chat.whatsapp.com' && /^[A-Za-z0-9/_-]+$/.test(u.pathname) ? u.href : null;
  } catch { return null; }
}
/** Picks white or dark ink, whichever has the higher WCAG contrast on the brand colour. */
function foreground(hex: string): string {
  const lin = (i: number) => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const L = 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5);
  const onWhite = 1.05 / (L + 0.05);
  const onDark = (L + 0.05) / (0.0105 + 0.05); // #101A33 is ~0.0105 luminance
  return onWhite >= onDark ? '#FFFFFF' : '#101A33';
}

const inputBase = 'min-h-11 rounded-lg border border-slate-500 bg-[#172548] px-3 py-2 text-white transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-white';

export default function ExamProStudioPage() {
  const [role, setRole] = useState<Role>('student');
  const [picked, setPicked] = useState<number | null>(null);
  const [portal, setPortal] = useState<Portal>(INITIAL);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState('');
  const [logoError, setLogoError] = useState('');
  const [tests, setTests] = useState<MockSummary[]>([]);
  const [catalog, setCatalog] = useState<CatalogState>('loading');
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    try { const saved = localStorage.getItem(STORAGE); if (saved) setPortal(restore(JSON.parse(saved))); }
    catch { /* Private browsing may disable storage. */ }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORAGE,JSON.stringify(portal)); setNotice('Saved in this browser only.'); }
    catch { setNotice('Browser storage unavailable. Your preview may not persist.'); }
  }, [portal, loaded]);
  useEffect(() => {
    let mounted = true;
    setCatalog('loading');
    // A sleeping API server can take a while to wake up. Say so instead of spinning silently.
    const slow = setTimeout(() => { if (mounted) setCatalog(c => c === 'loading' ? 'slow' : c); }, 8000);
    fetchCatalog()
      .then(data => { if (mounted) { setTests(data); setCatalog('ready'); } })
      .catch(() => { if (mounted) setCatalog('error'); })
      .finally(() => clearTimeout(slow));
    return () => { mounted = false; clearTimeout(slow); };
  }, [attempt]);

  const categories = useMemo(() => ['All',...Array.from(new Set(tests.map(t => t.exam)))], [tests]);
  const shown = useMemo(() => tests.filter(t => filter === 'All' || t.exam === filter).slice(0,6), [tests,filter]);
  const name = portal.name.trim() || 'Your Institute';
  const batches = portal.batches.split(',').map(s=>s.trim()).filter(Boolean).slice(0,6);
  const initials = name.split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,24) || 'institute-preview';
  const group = groupUrl(portal.group);
  const counsellor = waNumber(portal.whatsapp);
  const ink = foreground(portal.color);
  const change = (value: Partial<Portal>) => setPortal(current => ({...current,...value}));
  function logo(file?: File) {
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { setLogoError('Use PNG, JPG or WebP.'); return; }
    if (file.size > 500*1024) { setLogoError('Maximum logo size is 500 KB.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && logoPattern.test(reader.result) && reader.result.length < 750000) {
        change({logo:reader.result}); setLogoError('');
      } else setLogoError('Unable to read this image.');
    };
    reader.onerror = () => setLogoError('Unable to read this image.');
    reader.readAsDataURL(file);
  }
  const retry = () => setAttempt(a => a + 1);

  return <>
    <Header/>
    <main className="studio-scope flex-1 bg-[#f4f6fb] text-[#101a33] dark:bg-slate-950 dark:text-white">
      <div className="z-40 border-b border-slate-200 bg-white/95 py-3 backdrop-blur md:sticky md:top-16 dark:border-slate-800 dark:bg-slate-900/95">
        <nav aria-label="ExamPro feature sections" className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-2 px-4 text-sm font-semibold">
          {[['#how','How to use it'],['#practice','Mock tests'],['#progress','My progress'],['#portal','Portal builder'],['#contact','WhatsApp']].map(([href,label])=>
            <a key={href} href={href} className="rounded transition-colors hover:text-orange-700 dark:hover:text-orange-400">{label}</a>)}
        </nav>
      </div>
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-14 lg:grid-cols-2 lg:items-center lg:py-20">
        <StaggerContainer inView={false} stagger={0.08}>
          <StaggerItem duration={0.4}><p className="font-mono text-xs font-bold uppercase tracking-[.15em] text-orange-700 dark:text-orange-400">Mock tests for everyone</p></StaggerItem>
          <StaggerItem duration={0.45}><h1 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">A little practice.<br/><span className="text-orange-700 dark:text-orange-400">A stronger attempt.</span></h1></StaggerItem>
          <StaggerItem duration={0.45}><p className="mt-5 max-w-xl text-lg text-slate-600 dark:text-slate-300">Practice for India&apos;s exams, learn from explanations, and preview a branded portal for your coaching institute.</p></StaggerItem>
          <StaggerItem duration={0.45}><div className="mt-7 flex flex-wrap gap-3">
            <Link href="/india-mocks" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-orange-700 px-5 py-3 font-bold text-white shadow-sm transition-[transform,background-color,box-shadow] duration-150 hover:-translate-y-0.5 hover:bg-orange-800 hover:shadow-md active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0">Explore mock tests <ChevronRight size={18}/></Link>
            <a href="#portal" className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-900 transition-[transform,background-color,box-shadow] duration-150 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-md active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0">Try portal builder</a>
          </div></StaggerItem>
          <StaggerItem duration={0.45}><p className="mt-5 text-sm text-slate-600 dark:text-slate-400">Timed tests, automatic saving and server-checked scoring.</p></StaggerItem>
        </StaggerContainer>
        <FadeIn delay={0.2} duration={0.5} className="rounded-2xl border-2 border-slate-900 bg-white p-6 shadow-lg dark:border-slate-700 dark:bg-slate-900">
          <div className="flex justify-between gap-2 font-mono text-xs font-bold uppercase text-slate-600 dark:text-slate-400"><span>Sample OMR question</span><span>+4 / −1</span></div>
          <p className="mt-5 text-lg font-semibold">A shirt priced at ₹800 is sold at 25% off. What is the sale price?</p>
          <div className="mt-5 grid gap-3">{['₹500','₹600','₹650','₹700'].map((value,i)=>{
            const isRight = picked!==null && i===1, isWrong = picked===i && i!==1;
            return <button key={value} type="button" disabled={picked!==null} onClick={()=>setPicked(i)}
              className={'flex min-h-12 items-center gap-3 rounded-xl border p-3 text-left transition-[border-color,background-color,transform] duration-200 motion-reduce:transition-none ' +
                (isRight ? 'border-green-600 bg-green-50 text-green-950 motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-200'
                  : isWrong ? 'border-red-600 bg-red-50 text-red-950 motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-200'
                  : 'border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white ' + (picked===null ? 'hover:-translate-y-0.5 hover:border-orange-500 motion-reduce:hover:translate-y-0' : 'opacity-70'))}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-current font-mono text-sm font-bold">{'ABCD'[i]}</span>
              <span className="flex-1">{value}</span>
              {isRight && <Check size={18} aria-hidden className="shrink-0 text-green-700"/>}
              {isWrong && <X size={18} aria-hidden className="shrink-0 text-red-700"/>}
            </button>;})}
          </div>
          <p className="mt-4 min-h-12 text-sm" aria-live="polite">
            <span key={String(picked)} className="block motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300">
              {picked===null ? 'Select an option to see an explanation.' : (picked===1 ? 'Correct. ' : 'Not quite. ')+'25% of ₹800 is ₹200, so the sale price is ₹600. This sample does not affect exam scores.'}
            </span>
          </p>
          {picked!==null && <button type="button" onClick={()=>setPicked(null)} className="mt-2 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"><RotateCcw size={15}/> Try again</button>}
        </FadeIn>
      </section>

      <section id="how" className="scroll-mt-24 bg-[#101a33] py-16 text-white md:scroll-mt-32">
        <div className="mx-auto max-w-6xl px-4">
          <FadeIn inView>
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-orange-400">How to use it</p>
            <h2 className="mt-3 text-3xl font-extrabold">Pick your role and see the first steps.</h2>
          </FadeIn>
          <div role="group" aria-label="Role" className="mt-7 flex flex-wrap gap-2">{([['student','Student'],['teacher','Teacher / owner'],['institute','Coaching institute']] as const).map(([id,label])=>
            <button key={id} type="button" aria-pressed={role===id} onClick={()=>setRole(id)}
              className={'rounded-lg border px-4 py-3 font-semibold transition-colors duration-200 motion-reduce:transition-none ' + (role===id ? 'border-white bg-white text-slate-900' : 'border-slate-500 hover:border-white hover:bg-white/10')}>{label}</button>)}
          </div>
          {/* Keyed only on the (static) step cards, so switching roles replays a short entrance. No form state lives here. */}
          <div key={role} className="mt-8 grid gap-4 md:grid-cols-3">{ROLES[role].map((step,i)=>
            <article key={step.title} style={{animationDelay:`${i*70}ms`, animationFillMode:'backwards'}}
              className="rounded-xl border border-slate-700 bg-[#172548] p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
              <span className="grid h-10 w-10 place-items-center rounded-full border border-orange-400 font-mono text-orange-300">{i+1}</span>
              <h3 className="mt-4 text-lg font-bold">{step.title}</h3><p className="mt-2 text-slate-300">{step.detail}</p>
            </article>)}
          </div>
          <Link href={role==='student'?'/india-mocks':role==='teacher'?'/admin':'/institutes'} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-orange-700 px-5 py-3 font-bold text-white transition-[transform,background-color,box-shadow] duration-150 hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-md active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
            {role==='student'?'Start practicing':role==='teacher'?'Owner admin':'Institute overview'} <ChevronRight size={16}/>
          </Link>
        </div>
      </section>

      <section id="practice" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 md:scroll-mt-32">
        <FadeIn inView>
          <p className="font-mono text-xs font-bold uppercase text-orange-700 dark:text-orange-400">Practice library</p>
          <h2 className="mt-3 text-3xl font-extrabold">Take a real mock test.</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-300">Live, timed mocks from the ExamPro catalogue. Pick one to start.</p>
        </FadeIn>
        {catalog !== 'ready' ? (
          <div className="mt-6" role="status" aria-busy={catalog==='loading'||catalog==='slow'}>
            {catalog === 'error' ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
                <p className="flex-1 text-sm">Could not load the published mocks. You can still browse the full catalogue.</p>
                <button type="button" onClick={retry} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"><RotateCcw size={15}/> Retry</button>
              </div>
            ) : <>
              <p className="text-sm text-slate-600 dark:text-slate-300">{catalog === 'slow' ? 'The server is waking up and this can take up to a minute. Hang tight, or open the full catalogue below.' : 'Loading live tests…'}</p>
              <div aria-hidden className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[0,1,2].map(i=><div key={i} className="h-40 rounded-xl border border-slate-200 bg-white/70 motion-safe:animate-pulse dark:border-slate-700 dark:bg-slate-900/70"/>)}</div>
            </>}
          </div>
        ) : <>
          <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter exams">{categories.map(c=>
            <button key={c} type="button" aria-pressed={filter===c} onClick={()=>setFilter(c)}
              className={'rounded-full border px-4 py-2 text-sm font-semibold transition-colors duration-200 motion-reduce:transition-none ' + (filter===c?'border-slate-900 bg-slate-900 text-white dark:bg-white dark:text-slate-900':'border-slate-300 bg-white text-slate-900 hover:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:border-white')}>{c}</button>)}
          </div>
          <StaggerContainer stagger={0.06} className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{shown.map(t=>
            <StaggerItem key={t.id} className="h-full">
              <article className="flex h-full flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 text-slate-900 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-orange-300 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                <div className="flex justify-between gap-2"><h3 className="font-bold">{t.name}</h3><span className={'h-fit rounded px-2 py-1 text-xs font-semibold ' + (t.tier==='free'?'bg-emerald-100 text-emerald-900':'bg-amber-100 text-amber-900')}>{t.tier==='free'?'Free':'Pro'}</span></div>
                <p className="text-sm text-slate-600 dark:text-slate-300">{t.exam} · {t.questionCount} questions · {t.minutes} min</p>
                <p className="text-xs text-slate-600 dark:text-slate-300">{t.sections.join(' · ')}</p>
                <Link href={'/india-mocks/'+encodeURIComponent(t.id)} className="mt-auto inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-900 px-4 py-2 font-bold text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">Open test</Link>
              </article>
            </StaggerItem>)}
          </StaggerContainer>
          {!shown.length && <p className="mt-6">No active mocks in this category.</p>}
        </>}
        <div className="mt-7 flex flex-wrap gap-3">{[['/india-mocks','All mock tests'],['/certifications','IT certifications'],['/bookmarks','Saved questions']].map(([href,label])=>
          <Link key={href} href={href} className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-900 transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0">{label}</Link>)}</div>
      </section>

      <section id="progress" aria-labelledby="progress-heading" className="scroll-mt-24 border-y border-slate-200 bg-white py-14 text-slate-900 md:scroll-mt-32 dark:border-slate-800 dark:bg-slate-900 dark:text-white">
        <h2 id="progress-heading" className="sr-only">More ways to use ExamPro</h2>
        <StaggerContainer className="mx-auto grid max-w-6xl gap-5 px-4 md:grid-cols-3">
          {[
            { icon: Clock3, name: 'Timed exam practice', text: 'Automatic saving, timing and server scoring.', url: '/india-mocks' },
            { icon: LayoutDashboard, name: 'My practice progress', text: 'View scores, attempt history and explanations.', url: '/dashboard' },
            { icon: ShieldCheck, name: 'Owner question publishing', text: 'Create questions and publish reviewed tests.', url: '/admin' },
          ].map(item=><StaggerItem key={item.name} className="h-full"><Link href={item.url} className="group block h-full rounded-xl border border-slate-200 p-6 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-orange-400 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-slate-700">
            <item.icon className="h-7 w-7 text-orange-600"/><h3 className="mt-4 text-lg font-bold">{item.name}</h3><p className="mt-2 text-slate-600 dark:text-slate-300">{item.text}</p><span className="mt-4 inline-flex items-center gap-1 font-semibold text-orange-700 dark:text-orange-400">Open feature <ChevronRight size={16} className="transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"/></span>
          </Link></StaggerItem>)}
        </StaggerContainer>
      </section>

      <section id="portal" className="scroll-mt-24 bg-[#101a33] py-16 text-white md:scroll-mt-32">
        <div className="mx-auto max-w-6xl px-4">
          <FadeIn inView>
            <p className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-orange-400"><Palette size={15}/> Portal builder</p>
            <h2 className="mt-3 text-3xl font-extrabold">Make it yours in a minute.</h2>
            <p className="mt-3 max-w-3xl text-slate-300">Preview your institute&apos;s name, logo, colours and batches. This is a local preview in your browser, not a published institute account.</p>
          </FadeIn>
          <div className="mt-10 grid gap-8 lg:grid-cols-[.9fr_1.1fr]">
            <form className="grid content-start gap-4" onSubmit={e=>e.preventDefault()}>
              <div><p className="text-sm font-semibold">Start from a sample</p><div className="mt-2 flex flex-wrap gap-2">{PRESETS.map(p=>
                <button key={p.label} type="button" onClick={()=>{change({name:p.name,tagline:p.tagline,color:p.color,batches:p.batches,logo:''});setLogoError('');}} className="rounded-full border border-slate-500 px-4 py-2 text-sm font-semibold transition-colors hover:border-white hover:bg-white/10">{p.label}</button>)}</div></div>
              <label className="grid gap-1 text-sm font-semibold">Institute name<input maxLength={40} autoComplete="off" value={portal.name} onChange={e=>change({name:e.target.value})} placeholder="Your Institute" className={inputBase} /></label>
              <label className="grid gap-1 text-sm font-semibold">Tagline<input maxLength={60} autoComplete="off" value={portal.tagline} onChange={e=>change({tagline:e.target.value})} className={inputBase} /></label>
              <div><p className="text-sm font-semibold">Brand colour</p><div className="mt-3 flex flex-wrap items-center gap-3">{COLORS.map(c=>
                <button key={c.hex} type="button" aria-label={c.label} title={c.label} aria-pressed={portal.color.toLowerCase()===c.hex.toLowerCase()} onClick={()=>change({color:c.hex})} style={{background:c.hex}}
                  className={'h-10 w-10 rounded-full border-2 border-white transition-transform duration-150 hover:scale-110 motion-reduce:transition-none motion-reduce:hover:scale-100 '+(portal.color.toLowerCase()===c.hex.toLowerCase()?'outline outline-2 outline-offset-2 outline-white':'')}/>)}
                <label className="inline-flex items-center gap-2 text-sm font-normal text-slate-300">
                  <input type="color" aria-label="Custom brand colour" value={portal.color.toLowerCase()} onChange={e=>change({color:e.target.value.toUpperCase()})} className="h-10 w-10 cursor-pointer rounded-full border-2 border-white bg-transparent p-0"/>
                  <span>Custom <span className="font-mono">{portal.color.toUpperCase()}</span></span>
                </label></div></div>
              <label className="grid gap-2 text-sm font-semibold">Logo <span className="font-normal text-slate-300">PNG, JPG or WebP · maximum 500 KB</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{logo(e.target.files?.[0]);e.target.value='';}} className="w-full rounded-lg border border-slate-500 bg-[#172548] p-2 text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:font-semibold file:text-slate-900 hover:border-slate-300"/>
              </label>
              {logoError && <p className="text-sm text-red-300" role="alert">{logoError}</p>}
              {portal.logo && <button type="button" className="justify-self-start text-sm underline" onClick={()=>change({logo:''})}>Remove logo</button>}
              <label className="grid gap-1 text-sm font-semibold">Batches (comma separated)<input maxLength={160} autoComplete="off" value={portal.batches} onChange={e=>change({batches:e.target.value})} className={inputBase}/></label>
              <label className="grid gap-1 text-sm font-semibold">Counsellor WhatsApp number<input type="tel" inputMode="tel" autoComplete="off" maxLength={25} value={portal.whatsapp} onChange={e=>change({whatsapp:e.target.value})} placeholder="Indian 10-digit number" aria-invalid={counsellor===null} aria-describedby={counsellor===null?'wa-help':undefined} className={inputBase}/></label>
              {counsellor===null && <p id="wa-help" className="text-sm text-amber-300">Enter a 10-digit Indian mobile number (or include the country code). Until then the preview button stays disabled.</p>}
              {counsellor==='' && <p className="-mt-2 text-xs text-slate-300">Left blank, the preview button opens ExamPro&apos;s own WhatsApp.</p>}
              <label className="grid gap-1 text-sm font-semibold">Discussion WhatsApp group link<input type="url" autoComplete="off" maxLength={250} value={portal.group} onChange={e=>change({group:e.target.value})} placeholder="https://chat.whatsapp.com/..." className={inputBase}/></label>
              {portal.group && !group && <p className="text-sm text-amber-300">Enter a valid https://chat.whatsapp.com invite URL.</p>}
              <p className="text-sm text-slate-300" role="status">{notice || 'Changes stay in this browser and are not uploaded.'}</p>
              <button type="button" onClick={()=>{setPortal(INITIAL);setLogoError('');}} className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-500 px-4 py-2 text-sm font-semibold transition-colors hover:border-white hover:bg-white/10"><RotateCcw size={16}/> Reset preview</button>
            </form>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xl lg:sticky lg:top-40 lg:self-start">
              <div className="flex gap-1 border-b border-slate-200 bg-slate-100 px-4 py-3"><span className="h-2 w-2 rounded-full bg-slate-400"/><span className="h-2 w-2 rounded-full bg-slate-400"/><span className="h-2 w-2 rounded-full bg-slate-400"/><span className="ml-3 truncate font-mono text-xs text-slate-600">{slug}.exampro.example</span></div>
              <div className="flex items-center gap-4 p-5 transition-colors duration-300 motion-reduce:transition-none" style={{background:portal.color,color:ink}}>
                {portal.logo ? <img src={portal.logo} alt="Preview of institute logo" className="h-14 w-14 rounded-xl bg-white object-contain"/> : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-white text-xl font-black" style={{color:portal.color}}>{initials}</span>}
                <div className="min-w-0"><h3 className="break-words text-xl font-extrabold">{name}</h3><p className="mt-1 text-sm">{portal.tagline}</p></div>
              </div>
              <div className="grid gap-5 p-5">
                <div><h4 className="font-mono text-xs font-bold uppercase text-slate-600">Batches</h4><div className="mt-2 flex flex-wrap gap-2">{(batches.length?batches:['Add a batch']).map((b,i)=><span key={i} className="rounded-full bg-slate-100 px-3 py-2 text-sm">{b}</span>)}</div></div>
                <div><h4 className="font-mono text-xs font-bold uppercase text-slate-600">Live mock tests</h4>
                  {tests.slice(0,3).map(t=><div key={t.id} className="flex items-center justify-between gap-3 border-t border-slate-200 py-3">
                    <div><p className="font-semibold">{t.name}</p><p className="text-xs text-slate-600">{t.questionCount} questions · {t.minutes} min</p></div>
                    <Link href={'/india-mocks/'+encodeURIComponent(t.id)} style={{background:portal.color,color:ink}} className="shrink-0 rounded-lg px-3 py-2 text-sm font-bold transition-colors duration-300 hover:opacity-90 motion-reduce:transition-none">View</Link>
                  </div>)}
                  {!tests.length && <p className="mt-3 text-sm text-slate-600">{catalog==='error' ? 'Live tests could not be loaded right now.' : catalog==='ready' ? 'No live tests are published yet.' : 'Loading live tests…'}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {counsellor===null
                    ? <span aria-disabled="true" className="inline-flex min-h-10 cursor-not-allowed items-center gap-2 rounded-lg bg-slate-200 px-4 py-2 text-sm font-bold text-slate-600"><MessageCircle size={16}/> Talk to counsellor</span>
                    : <a href={whatsappLink('Hi, I want to know about batches at '+name,counsellor||WHATSAPP_NUMBER)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-emerald-800"><MessageCircle size={16}/> Talk to counsellor</a>}
                  {group && <a href={group} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold transition-colors hover:bg-slate-50">Join group</a>}
                </div>
                <p className="border-t border-slate-200 pt-3 text-xs text-slate-600">Design preview only. No institute account, student access or branded exam is created.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="mx-auto grid max-w-6xl scroll-mt-24 gap-8 px-4 py-16 md:grid-cols-2 md:scroll-mt-32">
        <FadeIn inView><p className="font-mono text-xs font-bold uppercase text-orange-700 dark:text-orange-400">WhatsApp, built in</p><h2 className="mt-3 text-3xl font-extrabold">Get guidance where you already chat.</h2><p className="mt-3 text-slate-600 dark:text-slate-300">Choose a topic below. WhatsApp opens with a suggested message; nothing is sent automatically.</p></FadeIn>
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">{[
          ['Coaching enquiry','Hi, I want to know more about ExamPro coaching.'],
          ['Branded institute portal','Hi, I want to discuss a branded institute portal on ExamPro.'],
          ['Question doubt','Hi, I need help understanding a question in my ExamPro mock.'],
        ].map(([label,message])=><a key={label} href={whatsappLink(message)} target="_blank" rel="noopener noreferrer" className="group flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 font-semibold transition-colors hover:border-emerald-600 hover:bg-emerald-50 dark:border-slate-700 dark:hover:bg-emerald-950/30"><span className="flex items-center gap-3"><MessageCircle size={18} className="text-emerald-700 dark:text-emerald-400"/>{label}</span><ChevronRight size={17} className="transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"/></a>)}</div>
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-16"><div className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start gap-3"><Building2 className="mt-1 text-orange-600"/><div><h2 className="text-lg font-bold">Institute accounts are the next milestone.</h2><p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">Student batches, tenant-specific results, shared branding and billing are not enabled yet. The existing owner-admin exam tools remain available.</p></div></div>
        <div className="flex flex-wrap gap-2"><Link href="/institute-admin" className="rounded-lg border px-4 py-3 font-semibold transition-colors hover:bg-slate-50 dark:hover:bg-slate-800">Institute preview</Link><Link href="/admin" className="rounded-lg bg-orange-700 px-4 py-3 font-bold text-white transition-colors hover:bg-orange-800">Owner admin</Link></div>
      </div></section>
    </main>
    <Footer/>
  </>;
}
