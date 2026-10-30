'use client';
import {useState} from 'react';
import {admin} from '@/lib/admin';
type Feedback={id:string;category:string;severity:string;comment:string;status:string;created_at:string};
type Event={action:string;created_at:string;invitation_id:string|null;actor_email:string|null};
type Signoff={draft:boolean;academic:{approved:number;required:number};hindi:{verified:number;required:number};beta:{feedbackCount:number;openHighSeverity:number;auditEvents:number};releaseAuthorized:boolean;publicationBlocker:string|null};
export function BetaFeedbackDashboard(){
 const [feedback,setFeedback]=useState<Feedback[]>([]);
 const [audit,setAudit]=useState<Event[]>([]);
 const [report,setReport]=useState<Signoff|null>(null);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(false);
 const refresh=async()=>{
  setLoading(true);setError('');
  const [f,a,s]=await Promise.all([admin<{feedback:Feedback[]}>('/beta/feedback'),admin<{events:Event[]}>('/beta/audit'),admin<Signoff>('/beta/release-signoff/ssc-cgl-2026-mock-01')]);
  setLoading(false);
  if(!f.ok||!a.ok||!s.ok){setError([!f.ok&&f.message,!a.ok&&a.message,!s.ok&&s.message].filter(Boolean).join('; '));return;}
  setFeedback(f.data.feedback);setAudit(a.data.events);setReport(s.data);
 };
 const update=async(id:string,status:string)=>{
  const r=await admin('/beta/feedback/'+encodeURIComponent(id)+'/status','PUT',{status});
  if(r.ok)await refresh();else setError(r.message);
 };
 return <section className="space-y-3 rounded-xl border p-5" aria-label="Mock 01 beta release signoff">
  <div className="flex items-center justify-between gap-2"><h2 className="text-lg font-bold">Beta feedback &amp; release sign-off</h2><button className="rounded border px-3 py-2 text-sm" onClick={()=>void refresh()} disabled={loading}>Load / refresh</button></div>
  <p className="text-xs text-muted-foreground">Staging only. No publish or approval action is available here.</p>
  {error&&<p role="alert">{error}</p>}
  {report&&<div className="rounded border p-3 text-sm" role="status">Academic {report.academic.approved}/{report.academic.required} · Human Hindi {report.hindi.verified}/{report.hindi.required} · Unresolved high-severity feedback {report.beta.openHighSeverity} · Release authorized: <strong>No</strong>{report.publicationBlocker&&<p className="mt-2">Publication blocker: {report.publicationBlocker}</p>}</div>}
  <h3 className="font-semibold">Feedback ({feedback.length} most recent)</h3>
  <ul className="space-y-2">{feedback.map(f=><li key={f.id} className="rounded border p-3 text-sm">
   <p className="font-semibold">{f.category} · {f.severity} · {f.status}</p><p className="my-2 whitespace-pre-wrap break-words">{f.comment}</p>
   <label>Review status <select className="ml-2 rounded border p-2" value={f.status} onChange={e=>void update(f.id,e.target.value)}>{['open','triaged','resolved'].map(s=><option key={s}>{s}</option>)}</select></label>
  </li>)}</ul>
  <h3 className="font-semibold">Invitation activity ({audit.length} most recent)</h3>
  <ul className="space-y-1 text-xs">{audit.map((e,i)=><li key={i} className="border-b py-1">{e.action} · {new Date(e.created_at).toLocaleString()} · {e.actor_email||'system'}</li>)}</ul>
 </section>;
}
