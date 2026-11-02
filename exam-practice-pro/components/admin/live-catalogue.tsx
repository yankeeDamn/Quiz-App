'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {admin,type AdminTest} from '@/lib/admin';
import {isProTest,type MockSummary} from '@/lib/mocks';
import {Button} from '@/components/ui/button';
import {card,input,Notice} from './ui';
export function LiveCatalogue({definitions,onEditQuestions}:{definitions:AdminTest[];onEditQuestions?:(topic:string)=>void}){
 const [tests,setTests]=useState<MockSummary[]|null>(null),[error,setError]=useState(''),[search,setSearch]=useState(''),[tier,setTier]=useState('all');
 const load=useCallback(async()=>{const r=await admin<{tests:MockSummary[]}>('/catalogue');if(r.ok){setTests(r.data.tests);setError('');}else setError(r.message);},[]);
 useEffect(()=>{let active=true;void admin<{tests:MockSummary[]}>('/catalogue').then(r=>{if(!active)return;if(r.ok)setTests(r.data.tests);else setError(r.message);});return()=>{active=false;};},[]);
 const shown=(tests||[]).filter(t=>(tier==='all'||(tier==='pro'?isProTest(t):!isProTest(t)))&&`${t.name} ${t.exam} ${t.id}`.toLowerCase().includes(search.toLowerCase()));
 return <section className={`${card} space-y-4`} aria-label="Live learner catalogue">
  <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-bold">Live Catalogue {tests&&`(${tests.length})`}</h2><p className="mt-2 text-sm text-muted-foreground">These are the database tests learners can currently see. Includes automatically generated topic tests; excludes drafts, blocked definitions and bundled starter packs.</p></div><Button variant="outline" onClick={()=>void load()}>Refresh live tests</Button></div>
  {tests&&<p className="text-sm font-semibold">{tests.filter(t=>!isProTest(t)).length} Free · {tests.filter(isProTest).length} Pro · {tests.filter(t=>t.kind==='mock').length} mock definitions · {tests.filter(t=>t.kind==='topic').length} topic tests</p>}
  <div className="grid gap-3 sm:grid-cols-[1fr_180px]"><input className={input} value={search} onChange={e=>setSearch(e.target.value)} aria-label="Search live tests" placeholder="Search live mocks and topic tests…"/><select className={input} value={tier} onChange={e=>setTier(e.target.value)} aria-label="Live catalogue tier"><option value="all">Free and Pro</option><option value="free">Free only</option><option value="pro">Pro only</option></select></div>
  {error&&<Notice kind="error">{error}</Notice>}
  {!tests&&!error&&<p role="status">Loading the live catalogue…</p>}
  {tests&&<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-muted/50 text-xs uppercase"><tr>{['Live test / category','Kind','Questions / mins','Tier','Status','Actions'].map(label=><th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{shown.map(t=>{
   const definition=definitions.find(d=>d.id===t.id);
   const topic=t.kind==='topic'?t.id.slice('topic-'.length):definition?.sections[0]?.parts[0]?.topic;
   return <tr key={t.id} className="border-t"><td className="min-w-52 p-3 font-semibold">{t.name}<p className="mt-1 text-xs font-normal text-muted-foreground">{t.exam} · {t.id}</p></td><td className="p-3 text-xs">{t.kind==='topic'?'Topic test':'Mock test'}</td><td className="whitespace-nowrap p-3 text-xs">{t.questionCount} Qs · {t.minutes} mins</td><td className="p-3 text-xs font-bold">{isProTest(t)?'★ PRO':'● Free'}</td><td className="p-3"><span className="whitespace-nowrap rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Published · Live</span></td><td className="p-3"><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" asChild><Link href={`/india-mocks/${t.id}?mode=test`} target="_blank" rel="noopener noreferrer">View test</Link></Button>{topic&&<Button size="sm" variant="ghost" onClick={()=>onEditQuestions?.(topic)}>Edit questions</Button>}</div></td></tr>;
  })}{shown.length===0&&<tr><td colSpan={6} className="p-5 text-muted-foreground">No live tests match these filters. A Pro count of zero means no Pro mock currently passes publication and completeness checks.</td></tr>}</tbody></table></div>}
 </section>;
}
