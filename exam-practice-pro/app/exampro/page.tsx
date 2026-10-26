'use client';
/* eslint-disable react-hooks/set-state-in-effect -- restoring browser-only branding after mount */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Reveal } from '@/components/motion/reveal';
import { BookOpen, Building2, ChevronRight, Clock3, LayoutDashboard, MessageCircle, Palette, RotateCcw, ShieldCheck } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { fetchCatalog, type MockSummary } from '@/lib/mocks';
import { api } from '@/lib/api';
import { useExamLanguage } from '@/components/exampro/exam-language';
import { ShareTestButtons, validShareTestId } from '@/components/exampro/share-test-buttons';
import { copyUrl } from '@/lib/mobile-share';
import { whatsappLink, WHATSAPP_NUMBER } from '@/lib/plans';

type Portal = { name: string; tagline: string; color: string; batches: string; whatsapp: string; group: string; logo: string };
type Role = 'student' | 'teacher' | 'institute';
type CompetitiveTopic = {id:string;name:string;category:string;active:boolean;questionCount:number;practiceTestId:string|null};
type TopicAccuracy = {topicId:string;attempted:number;correct:number;percent:number};
const STORAGE = 'exampro:portal-preview:v1';
const INITIAL: Portal = { name: '', tagline: 'Mock tests for every batch', color: '#1949C7', batches: 'Foundation, Advanced', whatsapp: '', group: '', logo: '' };
const COLORS = ['#D9480F', '#1949C7', '#0F766E', '#AD2164', '#6D28D9', '#B45309', '#15803D', '#101A33'];
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
    { title: 'Sign in as the owner', detail: 'A verified OAuth account listed in ADMIN_EMAILS is required.' },
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
function waNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.length === 10 && /^[6-9]/.test(digits) ? '91' + digits :
    digits.length >= 11 && digits.length <= 15 ? digits : WHATSAPP_NUMBER;
}
function groupUrl(value: string): string | null {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && u.hostname === 'chat.whatsapp.com' && /^[A-Za-z0-9/_-]+$/.test(u.pathname) ? u.href : null;
  } catch { return null; }
}
function foreground(hex: string): string {
  const rgb = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16));
  return (rgb[0]*299 + rgb[1]*587 + rgb[2]*114)/1000 > 170 ? '#101A33' : '#FFFFFF';
}

