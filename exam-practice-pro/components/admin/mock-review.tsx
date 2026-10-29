'use client';

import {useCallback,useEffect,useState} from 'react';
import {admin} from '@/lib/admin';
import {api} from '@/lib/api';

type Status='pending'|'approved'|'changes_required';
type HindiStatus='pending'|'verified'|'changes_required'|'not_required';
type Entry={
 id:string;topicId:string;position:number;question:string;options:string[];
 answer:number;explanation:string;difficulty:string;hindiRequired:boolean;stale:boolean;
 academicStatus:Status;academicReviewer:string|null;academicNotes:string;
 hindiStatus:HindiStatus;hindiQuestion:string;hindiOptions:string[];hindiExplanation:string;hindiReviewer:string|null;
};
type Report={
 name:string;draft:boolean;expected:number;actual:number;academicApproved:number;
 hindiRequired:number;hindiVerified:number;ready:boolean;entries:Entry[];
};
type Edit={
 academicStatus:Status;academicNotes:string;hindiStatus:HindiStatus;
 hindiQuestion:string;hindiOptions:string[];hindiExplanation:string;
};
const input='w-full min-h-10 rounded-lg border bg-background p-2 text-sm';
const statusText=(entry:Entry)=>entry.stale?'Source changed: review again':entry.academicStatus;

