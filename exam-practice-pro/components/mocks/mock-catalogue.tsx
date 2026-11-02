'use client';
import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MockCard } from '@/components/mocks/mock-card';
import { ProMockModal } from '@/components/mocks/pro-mock-modal';
import { fetchCatalog, isProTest, type MockSummary } from '@/lib/mocks';
import { usePlan } from '@/hooks/use-plan';

const categories=[['all','All'],['SSC','SSC'],['Banking','Banking'],['Railways','Railways'],['UPSC / PSC','UPSC / PSC'],['Placements','Campus'],['IT Certification','IT Certifications'],['topic','Topic tests']];
type Tier='all'|'free'|'pro';

export function MockCatalogue({initialCategory='all'}:{initialCategory?:string}) {
  const plan=usePlan();
  const [tests,setTests]=useState<MockSummary[]|null>(null);
  const [error,setError]=useState('');
  const [category,setCategory]=useState(initialCategory);
  const [tier,setTier]=useState<Tier>('all');
  const [search,setSearch]=useState('');
  const [selected,setSelected]=useState<MockSummary|null>(null);
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    let cancelled=false, running=false;
    const load=async()=>{
      if(running||document.visibilityState==='hidden')return;
      running=true;
      try {const t=await fetchCatalog();if(!cancelled){setTests(t);setError('');}}
      catch {if(!cancelled)setError('The live catalogue could not be refreshed. Try again shortly.');}
      finally {running=false;}
    };
    const focus=()=>{void load();};
    void load();
    const timer=window.setInterval(focus,30_000);
    window.addEventListener('focus',focus);
    window.addEventListener('exampro-catalogue-changed',focus);
    document.addEventListener('visibilitychange',focus);
    return ()=>{cancelled=true;window.clearInterval(timer);window.removeEventListener('focus',focus);window.removeEventListener('exampro-catalogue-changed',focus);document.removeEventListener('visibilitychange',focus);};
  },[refresh]);
  const matched=useMemo(()=>(tests??[]).filter(t=>
    (category==='all'||(category==='topic'?t.kind==='topic':t.exam===category))&&
    `${t.name} ${t.exam} ${t.sections.join(' ')}`.toLowerCase().includes(search.toLowerCase().trim())
  ),[tests,category,search]);
  const counts={all:matched.length,free:matched.filter(t=>!isProTest(t)).length,pro:matched.filter(isProTest).length};
  const shown=matched.filter(t=>tier==='all'||(tier==='pro'?isProTest(t):!isProTest(t)));
  return <div className="space-y-5">
    <div role="group" aria-label="Filter by test tier" className="flex w-fit max-w-full flex-wrap gap-1 rounded-2xl border bg-muted/60 p-1.5">
      {([['all','All Tests'],['free','● Free Practice'],['pro','★ Pro Mocks']] as const).map(([id,label])=><button type="button" key={id} aria-pressed={tier===id} onClick={()=>setTier(id)} className={`min-h-11 rounded-xl px-4 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 ${tier===id?'bg-card text-foreground shadow-sm':'text-muted-foreground hover:text-foreground'}`}>{label} <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">{tests?counts[id]:'—'}</span></button>)}
    </div>
    <div role="group" aria-label="Filter by exam category" className="flex flex-wrap gap-2">{categories.map(([id,label])=><button type="button" key={id} aria-pressed={category===id} onClick={()=>setCategory(id)} className={`min-h-10 rounded-full border px-4 text-sm font-medium focus-visible:outline-indigo-500 ${category===id?'border-indigo-600 bg-indigo-600 text-white':'bg-card hover:border-indigo-400'}`}>{label}</button>)}</div>
    <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex w-full max-w-md items-center gap-2 rounded-xl border bg-card px-3"><Search aria-hidden className="h-4 w-4 text-muted-foreground"/><input aria-label="Search mock tests" className="min-h-11 w-full bg-transparent text-sm outline-none" placeholder="Search tests, subjects or sections…" value={search} onChange={e=>setSearch(e.target.value)}/></label><Button variant="ghost" size="sm" onClick={()=>setRefresh(n=>n+1)}><RefreshCw className="h-4 w-4"/>Refresh tests</Button></div>
    {error&&<p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-200">{error}{tests&&' Showing the last loaded catalogue.'}</p>}
    {!tests&&!error&&<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading catalogue" aria-busy>{Array.from({length:6},(_,i)=><div key={i} className="h-72 motion-safe:animate-pulse rounded-2xl border bg-muted/50"/>)}</div>}
    {tests&&<><p role="status" className="text-xs text-muted-foreground">{shown.length} matching tests · Published content only · Refreshes every 30 seconds and when you return to this page</p><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{shown.map(t=><MockCard key={t.id} test={t} plan={plan} onPreview={setSelected}/>)}</div>{shown.length===0&&<div className="rounded-2xl border border-dashed p-10 text-center"><h3 className="font-semibold">No {tier==='pro'?'published Pro ':''}tests match these filters</h3><p className="mt-2 text-sm text-muted-foreground">Try another category. New mocks appear here after review and publication.</p><Button className="mt-4" variant="outline" onClick={()=>{setTier('all');setCategory('all');setSearch('');}}>Reset filters</Button></div>}</>}
    {selected&&<ProMockModal key={selected.id} test={selected} onClose={()=>setSelected(null)}/>}
  </div>;
}
