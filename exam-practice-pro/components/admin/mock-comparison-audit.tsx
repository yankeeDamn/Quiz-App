'use client';
import {useState} from 'react';
import {admin} from '@/lib/admin';
type Summary={id:string;expected:number;actual:number;academicApproved:number;hindiVerified:number;hindiRequired:number;stale:number;missingExplanation:string[];invalidAnswers:string[];complete:boolean};
type Pair={mock01Id:string;mock02Id:string;similarity?:number};
type Report={exact:Pair[];near:Pair[];nearCount:number;mocks:Summary[];structure:{id:string;valid:boolean;sections:number;draft:boolean|null}[];publication:{id:string;editorialReady?:boolean;technicalReady?:boolean;publicationBlocker?:string|null;error?:string}[];releaseAuthorized:boolean;limits:string};
export function MockComparisonAudit(){
 const [data,setData]=useState<Report|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const load=async()=>{setBusy(true);setError('');const r=await admin<Report>('/mock01-02/audit');setBusy(false);if(r.ok)setData(r.data);else setError(r.message);};
 return <section className="space-y-3 rounded-xl border p-5" aria-label="Mock 01 and 02 comparison audit">
  <h2 className="font-bold text-lg">Mock 01 vs Mock 02 — Read-only QA audit</h2>
  <p className="text-sm text-muted-foreground">Private staging reviewer report. No approval, import, activation or publication is possible here.</p>
  <button type="button" className="rounded border px-3 py-2 text-sm" disabled={busy} onClick={()=>void load()}>{busy?'Checking…':'Run read-only audit'}</button>
  {error&&<p role="alert" className="text-red-600">{error}</p>}
  {data&&<div className="space-y-3 text-sm">
   <p role="status" className="rounded border border-amber-400 p-3 font-semibold">Exact matches: {data.exact.length} · Possible near-duplicates: {data.nearCount}. Release authorized: No.</p>
   <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>Mock</th><th>Rows</th><th>Academic</th><th>Hindi</th><th>Stale</th><th>Explanation issues</th><th>Key issues</th></tr></thead><tbody>{data.mocks.map(m=><tr key={m.id} className="border-t"><td className="py-2">{m.id}</td><td>{m.actual}/{m.expected}</td><td>{m.academicApproved}/{m.expected}</td><td>{m.hindiVerified}/{m.hindiRequired}</td><td>{m.stale}</td><td>{m.missingExplanation.length}</td><td>{m.invalidAnswers.length}</td></tr>)}</tbody></table></div>
   <h3 className="font-semibold">Exam structure and release gates</h3>
   <ul className="list-disc pl-5">{data.structure.map(s=><li key={s.id}>{s.id}: {s.valid?'Four-section structure valid':'Structure needs review'} · {s.draft===true?'Draft':s.draft===false?'Active':'Missing'}</li>)}</ul>
   <ul className="list-disc pl-5">{data.publication.map(p=><li key={p.id}>{p.id}: {p.error||p.publicationBlocker||'No recorded technical blocker'} · Editorial readiness: {p.editorialReady?'Yes':'No'}</li>)}</ul>
   <h3 className="font-semibold">Exact match question IDs</h3>
   <ul className="max-h-32 overflow-y-auto text-xs">{data.exact.map((m,i)=><li key={i}>{m.mock01Id} ↔ {m.mock02Id}</li>)}</ul>
   <h3 className="font-semibold">Potential near-duplicates (first 100)</h3>
   <ul className="max-h-40 overflow-y-auto text-xs">{data.near.map((m,i)=><li key={i}>{m.mock01Id} ↔ {m.mock02Id} · {(100*(m.similarity||0)).toFixed(1)}% token overlap</li>)}</ul>
   <p className="text-xs text-muted-foreground">{data.limits}</p>
  </div>}
 </section>;
}
