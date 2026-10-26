'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { ExamEngine } from '@/components/mocks/exam-engine';
import { fetchCatalog, fetchMock, type MockTest } from '@/lib/mocks';

/** This is explicitly unscored practice, not a new server-scored exam. */
function Practice() {
  const params=useSearchParams();
  const raw=params.get('topics')||'';
  const [state,setState]=useState<{id:string;test:MockTest|null;error:string}>({id:'',test:null,error:''});
  useEffect(()=>{
    let disposed=false;
    const ids=raw.split(',').filter(Boolean);
    const cacheId=ids.join(',');
    if(!ids.length||ids.length>4||new Set(ids).size!==ids.length||
      ids.some(id=>!/^topic-comp-[a-z0-9-]{1,60}$/.test(id))) {
      return;
    }
    Promise.resolve().then(async()=>{
      const catalog=await fetchCatalog();
      const publicIds=new Set(catalog.filter(t=>t.kind==='topic'&&t.tier==='free').map(t=>t.id));
      if(ids.some(id=>!publicIds.has(id)))throw new Error('One or more topics are not published.');
      const loads=await Promise.all(ids.map(id=>fetchMock(id,'practice')));
      if(loads.some(result=>result.status!=='ok'))throw new Error('A selected topic is unavailable for practice.');
      const parts=loads.map(result=>result.status==='ok'?result.test:null).filter((v):v is MockTest=>v!==null);
      const questions:MockTest['questions']=[];
      const sections:MockTest['sections']=[];
      parts.forEach(part=>{
        const index=sections.length;
        const from=questions.length;
        part.questions.forEach(q=>questions.push({...q,section:index}));
        sections.push({name:part.name,from,to:questions.length});
      });
      if(!questions.length)throw new Error('No published practice questions found.');
      const test:MockTest={
        id:'custom-comp-practice',name:'Custom competitive practice',exam:'Competitive practice',
        kind:'topic',tier:'free',level:'Practice',
        minutes:Math.min(180,questions.length),questionCount:questions.length,
        marksPerCorrect:1,negativeMarks:0.25,sections,questions,
      };
      if(!disposed)setState({id:cacheId,test,error:''});
    }).catch(e=>{if(!disposed)setState({id:cacheId,test:null,error:e instanceof Error?e.message:'Could not load practice'});});
    return()=>{disposed=true;};
  },[raw]);
  const ids=raw.split(',').filter(Boolean);
  if(!ids.length||ids.length>4||new Set(ids).size!==ids.length||
     ids.some(id=>!/^topic-comp-[a-z0-9-]{1,60}$/.test(id)))
    return <div className="mx-auto max-w-xl p-6"><h1 className="text-xl font-bold">Invalid topic selection</h1><Link href="/exampro#builder" className="underline">Choose topics in ExamPro</Link></div>;
  if(state.id!==ids.join(','))return <p className="p-8 text-center" aria-busy="true">Loading your published practice topics…</p>;
  if(state.error)return <div className="mx-auto max-w-xl p-6" role="alert"><p>{state.error}</p><Link href="/exampro#builder" className="underline">Back to builder</Link></div>;
  if(!state.test)return <p className="p-8 text-center" aria-busy="true">Loading practice…</p>;
  return <div className="mx-auto max-w-6xl flex-1 px-4 py-6">
    <p className="mb-4 text-sm text-muted-foreground">Unscored practice — topic accuracy appears in your results. This is not a server-scored attempt.</p>
    <ExamEngine key={state.id} test={state.test} mode="practice"/>
  </div>;
}
export default function CustomCompetitivePracticePage(){
 return <><Header/><Suspense fallback={<p className="p-8">Loading…</p>}><Practice/></Suspense><Footer/></>;
}
