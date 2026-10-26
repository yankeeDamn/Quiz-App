'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { fetchCatalog, type MockSummary } from '@/lib/mocks';
import { ShareTestButtons } from '@/components/exampro/share-test-buttons';
import { copyUrl } from '@/lib/mobile-share';

type Brand = {name:string;tagline:string;color:string;batches:string};
const fallback:Brand={name:'ExamPro Learning Portal',tagline:'Practice smarter. Score higher.',color:'#1949C7',batches:''};

function fallbackForSlug(slug:string|null):Brand {
  // Slugs identify public branding, not authenticated institute tenants.
  if (!slug || !/^[a-z0-9][a-z0-9-]{0,47}$/.test(slug)) return fallback;
  const name = slug.split('-').filter(Boolean).map(s=>s[0].toUpperCase()+s.slice(1)).join(' ').slice(0,40);
  return {...fallback,name:name||fallback.name};
}
function decodeBrand(input:string|null, slug:string|null):Brand {
  const base = fallbackForSlug(slug);
  if (!input || input.length>800) return base;
  try {
    const parsed:unknown=JSON.parse(input);
    if(!parsed||typeof parsed!=='object')return base;
    const item=parsed as Record<string,unknown>;
    const value=(field:keyof Brand,max:number,defaultValue:string)=>
      typeof item[field]==='string' ? (item[field] as string).slice(0,max).trim()||defaultValue : defaultValue;
    const color=typeof item.color==='string' && /^#[0-9a-fA-F]{6}$/.test(item.color) ? item.color : base.color;
    return {
      name:value('name',40,base.name),
      tagline:value('tagline',60,base.tagline),
      color,
      batches:value('batches',160,''),
    };
  } catch { return base; }
}

function PortalContent(){
  const params=useSearchParams();
  const brand=decodeBrand(params.get('brand'),params.get('institute'));
  const [tests,setTests]=useState<MockSummary[]>([]);
  const [state,setState]=useState<'loading'|'ready'|'error'>('loading');
  const [copyState,setCopyState]=useState<'idle'|'copied'|'manual'>('idle');
  const [url,setUrl]=useState('');

  useEffect(()=>{
    let cancelled=false;
    fetchCatalog()
      .then(items=>{if(!cancelled){setTests(items);setState('ready');}})
      .catch(()=>{if(!cancelled)setState('error');});
    return()=>{cancelled=true;};
  },[]);
  useEffect(()=>{setUrl(window.location.href);},[params]);
  const batches=brand.batches.split(',').map(s=>s.trim()).filter(Boolean).slice(0,6);
  const copy=async()=>setCopyState(await copyUrl(window.location.href)?'copied':'manual');
  const readableText = /^#[0-9A-Fa-f]{6}$/.test(brand.color) && parseInt(brand.color.slice(1,3),16)*299+
    parseInt(brand.color.slice(3,5),16)*587+parseInt(brand.color.slice(5,7),16)*114>170000?'#101a33':'#fff';

  return <>
    <Header/>
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-12">
      <div className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="px-6 py-12 sm:px-10" style={{backgroundColor:brand.color,color:readableText}}>
          <p className="text-sm font-semibold uppercase tracking-wider opacity-90">Public practice portal</p>
          <h1 className="mt-4 break-words text-3xl font-extrabold sm:text-5xl">{brand.name}</h1>
          <p className="mt-4 max-w-xl text-lg">{brand.tagline}</p>
        </div>
        <div className="space-y-8 px-6 py-8 sm:px-10">
          <div>
            <h2 className="text-xl font-bold">Practice batches</h2>
            <div className="mt-3 flex flex-wrap gap-2">{batches.length
              ? batches.map((batch,i)=><span key={i} className="rounded-full border px-4 py-2 text-sm">{batch}</span>)
              : <p className="text-sm text-muted-foreground">Explore our available mock tests below.</p>}
            </div>
          </div>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold">Available mock tests</h2>
              <Link href="/india-mocks" className="text-sm font-semibold text-indigo-700 underline dark:text-indigo-300">Browse all</Link>
            </div>
            {state==='loading' && <p className="mt-4 text-muted-foreground" role="status">Loading published tests…</p>}
            {state==='error' && <div role="alert" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              Cannot connect to ExamPro's live question catalogue. Please try again from the main mock tests page.
              <Link href="/india-mocks" className="ml-2 underline">Open catalogue</Link>
            </div>}
            {state==='ready'&&!tests.length && <p className="mt-4 text-muted-foreground">No published tests are currently available.</p>}
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tests.slice(0,9).map(test=><article key={test.id} className="flex flex-col gap-3 rounded-xl border p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold">{test.name}</h3>
                  <span className="rounded bg-muted px-2 py-1 text-xs">{test.tier==='premium'?'Pro':'Free'}</span>
                </div>
                <p className="text-sm text-muted-foreground">{test.exam} · {test.questionCount} questions · {test.minutes} min</p>
                <Link href={'/india-mocks/'+encodeURIComponent(test.id)} className="mt-auto inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm font-bold text-white" style={{backgroundColor:'#3730a3'}}>
                  View test
                </Link>
                <ShareTestButtons testId={test.id} title={test.name} compact/>
              </article>)}
            </div>
          </div>
          <div className="rounded-xl border bg-muted/30 p-4">
            <h2 className="font-bold">Share this public practice portal</h2>
            <p className="mt-2 text-sm text-muted-foreground">This link shares public branding and published mock links. Student accounts, private batches, logos, and institute records are not included.</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="button" onClick={()=>void copy()} className="min-h-10 rounded-lg border bg-background px-4 py-2 text-sm font-semibold">
                {copyState==='copied'?'Link copied':'Copy portal link'}
              </button>
              {url&&<a target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
                href={'https://wa.me/?text='+encodeURIComponent('Practice with '+brand.name+': '+url)}>
                Share via WhatsApp
              </a>}
            </div>
            {copyState==='manual'&&<label className="mt-3 block text-sm">Copy manually: <input readOnly onFocus={e=>e.target.select()} value={url} className="mt-1 w-full rounded-lg border bg-background p-2 text-xs"/></label>}
          </div>
        </div>
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">ExamPro public practice links. This is not a private coaching-institute account or a payment portal.</p>
    </main>
    <Footer/>
  </>;
}
export default function PublicPracticePortalPage(){
  return <Suspense fallback={<p className="p-8 text-center" role="status">Loading portal…</p>}><PortalContent/></Suspense>;
}
