'use client';

import {useCallback,useEffect,useState} from 'react';
import {admin} from '@/lib/admin';

type Check={id:string;label:string;passed:boolean};
type ReleaseReport={
 testId:string;name:string;draft:boolean;
 academic:{approved:number;required:number};
 hindi:{verified:number;required:number};
 questions:{expected:number;actual:number;missing:number;stale:number};
 editorialReady:boolean;technicalReady:boolean;humanSignoffRequired:boolean;
 publicationPerformed:boolean;checks:Check[];publicationBlocker:string|null;
 sections:{topicId:string;questions:number;academicApproved:number;hindiRequired:number;hindiVerified:number;stale:number}[];
};

export function MockReleaseReadiness({testId,onClose}:{testId:string;onClose:()=>void}){
 const [report,setReport]=useState<ReleaseReport|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 const refresh=useCallback(async()=>{
  setLoading(true);setError('');
  const result=await admin<ReleaseReport>('/tests/'+encodeURIComponent(testId)+'/release-readiness');
  if(result.ok)setReport(result.data);else setError(result.message);
  setLoading(false);
 },[testId]);
 useEffect(()=>{void refresh()},[refresh]);
 return <section aria-label="Mock release readiness" className="rounded-xl border bg-card p-5 space-y-4">
  <div className="flex flex-wrap justify-between gap-3 items-center">
   <div><h2 className="text-xl font-bold">Release readiness · {report?.name||testId}</h2>
    <p className="text-sm text-muted-foreground">Read-only report. This screen cannot approve questions, activate topics or publish a mock.</p></div>
   <div className="flex gap-2">
    <button type="button" className="rounded border px-3 py-2 text-sm" disabled={loading} onClick={()=>void refresh()}>Refresh</button>
    <button type="button" className="rounded border px-3 py-2 text-sm" onClick={onClose}>Close</button>
   </div>
  </div>
  {loading&&<p role="status">Checking existing release gates…</p>}
  {error&&<p role="alert" className="text-red-600">{error}</p>}
  {report&&<div className="space-y-4">
    <p role="status" className="rounded border border-amber-400 p-3 text-sm font-semibold">
      {report.draft?'Draft · unpublished':'Recorded as published'} · {report.technicalReady?'Technical checks passed':'Release checks incomplete'} · Independent security, accessibility, beta and owner approval still required
    </p>
    <div className="grid gap-3 sm:grid-cols-3">
     <p className="rounded border p-3"><strong className="text-xl tabular-nums">{report.academic.approved}/{report.academic.required}</strong><span className="block text-sm">Academic approvals</span></p>
     <p className="rounded border p-3"><strong className="text-xl tabular-nums">{report.hindi.verified}/{report.hindi.required}</strong><span className="block text-sm">Human-verified Hindi</span></p>
     <p className="rounded border p-3"><strong className="text-xl tabular-nums">{report.questions.actual}/{report.questions.expected}</strong><span className="block text-sm">Question rows · {report.questions.stale} stale reviews</span></p>
    </div>
    <div className="overflow-x-auto">
     <h3 className="mb-2 text-sm font-semibold">Section-by-section review progress</h3>
     <table className="w-full min-w-[480px] text-left text-sm">
      <thead><tr><th className="p-2">Topic</th><th className="p-2">Questions</th><th className="p-2">Academic</th><th className="p-2">Hindi</th><th className="p-2">Stale</th></tr></thead>
      <tbody>{(report.sections||[]).map(group=><tr key={group.topicId} className="border-t">
       <td className="p-2">{group.topicId}</td><td className="p-2 tabular-nums">{group.questions}</td>
       <td className="p-2 tabular-nums">{group.academicApproved}/{group.questions}</td>
       <td className="p-2 tabular-nums">{group.hindiVerified}/{group.hindiRequired}</td>
       <td className="p-2 tabular-nums">{group.stale}</td>
      </tr>)}</tbody>
     </table>
    </div>
    <ul className="space-y-2 text-sm">{report.checks.map(check=><li key={check.id} className="flex gap-2">
      <span aria-label={check.passed?'Passed':'Blocked'}>{check.passed?'✓':'✕'}</span><span>{check.label}</span>
    </li>)}</ul>
    {report.publicationBlocker&&<p className="text-sm text-amber-700 dark:text-amber-300" role="status">Publication gate: {report.publicationBlocker}</p>}
    <p className="text-xs text-muted-foreground">This summary is evidence, not a publish authorization. Complete the separate student beta checklist and independent human signoff.</p>
   </div>}
 </section>;
}
