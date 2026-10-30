'use client';
import {useState} from 'react';
import {api} from '@/lib/api';
export function BetaFeedback(){
 const [category,setCategory]=useState('translation');
 const [severity,setSeverity]=useState('medium');
 const [comment,setComment]=useState('');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const send=async(e:React.FormEvent)=>{
  e.preventDefault();setBusy(true);setMessage('');
  const r=await api('/api/v1/beta/feedback',{method:'POST',body:{category,severity,comment}});
  setBusy(false);setMessage(r.success?'Feedback sent to the staging QA team. Thank you.':r.error?.message||'Unable to send feedback.');
  if(r.success)setComment('');
 };
 return <form onSubmit={send} className="space-y-3 rounded-xl border p-4" aria-label="Beta feedback">
  <h2 className="font-semibold">Report a beta issue</h2>
  <p className="text-xs text-muted-foreground">Do not include passwords, exam answers or personal medical data.</p>
  <div className="flex flex-wrap gap-3">
   <label className="text-sm">Category<select className="ml-2 rounded border p-2" value={category} onChange={e=>setCategory(e.target.value)}>{['translation','timing','scoring','navigation','accessibility','other'].map(x=><option key={x} value={x}>{x}</option>)}</select></label>
   <label className="text-sm">Impact<select className="ml-2 rounded border p-2" value={severity} onChange={e=>setSeverity(e.target.value)}>{['low','medium','high'].map(x=><option key={x}>{x}</option>)}</select></label>
  </div>
  <label className="block text-sm">Description<textarea required minLength={10} maxLength={1500} value={comment} onChange={e=>setComment(e.target.value)} className="mt-1 block w-full rounded border p-2" rows={3}/></label>
  <button disabled={busy} className="rounded bg-indigo-700 px-4 py-2 text-white disabled:opacity-50" type="submit">Submit feedback</button>
  {message&&<p role="status" className="text-sm">{message}</p>}
 </form>;
}