export function MockReview({testId,onClose}:{testId:string;onClose:()=>void}) {
 const [report,setReport]=useState<Report|null>(null);
 const [selectedId,setSelectedId]=useState<string>('');
 const [edit,setEdit]=useState<Edit|null>(null);
 const [search,setSearch]=useState('');
 const [saving,setSaving]=useState(false);
 const [translating,setTranslating]=useState(false);
 const [message,setMessage]=useState('');
 const [email,setEmail]=useState('');
 const [eligibilityChecked,setEligibilityChecked]=useState(false);
 const load=useCallback(async()=>{
  const r=await admin<Report>(`/tests/${encodeURIComponent(testId)}/reviews`);
  if(!r.ok){setMessage(r.message);return;}
  setReport(r.data);
  setSelectedId(old=>r.data.entries.some(e=>e.id===old)?old:r.data.entries[0]?.id||'');
 },[testId]);
 useEffect(()=>{void load()},[load]);
 const entry=report?.entries.find(e=>e.id===selectedId);
 useEffect(()=>{
  if(!entry){setEdit(null);return}
  setEdit({
   academicStatus:entry.academicStatus,academicNotes:entry.academicNotes,
   hindiStatus:entry.hindiStatus,hindiQuestion:entry.hindiQuestion,
   hindiOptions:[...entry.hindiOptions],hindiExplanation:entry.hindiExplanation,
  });
 },[selectedId,entry?.id,entry?.academicStatus,entry?.hindiStatus]);
 const save=async()=>{
  if(!entry||!edit)return;
  setSaving(true);setMessage('');
  const r=await admin(`/tests/${encodeURIComponent(testId)}/reviews/${entry.id}`,'PUT',edit);
  setSaving(false);
  if(!r.ok){setMessage(r.message);return}
  setMessage('Review recorded. Only the signed-in reviewer receives credit; content changes invalidate approvals.');
  await load();
 };
 const translateDraft=async()=>{
  if(!entry||!edit||!entry.hindiRequired||!report?.draft)return;
  const questionId=entry.id;
  setMessage('');setTranslating(true);
  const r=await api<{texts:string[]}>('/api/v1/exampro/translate-exam',{
    method:'POST',body:{language:'hi',texts:[entry.question,...entry.options,entry.explanation]},
  });
  setTranslating(false);
  if(!r.success||!r.data||r.data.texts.length!==6){
    setMessage(r.error?.message||'Azure Translator is unavailable. Check staging Render configuration.');return;
  }
  if(selectedId!==questionId)return;
  const translated=r.data.texts;
  setEdit(old=>old?{...old,
    hindiStatus:'pending',hindiQuestion:translated[0],
    hindiOptions:translated.slice(1,5),hindiExplanation:translated[5],
  }:old);
  setMessage('Azure filled a Hindi DRAFT only. Review all six fields with a qualified bilingual reviewer. It is NOT saved or verified.');
 };
 const setAccommodation=async(approved:boolean)=>{
  if(!email.trim()){setMessage('Enter the candidate sign-in email.');return}
  setSaving(true);setMessage('');
  const r=await admin(`/tests/${encodeURIComponent(testId)}/accommodations`,'PUT',{
    email,approved,eligibilityChecked,
  });
  setSaving(false);
  setMessage(r.ok
   ?(approved?'20-minute sections approved for future attempts. Existing attempts retain their original deadlines.':'Accommodation revoked for future attempts.')
   :r.message);
 };
 const found=report?.entries.filter(x=>x.question.toLowerCase().includes(search.toLowerCase())||x.topicId.includes(search.toLowerCase()))||[];
 return <section className="space-y-5 rounded-xl border bg-card p-5" aria-label="Academic and Hindi question review">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div><h2 className="text-xl font-bold">Human review · {report?.name||testId}</h2>
    <p className="mt-1 text-sm text-muted-foreground">Academic approval and Hindi verification are independent review steps. Prior AI desk audits are not signed approval.</p>
   </div>
   <button type="button" className="rounded-lg border px-4 py-2" onClick={onClose}>Close review</button>
  </div>
  {message&&<p role="status" className="rounded-lg border border-amber-400 p-3 text-sm">{message}</p>}
  {report&&<div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-3" aria-live="polite">
   <p><strong>{report.academicApproved}/{report.expected}</strong> academic approvals</p>
   <p><strong>{report.hindiVerified}/{report.hindiRequired}</strong> Hindi verified (English excluded)</p>
   <p className="font-semibold">{report.ready?'All recorded checks complete — independent sign-off still required':'Release blocked · review incomplete'}</p>
  </div>}
  <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
   <aside className="space-y-2">
    <label className="block text-sm font-semibold" htmlFor="review-search">Find a question</label>
    <input id="review-search" className={input} placeholder="Topic or question text" value={search} onChange={e=>setSearch(e.target.value)}/>
    <div className="max-h-96 space-y-1 overflow-y-auto rounded-lg border p-2" role="group" aria-label="Questions to review">
     {found.map(q=><button type="button" key={q.id} onClick={()=>setSelectedId(q.id)}
      aria-pressed={selectedId===q.id}
      className={`block w-full rounded-lg px-3 py-2 text-left text-xs focus-visible:outline-2 focus-visible:outline-indigo-600 ${selectedId===q.id?'bg-indigo-100 text-indigo-950 dark:bg-indigo-950 dark:text-white':'hover:bg-muted'}`}>
      <span className="font-semibold">{q.topicId.replace('ssc26-m01-','')} #{q.position+1}</span>
      <span className="mt-1 block truncate">{statusText(q)}</span>
     </button>)}
    </div>
   </aside>
   {entry&&edit&&<div className="space-y-4">
    <h3 className="text-lg font-semibold">{entry.topicId} · Question {entry.position+1}</h3>
    {entry.stale&&<p role="alert" className="text-sm font-semibold text-red-600">Question text/key changed since review; prior approvals are no longer valid.</p>}
    <div className="space-y-2 rounded-lg border p-3">
     <p className="font-semibold">{entry.question}</p>
     <ol className="list-inside list-[upper-alpha] text-sm">{entry.options.map((o,i)=><li key={i}>{o}{i===entry.answer?' ✓ Key':''}</li>)}</ol>
     <p className="text-sm"><strong>Explanation:</strong> {entry.explanation}</p>
    </div>
    <label className="block text-sm font-semibold">Academic review status
     <select className={input} value={edit.academicStatus} onChange={e=>setEdit({...edit,academicStatus:e.target.value as Status})}>
      <option value="pending">Pending independent review</option>
      <option value="changes_required">Changes required</option>
      <option value="approved">Approved by me (human reviewer)</option>
     </select>
    </label>
    <label className="block text-sm font-semibold">Reviewer notes / evidence
     <textarea className={input} rows={3} value={edit.academicNotes} onChange={e=>setEdit({...edit,academicNotes:e.target.value})}/>
    </label>
    {entry.hindiRequired ? <>
     <h4 className="font-semibold">Hindi translation verification · required</h4>
     <div className="rounded-lg border border-indigo-300 p-3">
      <button type="button" disabled={saving||translating||!report?.draft}
       className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
       onClick={()=>void translateDraft()}>{translating?'Translating with Azure…':'Generate Hindi draft with Azure'}</button>
      <p className="mt-2 text-xs text-muted-foreground">Fills question, four choices and explanation without a translation database. This is editable machine output, not human verification; approval stays Pending until independently checked.</p>
     </div>
     <p className="text-xs text-muted-foreground">Enter and proofread the complete Hindi version manually. Do not mark verified from an automatic translation alone.</p>
     <label className="block text-sm font-semibold">Hindi question
      <textarea lang="hi" className={input} rows={2} value={edit.hindiQuestion} onChange={e=>setEdit({...edit,hindiQuestion:e.target.value})}/>
     </label>
     {edit.hindiOptions.map((o,i)=><label key={i} className="block text-sm font-semibold">Hindi choice {String.fromCharCode(65+i)}
      <input lang="hi" className={input} value={o} onChange={e=>setEdit({...edit,hindiOptions:edit.hindiOptions.map((v,j)=>i===j?e.target.value:v)})}/>
     </label>)}
     <label className="block text-sm font-semibold">Hindi explanation
      <textarea lang="hi" className={input} rows={2} value={edit.hindiExplanation} onChange={e=>setEdit({...edit,hindiExplanation:e.target.value})}/>
     </label>
     <label className="block text-sm font-semibold">Hindi verification
      <select className={input} value={edit.hindiStatus} onChange={e=>setEdit({...edit,hindiStatus:e.target.value as HindiStatus})}>
       <option value="pending">Pending</option><option value="changes_required">Needs correction</option>
       <option value="verified">Verified against English by human reviewer</option>
      </select>
     </label>
    </> : <p className="text-sm text-muted-foreground">English Comprehension: Hindi translation is not required by the SSC notice.</p>}
    <button className="rounded-lg bg-indigo-700 px-5 py-3 font-semibold text-white disabled:opacity-50" type="button" disabled={saving||!report?.draft} onClick={()=>void save()}>
     {saving?'Saving…':'Save reviewed status'}
    </button>
   </div>}
  </div>
  <fieldset className="space-y-3 rounded-lg border p-4">
   <legend className="px-2 font-semibold">Staging-only compensatory timing approval</legend>
   <p className="text-sm text-muted-foreground">For an independently verified eligible account, approve four 20-minute sections (80 minutes total). Never store disability certificates or medical details in ExamPro. A candidate cannot self-approve.</p>
   <label className="block text-sm font-semibold">Candidate Google/GitHub sign-in email
    <input className={input} type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="candidate@example.com"/>
   </label>
   <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={eligibilityChecked} onChange={e=>setEligibilityChecked(e.target.checked)}/>
     I have verified this account's eligibility outside ExamPro under the applicable SSC rules.
   </label>
   <div className="flex flex-wrap gap-2">
    <button type="button" className="rounded-lg bg-indigo-700 px-4 py-2 font-semibold text-white disabled:opacity-50" disabled={!eligibilityChecked||saving} onClick={()=>void setAccommodation(true)}>Approve 20-min sections</button>
    <button type="button" className="rounded-lg border px-4 py-2 disabled:opacity-50" disabled={saving} onClick={()=>void setAccommodation(false)}>Revoke for future attempts</button>
   </div>
  </fieldset>
 </section>;
}
