'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {ArrowUpRight,BriefcaseBusiness,CalendarDays,Clock3,RefreshCw,Search} from 'lucide-react';
import {Header} from '@/components/layout/header';
import {Footer} from '@/components/layout/footer';
import {api} from '@/lib/api';

type Status='open'|'upcoming';
type Job={
 id:string;title:string;organisation:string;category:string;status:Status;
 applicationDeadline:string|null;noticeDate:string|null;method:string;source:string;
 sourceUrl:string;applicationUrl:string|null;notice:string;
};
type Portal={name:string;category:string;url:string;description:string};
type Source={id:string;name:string;url:string;status:'ok'|'stale'|'unavailable';checkedAt:string|null};
type JobResponse={jobs:Job[];portals:Portal[];sources:Source[];updatedAt:string;disclaimer:string};
const CATEGORY=['All','SSC','UPSC','Railways','Banking','General'] as const;
const OFFICIAL_PORTALS:Portal[]=[
 {name:'Employment News',category:'General',url:'https://employmentnews.gov.in/newemp/AllJobs.aspx?k=All',description:'Official central-government recruitment listings'},
 {name:'SSC',category:'SSC',url:'https://ssc.gov.in/',description:'SSC notifications and recruitment calendar'},
 {name:'UPSC',category:'UPSC',url:'https://cms.upsc.gov.in/examination-calendar/',description:'Forthcoming competitive examinations'},
 {name:'National Career Service',category:'General',url:'https://ncs.gov.in/',description:'Government and private vacancies with filters'},
 {name:'IBPS',category:'Banking',url:'https://www.ibps.in/',description:'Banking exam notices and application calendar'},
 {name:'Railway Recruitment Boards',category:'Railways',url:'https://www.rrbcdg.gov.in/',description:'RRB central notices and application updates'},
];
const date=(iso:string|null)=>iso?new Date(iso+'T12:00:00Z').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Kolkata'}):'Not announced';
const checked=(iso:string|null)=>iso?new Date(iso).toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:'Asia/Kolkata'}):'Unavailable';
export default function GovernmentJobsPage(){
 const [feed,setFeed]=useState<JobResponse|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const [filter,setFilter]=useState<string>('All');
 const [status,setStatus]=useState<string>('all');
 const [search,setSearch]=useState('');
 const refresh=useCallback(async()=>{
  const r=await api<JobResponse>('/api/v1/government-jobs',{public:true});
  if(r.success&&r.data){setFeed(r.data);setError('');}else setError(r.error?.message||'Could not reach the official-notice index.');
  setLoading(false);
 },[]);
 useEffect(()=>{
  void refresh();
  // Update in an open tab; backend independently checks government sources at most every 30 minutes.
  const id=window.setInterval(()=>void refresh(),15*60*1000);
  const focus=()=>{if(document.visibilityState==='visible')void refresh();};
  document.addEventListener('visibilitychange',focus);
  return ()=>{window.clearInterval(id);document.removeEventListener('visibilitychange',focus);};
 },[refresh]);
 const records=useMemo(()=>((feed?.jobs||[]).filter(j=>{
  if(filter!=='All'&&j.category!==filter)return false;
  if(status!=='all'&&j.status!==status)return false;
  const term=search.trim().toLowerCase();
  return !term||[j.title,j.organisation,j.source,j.method].join(' ').toLowerCase().includes(term);
 })),[feed,filter,status,search]);
 const healthy=feed?.sources.filter(s=>s.status==='ok').length||0;
 const portals=feed?.portals||OFFICIAL_PORTALS;
 const shownPortals=filter==='All'?portals:portals.filter(p=>p.category===filter);
 return <>
  <Header/>
  <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-8 sm:py-12">
   <section className="rounded-3xl border bg-gradient-to-br from-indigo-50 via-background to-teal-50 px-6 py-8 dark:from-indigo-950/30 dark:to-teal-950/20 sm:px-10">
    <p className="text-sm font-bold uppercase tracking-widest text-indigo-700 dark:text-indigo-300">ExamPro · Free career updates</p>
    <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-5xl">Government Jobs & Upcoming Exams</h1>
    <p className="mt-4 max-w-3xl text-muted-foreground">Browse recruitment notices indexed from official government sources, watch for upcoming exams, and verify every application deadline with the issuing authority.</p>
    <div className="mt-5 flex flex-wrap gap-3 text-sm">
     <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-2"><RefreshCw className="h-4 w-4"/> Automatically checks sources about every 30 minutes</span>
     <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-2"><CalendarDays className="h-4 w-4"/> Expired application deadlines hidden</span>
     <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-2">No account or Pro plan required</span>
    </div>
   </section>

   <section aria-label="Recruitment filters" className="space-y-4">
    <div className="flex flex-wrap gap-2">{CATEGORY.map(x=><button type="button" key={x} onClick={()=>setFilter(x)} aria-pressed={filter===x}
      className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${filter===x?'border-indigo-600 bg-indigo-600 text-white':'hover:bg-muted'}`}>{x}</button>)}</div>
    <div className="flex flex-wrap gap-3 sm:items-center">
     <label className="flex min-w-[190px] flex-1 items-center gap-2 rounded-xl border bg-card px-3 py-2"><Search className="h-4 w-4 text-muted-foreground" aria-hidden="true"/>
      <input className="w-full bg-transparent text-sm outline-none" type="search" placeholder="Search post or organization" aria-label="Search government job notices" value={search} onChange={e=>setSearch(e.target.value)}/>
     </label>
     <select className="min-h-11 rounded-xl border bg-card px-3 text-sm" aria-label="Filter notice status" value={status} onChange={e=>setStatus(e.target.value)}>
      <option value="all">All notices</option><option value="open">Applications with future closing dates</option><option value="upcoming">Upcoming / notification pending</option>
     </select>
     <button type="button" onClick={()=>{setLoading(true);void refresh();}} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50">
      <RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/> Check updates
     </button>
    </div>
   </section>

   <section className="space-y-3" aria-live="polite">
    <div className="flex flex-wrap items-end justify-between gap-3">
     <div><h2 className="text-xl font-bold">Latest official notices</h2>
      <p className="text-sm text-muted-foreground">Indexed from Employment News and the UPSC forthcoming-examinations page. Not an application portal.</p>
     </div>
     {feed&&<p className="text-xs text-muted-foreground">{healthy}/{feed.sources.length} sources checked successfully</p>}
    </div>
    {feed?.sources&&<div className="flex flex-wrap gap-2">{feed.sources.map(s=><div key={s.id} className="rounded-lg border px-3 py-2 text-xs">
      <span className="font-semibold">{s.name}</span> · <span className={s.status==='ok'?'text-emerald-700 dark:text-emerald-400':'text-amber-700 dark:text-amber-400'}>{s.status==='ok'?'Updated':s.status==='stale'?'Older cached data':'Currently unavailable'}</span>
      <span className="block text-muted-foreground">Last successful check: {checked(s.checkedAt)}</span>
     </div>)}</div>}
    {error&&<p role="alert" className="rounded-xl border border-amber-400 p-4 text-sm">Live source check unavailable: {error}. Use the verified official portal links below.</p>}
    {loading&&!feed&&<p className="rounded-xl border p-5 text-muted-foreground">Checking official recruitment websites… On a sleeping Render instance the first request can take longer.</p>}
    {!loading&&records.length===0&&<div className="rounded-xl border bg-card p-6 text-sm">
      <p className="font-semibold">No currently verified notices match these filters.</p>
      <p className="mt-2 text-muted-foreground">This may mean no unexpired jobs are listed, the official site has not published new notices, or a source is unavailable. We never invent deadlines or label expired jobs as open. Check the official portals below.</p>
     </div>}
    <div className="grid gap-4 md:grid-cols-2">
     {records.map(j=><article key={j.id} className="flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-sm">
      <div>
       <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2 py-1 font-semibold ${j.status==='open'?'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300':'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'}`}>{j.status==='open'?'Closing date published':'Upcoming · notification pending'}</span>
        <span className="text-muted-foreground">{j.source}</span>
       </div>
       <h3 className="mt-3 text-lg font-bold leading-snug">{j.title}</h3>
       <p className="mt-2 text-sm text-muted-foreground">{j.organisation}</p>
       <div className="mt-4 space-y-1 text-sm">
        <p className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-muted-foreground"/> {j.applicationDeadline?`Closing date: ${date(j.applicationDeadline)}`:'Application dates: not announced in source'}</p>
        {j.noticeDate&&<p className="text-muted-foreground">Listed: {date(j.noticeDate)}</p>}
       </div>
       <p className="mt-3 text-xs text-muted-foreground">{j.notice}</p>
      </div>
      <a href={j.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-10 items-center gap-2 self-start rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted">
       View official notice source <ArrowUpRight className="h-4 w-4"/>
      </a>
     </article>)}
    </div>
   </section>

   <section className="space-y-4">
    <div><h2 className="flex items-center gap-2 text-xl font-bold"><BriefcaseBusiness className="h-5 w-5"/> Official recruitment portals</h2>
     <p className="mt-1 text-sm text-muted-foreground">These links open the issuing authorities. Some portals do not offer a reliable public feed, so visit them directly for the newest notices.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{shownPortals.map(p=><a key={p.url} href={p.url} rel="noopener noreferrer" target="_blank"
     className="group flex flex-col rounded-2xl border bg-card p-5 hover:border-indigo-400 hover:shadow-sm">
     <span className="flex items-center justify-between gap-2 font-bold">{p.name}<ArrowUpRight className="h-4 w-4 group-hover:text-indigo-600"/></span>
     <span className="mt-2 text-sm text-muted-foreground">{p.description}</span>
     <span className="mt-3 text-xs font-medium text-indigo-700 dark:text-indigo-300">{p.category} · official portal</span>
    </a>)}</div>
   </section>

   <p className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
    <strong>Important:</strong> ExamPro is not associated with or endorsed by any recruitment authority. Openings can be changed, postponed or withdrawn without notice. Source checks are best-effort, not guaranteed instant updates. Always verify the full eligibility rules, dates, fees and final application URL on the official government website. ExamPro does not accept job applications.
   </p>
  </main>
  <Footer/>
 </>;
}
