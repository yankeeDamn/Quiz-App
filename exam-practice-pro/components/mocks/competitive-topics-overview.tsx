'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {api} from '@/lib/api';

type Topic={id:string;name:string;category:string;questionCount:number;available:boolean;practiceTestId:string};
export function CompetitiveTopicsOverview(){
 const [topics,setTopics]=useState<Topic[]>([]);
 const [loading,setLoading]=useState(true);
 const [failed,setFailed]=useState(false);
 useEffect(()=>{
  let active=true;
  api<{topics:Topic[]}>('/api/v1/mocks/competitive-topics',{public:true})
   .then(r=>{
    if(!active)return;
    if(r.success&&r.data)setTopics(r.data.topics);
    else setFailed(true);
   }).catch(()=>{if(active)setFailed(true);})
   .finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;};
 },[]);
 return <section className="container mx-auto px-4 pb-12 sm:pb-16" aria-label="Competitive exam topic library">
  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
   <div><p className="ep-eyebrow">500 competitive questions</p>
    <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">Choose your exam track</h2>
    <p className="mt-2 text-sm text-muted-foreground">Live Neon topic status. Unreviewed question groups are not yet available.</p>
   </div>
   <Link className="text-sm font-semibold text-indigo-700 underline dark:text-indigo-300" href="/exampro#build-topics">Open custom practice builder</Link>
  </div>
  {loading&&<p role="status" className="text-sm text-muted-foreground">Loading exam topics…</p>}
  {failed&&<p role="status" className="text-sm text-muted-foreground">Live topic status unavailable. Visit the mock-test catalogue.</p>}
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
   {topics.map(t=><div className="ep-card flex min-w-0 flex-col gap-2 rounded-xl p-4" key={t.id}>
    <h3 className="text-sm font-bold">{t.name}</h3>
    <p className="text-xs text-muted-foreground">{t.questionCount} questions · {t.category}</p>
    <p className={'text-xs font-semibold '+(t.available?'text-emerald-700 dark:text-emerald-300':'text-amber-700 dark:text-amber-300')}>
     {t.available?'Available to practice':'Awaiting owner review'}
    </p>
    {t.available
     ?<Link className="mt-auto pt-2 text-sm font-semibold text-indigo-700 underline dark:text-indigo-300" href={'/india-mocks/'+encodeURIComponent(t.practiceTestId)+'?mode=practice'}>Start topic practice</Link>
     :<Link className="mt-auto pt-2 text-sm font-semibold text-indigo-700 underline dark:text-indigo-300" href="/exampro#build-topics">View group</Link>}
   </div>)}
  </div>
 </section>;
}