export default function ExamProStudioPage() {
  const [role, setRole] = useState<Role>('student');
  const [picked, setPicked] = useState<number | null>(null);
  const [portal, setPortal] = useState<Portal>(INITIAL);
  const [loaded, setLoaded] = useState(false);
  const [notice, setNotice] = useState('');
  const [logoError, setLogoError] = useState('');
  const [tests, setTests] = useState<MockSummary[]>([]);
  const [catalogStatus, setCatalogStatus] = useState('Loading live tests…');
  const [filter, setFilter] = useState('All');
  const [competitive, setCompetitive] = useState<CompetitiveTopic[]>([]);
  const [accuracy, setAccuracy] = useState<Record<string,TopicAccuracy>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [sharedError, setSharedError] = useState('');
  const [portalCopied,setPortalCopied] = useState(false);
  const [portalShareLink,setPortalShareLink] = useState('');
  const {language,t} = useExamLanguage();

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const shared = params.has('institute') ? null : params.get('brand');
      const saved = shared ? shared.slice(0,800) : localStorage.getItem(STORAGE);
      if(saved) setPortal(restore(JSON.parse(saved)));
    } catch { /* Invalid shared previews or blocked storage fall back safely. */ }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORAGE,JSON.stringify(portal)); setNotice('Branding updated. Open or share the public portal using the buttons below.'); }
    catch { setNotice('Your device blocked saving editor preferences. Open or share the public portal before leaving.'); }
  }, [portal, loaded]);
  useEffect(() => {
    let mounted = true;
    api<{topics:CompetitiveTopic[]}>('/api/v1/exampro/competitive-topics',{public:true})
      .then(result=>{ if(mounted && result.success && result.data)setCompetitive(result.data.topics); })
      .catch(()=>{ /* Older APIs do not have the metadata route. */ });
    api<{topics:TopicAccuracy[]}>('/api/v1/exampro/topic-accuracy',{optionalAuth:true})
      .then(result=>{if(mounted&&result.success&&result.data){
        setAccuracy(Object.fromEntries(result.data.topics.map(topic=>[topic.topicId,topic])));
      }}).catch(()=>{ /* Guests do not have personal scored accuracy. */ });
    fetchCatalog().then(data => { if (mounted) { setTests(data); setCatalogStatus(''); } })
      .catch(() => { if (mounted) setCatalogStatus('Could not load published mocks. The catalogue link is still available.'); });
    return () => { mounted = false; };
  }, []);

  // Historic and shareable /exampro?institute=<slug> links open the real
  // public practice portal. This is not a private institute login.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('institute');
    if (!slug) return;
    if (!/^[a-z0-9][a-z0-9-]{0,47}$/.test(slug)) {
      setSharedError('Invalid institute link. Please open a published ExamPro mock instead.');
      return;
    }
    const next = new URL('/exampro/portal', window.location.origin);
    next.searchParams.set('institute', slug);
    const brand = params.get('brand');
    if (brand && brand.length <= 800) next.searchParams.set('brand', brand);
    window.location.replace(next.pathname + next.search);
  }, []);

  // A legacy ?test= link is only resolved after the public catalog confirms publication.
  // The actual server-timed exam is started by the student on /india-mocks/:id.
  useEffect(() => {
    if(catalogStatus)return;
    const testId = new URLSearchParams(window.location.search).get('test');
    if(!testId)return;
    if(!validShareTestId(testId)||!tests.some(test=>test.id===testId)) {
      setSharedError('This shared test is not published or its link is invalid.');
      return;
    }
    window.location.replace('/india-mocks/'+encodeURIComponent(testId)+
      (language!=='en'?'?lang='+language:''));
  },[catalogStatus,tests,language]);

  const categories = useMemo(() => ['All',...Array.from(new Set(tests.map(t => t.exam)))], [tests]);
  const shown = useMemo(() => tests.filter(t => filter === 'All' || t.exam === filter), [tests,filter]);
  const name = portal.name.trim() || 'Your Institute';
  const batches = portal.batches.split(',').map(s=>s.trim()).filter(Boolean).slice(0,6);
  const initials = name.split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase();
  const group = groupUrl(portal.group);
  const ink = foreground(portal.color);
  const change = (value: Partial<Portal>) => setPortal(current => ({...current,...value}));
  // Share only public colour/name/tagline/batch labels. No uploaded logo,
  // counsellor phone, invite links, or private institute data go in the URL.
  const publicBrand = JSON.stringify({
    name:portal.name,tagline:portal.tagline,color:portal.color,batches:portal.batches,
  });
  const portalSlug=(portal.name.trim()||'institute').toLowerCase().normalize('NFKD')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'institute';
  // /exampro?institute=... links resolve to /exampro/portal and include only
  // explicitly public branding; a slug does not create a database tenant.
  const publicPortalPath = '/exampro?institute='+encodeURIComponent(portalSlug)+'&brand='+encodeURIComponent(publicBrand);
  async function copyBrandedPortal(){
    const url = new URL(publicPortalPath,window.location.origin).href;
    setPortalShareLink(url);
    const copied = await copyUrl(url);
    setPortalCopied(copied);
    setNotice(copied
      ? 'Public practice portal link copied. The recipient can open the live test catalogue.'
      : 'Copy is restricted by your browser. Long-press and copy the link below.');
  }
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

  return <>
    <Header/>
    <main className="flex-1 bg-[#f4f6fb] text-[#101a33] dark:bg-slate-950 dark:text-white">
      <div className="border-b border-slate-200 bg-white py-3 dark:border-slate-800 dark:bg-slate-900">
        <nav aria-label="ExamPro feature sections" className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-2 px-4 text-sm font-semibold">
          <a href="#how">How to use it</a><a href="#practice">Mock tests</a><a href="#builder">Competitive builder</a><a href="#progress">My progress</a><a href="#portal">Portal builder</a><a href="#contact">WhatsApp</a><Link href="/status" className="text-indigo-700 underline dark:text-indigo-300">Check API status</Link>
        </nav>
      </div>
      <section className="ep-hero relative mx-auto grid max-w-6xl gap-10 overflow-hidden rounded-b-3xl px-4 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
        <Reveal className="relative">
          <p className="ep-eyebrow">Mock tests for everyone</p>
          <h1 className="mt-5 text-4xl font-black leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">A little practice.<br/><span className="text-orange-700 dark:text-orange-400">A stronger attempt.</span></h1>
          <p className="mt-5 max-w-xl text-lg text-slate-600 dark:text-slate-300">Practice for India&apos;s exams, learn from explanations and try the original Exampro-inspired institute portal builder—all inside your unified ExamPro.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/india-mocks" className="ep-link-motion inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-700 px-6 py-3 font-bold text-white shadow-lg shadow-indigo-700/20 hover:bg-indigo-600">Explore mock tests <ChevronRight size={18}/></Link>
            <a href="#portal" className="ep-link-motion inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-900 shadow-sm hover:border-indigo-400">Try portal builder</a>
          </div>
          <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">Exam submissions and results continue to use Render and Neon.</p>
        </Reveal>
        <div className="ep-preview-surface relative rounded-3xl border border-indigo-200 bg-white p-6 shadow-xl dark:border-indigo-900 dark:bg-slate-900 sm:p-8">
          <div className="flex justify-between gap-2 font-mono text-xs font-bold uppercase text-slate-500"><span>Sample OMR question</span><span>+4 / −1</span></div>
          <h2 className="mt-5 text-lg font-semibold">A shirt priced at ₹800 is sold at 25% off. What is the sale price?</h2>
          <div className="mt-5 grid gap-3">{['₹500','₹600','₹650','₹700'].map((value,i)=>
            <button key={value} type="button" disabled={picked!==null} onClick={()=>setPicked(i)}
              className={'ep-link-motion flex min-h-12 items-center gap-3 rounded-xl border p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ' + (picked!==null && i===1 ? 'border-green-600 bg-green-50 text-green-950' : picked===i ? 'border-red-600 bg-red-50 text-red-950' : 'border-slate-200 hover:border-orange-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white')}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-current font-mono text-sm font-bold">{'ABCD'[i]}</span>{value}
            </button>)}
          </div>
          <p className="mt-4 min-h-12 text-sm" aria-live="polite">{picked===null ? 'Select an option to see an explanation.' : (picked===1 ? 'Correct. ' : 'Not quite. ')+'25% of ₹800 is ₹200, so the sale price is ₹600. This sample does not affect exam scores.'}</p>
          {picked!==null && <button type="button" onClick={()=>setPicked(null)} className="mt-2 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"><RotateCcw size={15}/> Try again</button>}
        </div>
      </section>

      <section id="how" className="ep-studio-panel py-16 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-orange-400">How to use it</p>
          <h2 className="mt-3 text-3xl font-extrabold">Pick your role and see the first steps.</h2>
          <div role="group" aria-label="Role" className="mt-7 flex flex-wrap gap-2">{([['student','Student'],['teacher','Teacher / owner'],['institute','Coaching institute']] as const).map(([id,label])=>
            <button key={id} type="button" aria-pressed={role===id} onClick={()=>setRole(id)}
              className={'rounded-lg border px-4 py-3 font-semibold ' + (role===id ? 'border-white bg-white text-slate-900' : 'border-slate-500')}>{label}</button>)}
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">{ROLES[role].map((step,i)=>
            <article key={step.title} className="ep-link-motion rounded-2xl border border-slate-700 bg-[#172548] p-6 hover:border-indigo-300/60">
              <span className="grid h-10 w-10 place-items-center rounded-full border border-orange-400 font-mono text-orange-300">{i+1}</span>
              <h3 className="mt-4 text-lg font-bold">{step.title}</h3><p className="mt-2 text-slate-300">{step.detail}</p>
            </article>)}
          </div>
          <Link href={role==='student'?'/india-mocks':role==='teacher'?'/admin':'/institutes'} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-orange-600 px-5 py-3 font-bold">
            {role==='student'?'Start practicing':role==='teacher'?'Owner admin':'Institute overview'} <ChevronRight size={16}/>
          </Link>
        </div>
      </section>

      <section id="practice" className="mx-auto max-w-6xl px-4 py-16">
        <p className="font-mono text-xs font-bold uppercase text-orange-700 dark:text-orange-400">Practice library</p>
        <h2 className="mt-3 text-3xl font-extrabold">Take a real mock test.</h2>
        <p className="mt-3 text-slate-600 dark:text-slate-300">Tests come from the live Render/Neon catalogue. Use the language toggle for supported exam UI labels; automatic question translation needs Azure Translator configured on Render.</p>
        {sharedError && <p className="mt-4 rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-950" role="alert">{sharedError}</p>}
        {catalogStatus ? <p className="mt-6" role="status">{catalogStatus}</p> : <>
          <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter exams">{categories.map(c=>
            <button key={c} type="button" aria-pressed={filter===c} onClick={()=>setFilter(c)}
              className={'rounded-full border px-4 py-2 text-sm font-semibold ' + (filter===c?'border-slate-900 bg-slate-900 text-white dark:bg-white dark:text-slate-900':'border-slate-300 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white')}>{c}</button>)}
          </div>
          <div id="tgrid" className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">{shown.filter(t=>!competitive.some(c=>c.practiceTestId===t.id)).map(t=>
            <article key={t.id} className="ep-card flex h-full flex-col gap-3 rounded-2xl p-6 text-slate-900 dark:text-white">
              <div className="flex justify-between gap-2"><h3 className="font-bold">{t.name}</h3><span className={'h-fit rounded px-2 py-1 text-xs font-semibold ' + (t.tier==='free'?'bg-emerald-100 text-emerald-900':'bg-amber-100 text-amber-900')}>{t.tier==='free'?'Free':'Pro'}</span></div>
              <p className="text-sm text-slate-500 dark:text-slate-300">{t.exam} · {t.questionCount} questions · {t.minutes} min</p>
              <p className="text-xs text-slate-500 dark:text-slate-300">{t.sections.join(' · ')}</p>
              <Link href={'/india-mocks/'+encodeURIComponent(t.id)} className="mt-auto inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-900 px-4 py-2 font-bold text-white dark:bg-white dark:text-slate-900">Open test</Link>
              <ShareTestButtons testId={t.id} title={t.name} compact/>
            </article>)}
            {competitive.filter(topic=>filter==='All'||topic.category===filter).map(topic=>
              <article key={topic.id} className="ep-card flex h-full flex-col gap-3 rounded-2xl p-6">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold">{topic.name}</h3>
                  <span className={'rounded px-2 py-1 text-xs font-semibold '+(topic.practiceTestId?'bg-emerald-100 text-emerald-900':'bg-amber-100 text-amber-950')}>
                    {topic.practiceTestId?t('available'):t('upcoming')}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{topic.category} · {topic.questionCount} questions in the question bank</p>
                <p className="text-xs text-muted-foreground">{topic.practiceTestId?'Published practice topic':'Not yet published for students'}</p>
                {topic.practiceTestId
                  ? <Link href={'/india-mocks/'+encodeURIComponent(topic.practiceTestId)+'?mode=practice'}
                      className="mt-auto inline-flex min-h-10 items-center justify-center rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white">Open practice</Link>
                  : <span className="mt-auto inline-flex min-h-10 items-center justify-center rounded-lg border px-4 py-2 text-sm text-muted-foreground" aria-disabled="true">Awaiting admin review</span>}
                {topic.practiceTestId && <ShareTestButtons testId={topic.practiceTestId} title={topic.name} compact/>}
              </article>)}
          </div>
          {!shown.length && <p className="mt-6">No active mocks in this category.</p>}
        </>}
        <div className="mt-7 flex flex-wrap gap-3"><Link className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-900" href="/india-mocks">All mock tests</Link><Link className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-900" href="/certifications">IT certifications</Link><Link className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-900" href="/bookmarks">Saved questions</Link></div>
      </section>

      <section id="builder" className="mx-auto max-w-6xl px-4 pb-16">
        <p className="font-mono text-xs font-bold uppercase text-indigo-700 dark:text-indigo-300">Live competitive question bank</p>
        <h2 className="mt-3 text-3xl font-extrabold">Build a topic practice session</h2>
        <p className="mt-3 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
          All four 125-question topics are synced from Neon. Only active topics can be selected.
          Unpublished topics remain visible as coming soon, not as playable tests.
          Multi-topic sessions are unscored practice; topic accuracy appears in the results.
        </p>
        <div id="bTopics" className="mt-6 grid gap-3 sm:grid-cols-2" role="group" aria-label="Competitive topics">
          {competitive.map(topic=><label key={topic.id} className="ep-card flex items-start gap-3 rounded-xl p-4">
            <input type="checkbox" className="mt-1 h-4 w-4" disabled={!topic.practiceTestId}
              checked={Boolean(topic.practiceTestId&&selected.includes(topic.practiceTestId))}
              onChange={event=>{
                const id=topic.practiceTestId;
                if(!id)return;
                setSelected(before=>event.target.checked?[...before,id]:before.filter(value=>value!==id));
              }}/>
            <span className="flex-1">
              <span className="block font-semibold">{topic.name}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{topic.questionCount} questions · {topic.practiceTestId?t('available'):t('upcoming')}</span>
              {accuracy[topic.id]?.attempted
                ? <span className="mt-3 block">
                    <span className="text-xs text-muted-foreground">Scored accuracy: {accuracy[topic.id].percent}% from {accuracy[topic.id].attempted} answers</span>
                    <span className="mt-1 block h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <span className="block h-full rounded-full bg-indigo-600" style={{width:accuracy[topic.id].percent+'%'}} />
                    </span>
                  </span>
                : <span className="mt-2 block text-xs text-muted-foreground">No scored attempts yet</span>}
            </span>
            {topic.practiceTestId && <Link href={'/india-mocks/'+encodeURIComponent(topic.practiceTestId)+'?mode=practice'}
              className="text-sm font-semibold text-indigo-700 underline dark:text-indigo-300">Practice</Link>}
          </label>)}
        </div>
        {!competitive.length && <p className="mt-4 text-sm text-muted-foreground">Competitive topics are temporarily unavailable. Existing published mocks remain accessible above.</p>}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {selected.length>0
            ? <Link href={'/exampro/custom-practice?topics='+encodeURIComponent(selected.join(','))}
                className="inline-flex min-h-11 items-center rounded-lg bg-indigo-700 px-5 py-3 font-semibold text-white">
                Start practice with {selected.length} topic{selected.length===1?'':'s'}
              </Link>
            : <span className="rounded-lg border bg-muted/40 px-5 py-3 text-sm text-muted-foreground">Choose an available topic to start</span>}
          <Link href="/admin" className="text-sm font-semibold text-indigo-700 underline dark:text-indigo-300">Owner: review and publish topics</Link>
        </div>
      </section>

      <section id="progress" className="border-y border-slate-200 bg-white py-14 text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white">
        <div className="mx-auto grid max-w-6xl gap-5 px-4 md:grid-cols-3">
          {[
            { icon: Clock3, name: 'Timed exam practice', text: 'Automatic saving, timing and server scoring.', url: '/india-mocks' },
            { icon: LayoutDashboard, name: 'My practice progress', text: 'View scores, attempt history and explanations.', url: '/dashboard' },
            { icon: ShieldCheck, name: 'Owner question publishing', text: 'Create questions and publish reviewed tests.', url: '/admin' },
          ].map(item=><Link href={item.url} key={item.name} className="ep-link-motion rounded-2xl border border-slate-200 p-6 hover:border-indigo-400 hover:bg-indigo-50/30 dark:border-slate-700 dark:hover:bg-indigo-950/20">
            <item.icon className="h-7 w-7 text-orange-600"/><h2 className="mt-4 text-lg font-bold">{item.name}</h2><p className="mt-2 text-slate-600 dark:text-slate-300">{item.text}</p><span className="mt-4 inline-flex items-center gap-1 font-semibold text-orange-700 dark:text-orange-400">Open feature <ChevronRight size={16}/></span>
          </Link>)}
        </div>
      </section>

      <section id="portal" className="ep-studio-panel py-16 text-white">
        <div className="mx-auto max-w-6xl px-4">
          <p className="flex items-center gap-2 font-mono text-xs font-bold uppercase text-orange-400"><Palette size={15}/> Portal builder</p>
          <h2 className="mt-3 text-3xl font-extrabold">Create a public practice portal to share.</h2>
          <p className="mt-3 max-w-3xl text-slate-300">Preview your institute branding, then open and share a real public practice page with live ExamPro tests. Private institute accounts, student batches and attendance are not yet enabled.</p>
          <div className="mt-10 grid gap-8 lg:grid-cols-[.9fr_1.1fr]">
            <form className="grid content-start gap-4" onSubmit={e=>e.preventDefault()}>
              <div><p className="text-sm font-semibold">Start from a sample</p><div className="mt-2 flex flex-wrap gap-2">{PRESETS.map(p=>
                <button key={p.label} type="button" onClick={()=>{change({name:p.name,tagline:p.tagline,color:p.color,batches:p.batches,logo:''});setLogoError('');}} className="rounded-full border border-slate-500 px-4 py-2 text-sm font-semibold">{p.label}</button>)}</div></div>
              <label className="grid gap-1 text-sm font-semibold">Institute name<input maxLength={40} value={portal.name} onChange={e=>change({name:e.target.value})} placeholder="Your Institute" className="min-h-11 rounded-lg border border-slate-500 bg-[#172548] px-3 py-2" /></label>
              <label className="grid gap-1 text-sm font-semibold">Tagline<input maxLength={60} value={portal.tagline} onChange={e=>change({tagline:e.target.value})} className="min-h-11 rounded-lg border border-slate-500 bg-[#172548] px-3 py-2" /></label>
              <div><p className="text-sm font-semibold">Brand colour</p><div className="mt-3 flex flex-wrap gap-3">{COLORS.map(c=>
                <button key={c} type="button" aria-label={'Choose '+c} aria-pressed={portal.color===c} onClick={()=>change({color:c})} style={{background:c}}
                  className={'h-10 w-10 rounded-full border-2 border-white '+(portal.color===c?'outline outline-2 outline-offset-2 outline-white':'')}/>)}</div></div>
              <label className="grid gap-2 text-sm font-semibold">Logo <span className="font-normal text-slate-300">PNG, JPG or WebP · maximum 500 KB</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{logo(e.target.files?.[0]);e.target.value='';}} className="w-full rounded-lg border border-slate-500 bg-[#172548] p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:font-semibold file:text-slate-900"/>
              </label>
              {logoError && <p className="text-sm text-red-300" role="alert">{logoError}</p>}
              {portal.logo && <button type="button" className="justify-self-start text-sm underline" onClick={()=>change({logo:''})}>Remove logo</button>}
              <label className="grid gap-1 text-sm font-semibold">Batches (comma separated)<input maxLength={160} value={portal.batches} onChange={e=>change({batches:e.target.value})} className="min-h-11 rounded-lg border border-slate-500 bg-[#172548] px-3 py-2"/></label>
              <label className="grid gap-1 text-sm font-semibold">Counsellor WhatsApp number<input type="tel" maxLength={25} value={portal.whatsapp} onChange={e=>change({whatsapp:e.target.value})} placeholder="Indian 10-digit number" className="min-h-11 rounded-lg border border-slate-500 bg-[#172548] px-3 py-2"/></label>
              <label className="grid gap-1 text-sm font-semibold">Discussion WhatsApp group link<input type="url" maxLength={250} value={portal.group} onChange={e=>change({group:e.target.value})} placeholder="https://chat.whatsapp.com/..." className="min-h-11 rounded-lg border border-slate-500 bg-[#172548] px-3 py-2"/></label>
              {portal.group && !group && <p className="text-sm text-amber-300">Enter a valid https://chat.whatsapp.com invite URL.</p>}
              <p className="text-sm text-slate-300" role="status">{notice || 'Changes stay in this browser and are not uploaded.'}</p>
              <button type="button" onClick={()=>{setPortal(INITIAL);setLogoError('');}} className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-500 px-4 py-2 text-sm font-semibold"><RotateCcw size={16}/> Reset preview</button>
              <button type="button" onClick={()=>void copyBrandedPortal()} className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-500 px-4 py-2 text-sm font-semibold">{portalCopied?'Portal link copied':'Copy public portal link'}</button>
               <Link href={publicPortalPath} className="inline-flex w-fit items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-900">Open public portal</Link>
               <button type="button" onClick={()=>{const href=new URL(publicPortalPath,window.location.origin).href;window.location.assign('https://wa.me/?text='+encodeURIComponent('Practice mock tests with '+name+': '+href));}} className="inline-flex w-fit items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white">Share portal on WhatsApp</button>
               {portalShareLink && <label className="text-xs text-slate-100">Share link (long-press to copy on mobile)<input readOnly value={portalShareLink} onFocus={event=>event.target.select()} className="mt-1 block w-full rounded-lg border border-slate-500 bg-[#172548] px-3 py-2 text-xs"/></label>}
              <p className="text-xs text-slate-300">The shared page is a real public landing page with published mock links, not a private institute workspace. Logos, contact links, student records, and billing are never included.</p>
            </form>
            <div className="ep-preview-surface overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-xl lg:sticky lg:top-24 lg:self-start">
              <div className="flex gap-1 border-b border-slate-200 bg-slate-100 px-4 py-3"><span className="h-2 w-2 rounded-full bg-slate-400"/><span className="h-2 w-2 rounded-full bg-slate-400"/><span className="h-2 w-2 rounded-full bg-slate-400"/><Link href={publicPortalPath} className="ml-3 min-w-0 truncate font-mono text-xs text-slate-500 underline" title="Open shareable ExamPro public portal">quiz-app-virid-zeta-41.vercel.app/exampro?institute={portalSlug}</Link></div>
              <div className="flex items-center gap-4 p-5" style={{background:portal.color,color:ink}}>
                {portal.logo ? <img src={portal.logo} alt="Preview of institute logo" className="h-14 w-14 rounded-xl bg-white object-contain"/> : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-white text-xl font-black" style={{color:portal.color}}>{initials}</span>}
                <div className="min-w-0"><h3 className="break-words text-xl font-extrabold">{name}</h3><p className="mt-1 text-sm">{portal.tagline}</p></div>
              </div>
              <div className="grid gap-5 p-5">
                <div><h4 className="font-mono text-xs font-bold uppercase text-slate-500">Batches</h4><div className="mt-2 flex flex-wrap gap-2">{(batches.length?batches:['Add a batch']).map((b,i)=><span key={i} className="rounded-full bg-slate-100 px-3 py-2 text-sm">{b}</span>)}</div></div>
                <div><h4 className="font-mono text-xs font-bold uppercase text-slate-500">Live mock tests</h4>
                  {tests.slice(0,3).map(t=><div key={t.id} className="flex items-center justify-between gap-3 border-t border-slate-200 py-3">
                    <div><p className="font-semibold">{t.name}</p><p className="text-xs text-slate-500">{t.questionCount} questions · {t.minutes} min</p></div>
                    <Link href={'/india-mocks/'+encodeURIComponent(t.id)} style={{background:portal.color,color:ink}} className="shrink-0 rounded-lg px-3 py-2 text-sm font-bold">View</Link>
                  </div>)}
                  {!tests.length && <p className="mt-3 text-sm text-slate-500">Live tests appear here when the API is available.</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href={whatsappLink('Hi, I want to know about batches at '+name,waNumber(portal.whatsapp))} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white"><MessageCircle size={16}/> Talk to counsellor</a>
                  {group && <a href={group} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Join group</a>}
                </div>
                <p className="border-t border-slate-200 pt-3 text-xs text-slate-500">Open the live public portal above to share published tests. Institute-only student management and private branding are not enabled yet.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-2">
        <div><p className="font-mono text-xs font-bold uppercase text-orange-700 dark:text-orange-400">WhatsApp, built in</p><h2 className="mt-3 text-3xl font-extrabold">Get guidance where you already chat.</h2><p className="mt-3 text-slate-600 dark:text-slate-300">Choose a topic below. WhatsApp opens with a suggested message; nothing is sent automatically.</p></div>
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">{[
          ['Coaching enquiry','Hi, I want to know more about ExamPro coaching.'],
          ['Branded institute portal','Hi, I want to discuss a branded institute portal on ExamPro.'],
          ['Question doubt','Hi, I need help understanding a question in my ExamPro mock.'],
        ].map(([label,message])=><a key={label} href={whatsappLink(message)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 font-semibold dark:border-slate-700"><span className="flex items-center gap-3"><MessageCircle size={18} className="text-emerald-600"/>{label}</span><ChevronRight size={17}/></a>)}</div>
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-16"><div className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start gap-3"><Building2 className="mt-1 text-orange-600"/><div><h2 className="text-lg font-bold">Institute accounts are the next milestone.</h2><p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-300">Student batches, tenant-specific results, shared branding and billing are not enabled yet. The existing owner-admin exam tools remain available.</p></div></div>
        <div className="flex flex-wrap gap-2"><Link href="/institute-admin" className="ep-link-motion rounded-lg border px-4 py-3 font-semibold">Institute preview</Link><Link href="/admin" className="rounded-lg bg-orange-700 px-4 py-3 font-bold text-white">Owner admin</Link></div>
      </div></section>
    </main>
    <Footer/>
  </>;
}
