'use client';
import {useState} from 'react';
import {admin} from '@/lib/admin';

export function BetaInvitePanel(){
 const [email,setEmail]=useState('');
 const [hours,setHours]=useState(48);
 const [code,setCode]=useState('');
 const [message,setMessage]=useState('');
 const [working,setWorking]=useState(false);
 const create=async(e:React.FormEvent)=>{
  e.preventDefault();setWorking(true);setCode('');setMessage('');
  const result=await admin<{invitationCode:string;email:string;expiresInHours:number}>('/beta/invitations','POST',{email,hours});
  setWorking(false);
  if(result.ok){setCode(result.data.invitationCode);setMessage('Created for '+result.data.email+'. Copy and share privately; this code is shown once.');}
  else setMessage(result.message);
 };
 return <section className="space-y-3 rounded-xl border p-5" aria-label="Staging beta invitations">
  <h2 className="font-bold text-lg">Student beta invitations — staging only</h2>
  <p className="text-xs text-muted-foreground">Invitations are for verified Google/GitHub accounts. Creating one does not publish the mock or give admin access. Codes expire, are bound to a single email and must not be sent publicly.</p>
  <form onSubmit={create} className="flex flex-wrap items-end gap-3">
   <label className="text-sm">Student email<input type="email" required className="block rounded border p-2" value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <label className="text-sm">Expires after (hours)<input type="number" required min={1} max={168} className="block w-28 rounded border p-2" value={hours} onChange={e=>setHours(Number(e.target.value))}/></label>
   <button disabled={working} className="rounded bg-indigo-700 px-4 py-2 text-white disabled:opacity-50" type="submit">Create beta invite</button>
  </form>
  {message&&<p role="status" className="text-sm">{message}</p>}
  {code&&<div className="space-y-2 rounded border p-3">
   <label className="block text-xs font-medium">One-time display — private code</label>
   <code className="block break-all text-xs">{code}</code>
   <button type="button" className="rounded border px-3 py-2 text-sm" onClick={()=>void navigator.clipboard.writeText(code)}>Copy code</button>
   <p className="text-xs">Invitee signs in at /exampro/beta/mock-01 and redeems this code.</p>
  </div>}
 </section>;
}
