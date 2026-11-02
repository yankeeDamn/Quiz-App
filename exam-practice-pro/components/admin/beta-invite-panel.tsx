'use client';
import {useState} from 'react';
import {admin} from '@/lib/admin';
import {card,input} from './ui';
import {copyUrl} from '@/lib/mobile-share';

export function BetaInvitePanel(){
 const [expiresAt,setExpiresAt]=useState<string|null>(null);
 const [email,setEmail]=useState('');
 const [hours,setHours]=useState(48);
 const [code,setCode]=useState('');
 const [invitationId,setInvitationId]=useState('');
 const [message,setMessage]=useState('');
 const [working,setWorking]=useState(false);
 const create=async(e:React.FormEvent)=>{
  e.preventDefault();setWorking(true);setCode('');setMessage('');
  const result=await admin<{invitationId:string;invitationCode:string;email:string;expiresInHours:number}>('/beta/invitations','POST',{email,hours});
  setWorking(false);
  if(result.ok){setExpiresAt(new Date(Date.now()+result.data.expiresInHours*3600000).toISOString());setInvitationId(result.data.invitationId);setCode(result.data.invitationCode);setMessage('Created for '+result.data.email+'. Copy and share privately; this code is shown once.');}
  else setMessage(result.message);
 };
 return <section className={`${card} space-y-4`} aria-label="Staging beta invitations">
  <h2 className="font-bold text-lg">Student beta invitations — staging only</h2>
  <p className="text-xs text-muted-foreground">Invitations are for verified Google/GitHub accounts. Creating one does not publish the mock or give admin access. Codes expire, are bound to a single email and must not be sent publicly.</p>
  <form onSubmit={create} className="flex flex-wrap items-end gap-3">
   <label className="text-sm">Student email<input type="email" required className={input} value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <label className="text-sm">Expires after (hours)<input type="number" required min={1} max={168} className={`${input} max-w-32`} value={hours} onChange={e=>setHours(Number(e.target.value))}/></label>
   <button disabled={working} className="rounded bg-indigo-700 px-4 py-2 text-white disabled:opacity-50" type="submit">Create beta invite</button>
  </form>
  {message&&<p role="status" className="text-sm">{message}</p>}
  {code&&<div className="space-y-3 rounded-xl border bg-indigo-50/40 p-4 dark:bg-indigo-950/30">
   {expiresAt&&<p className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">Expires {new Date(expiresAt).toLocaleString('en-IN')}</p>}
   <label className="block text-xs font-medium">One-time display — private code</label>
   <code className="block break-all text-xs">{code}</code>
   <p className="text-xs">Invitation ID (for revocation): <code>{invitationId}</code></p>
   <button type="button" className="rounded border px-3 py-2 text-sm" onClick={async()=>{setMessage(await copyUrl(code)?'Private code copied.':'Copy the code shown above manually.');}}>Copy code</button>
   <button type="button" className="ml-2 rounded border px-3 py-2 text-sm" onClick={async()=>{setMessage(await copyUrl(new URL('/exampro/beta/mock-01',window.location.origin).toString())?'Beta sign-in link copied. Share the private code separately.':'Copy /exampro/beta/mock-01 manually.');}}>Copy beta sign-in link</button><p className="text-xs">Share the sign-in link and private code with the intended learner.</p>
   <button type="button" className="rounded border px-3 py-2 text-sm" onClick={async()=>{
    if(!window.confirm('Revoke this invitation immediately?'))return;
    const result=await admin('/beta/invitations/'+encodeURIComponent(invitationId)+'/revoke','POST');
    setMessage(result.ok?'Invitation revoked.':'Unable to revoke: '+result.message);
    if(result.ok){setCode('');setInvitationId('');}
   }}>Revoke this invitation</button>
  </div>}
 </section>;
}
