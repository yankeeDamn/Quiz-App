'use client';

import {useCallback,useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import {admin,type AdminGrant,type AdminUser,type GrantPreview} from '@/lib/admin';
import {CashfreeSandboxAudit} from '@/components/admin/cashfree-sandbox-audit';
import {Field,Notice,card,input} from '@/components/admin/ui';

const fmt=(d:string|null)=>(d?new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'–');
const initial={email:'',plan:'pro',months:'1',amountInr:'',reason:'manual_payment',note:''};
const showAudit=process.env.NEXT_PUBLIC_CASHFREE_SANDBOX_CHECKOUT==='true';

export function PlansTab(){
 const [q,setQ]=useState('');
 const [users,setUsers]=useState<AdminUser[]>([]);
 const [grants,setGrants]=useState<AdminGrant[]>([]);
 const [msg,setMsg]=useState<{kind:'ok'|'error';text:string}|null>(null);
 const [form,setForm]=useState(initial);
 const [review,setReview]=useState<GrantPreview|null>(null);
 const [requestId,setRequestId]=useState<string|null>(null);
 const [ackActive,setAckActive]=useState(false);
 const [ackCashfree,setAckCashfree]=useState(false);
 const [ackEvidence,setAckEvidence]=useState(false);
 const [busy,setBusy]=useState(false);

 const change=(patch:Partial<typeof initial>)=>{
  setForm(f=>({...f,...patch}));setReview(null);setRequestId(null);
  setAckActive(false);setAckCashfree(false);setAckEvidence(false);
 };
 const load=useCallback(async(term:string)=>{
  const [u,g]=await Promise.all([
   admin<{users:AdminUser[]}>(`/users?q=${encodeURIComponent(term)}`),
   admin<{grants:AdminGrant[]}>('/grants'),
  ]);
  if(u.ok)setUsers(u.data.users);
  if(g.ok)setGrants(g.data.grants);
  if(!u.ok)setMsg({kind:'error',text:u.message});
 },[]);
 useEffect(()=>{
  const timer=window.setTimeout(()=>void load(q),250);
  return ()=>window.clearTimeout(timer);
 },[q,load]);

 const preflight=async(e:React.FormEvent)=>{
  e.preventDefault();setMsg(null);setReview(null);setBusy(true);
  if(form.reason==='manual_payment'&&(!form.amountInr||Number(form.amountInr)<=0)){
   setMsg({kind:'error',text:'Enter the verified manual payment amount. Cashfree purchases should never be unlocked here.'});setBusy(false);return;
  }
  if(form.note.trim().length<8){
   setMsg({kind:'error',text:'Provide an 8-character minimum payment reference or complimentary access reason.'});setBusy(false);return;
  }
  const r=await admin<GrantPreview>(`/grant-preview?email=${encodeURIComponent(form.email.trim())}`);
  setBusy(false);
  if(r.ok){setReview(r.data);setRequestId(crypto.randomUUID());setAckActive(false);setAckCashfree(false);setAckEvidence(false);}
  else setMsg({kind:'error',text:r.message});
 };
 const confirm=async()=>{
  if(!review||!requestId||!ackEvidence||(review.active&&!ackActive)||(review.recentCashfree&&!ackCashfree))return;
  setBusy(true);setMsg(null);
  const r=await admin<{email:string;planExpiresAt:string;duplicate:boolean}>('/grant','POST',{
   email:review.email,plan:form.plan,months:Number(form.months),
   amountInr:form.reason==='complimentary'?0:Number(form.amountInr),
   reason:form.reason,note:form.note.trim(),requestId,
   expectedExpiresAt:review.planExpiresAt,
   acknowledgeActivePlan:ackActive||!review.active,
   acknowledgeRecentCashfree:ackCashfree||!review.recentCashfree,
  });
  setBusy(false);
  if(r.ok){
   setMsg({kind:'ok',text:r.data.duplicate?'This request was already processed; no additional months were added.':`Manual ${form.reason==='complimentary'?'complimentary':'payment'} grant saved until ${fmt(r.data.planExpiresAt)}.`});
   setReview(null);setRequestId(null);setForm(initial);void load(q);
  }else setMsg({kind:'error',text:r.message});
 };
 const revoke=async(email:string)=>{
  if(!window.confirm(`End the plan for ${email} now?`))return;
  const r=await admin('/revoke','POST',{email});
  setMsg(r.ok?{kind:'ok',text:`Plan ended for ${email}.`}:{kind:'error',text:r.message});
  void load(q);
 };
 const cashfree=grants.filter(g=>g.source==='cashfree_sandbox');
 const manual=grants.filter(g=>g.source!=='cashfree_sandbox');
 const grantTable=(rows:AdminGrant[],kind:'cashfree'|'manual')=>(
  <div className="overflow-x-auto"><table className="w-full text-sm">
   <thead><tr className="text-left text-xs uppercase text-muted-foreground">
    <th className="py-2 pr-3">When</th><th className="pr-3">Email</th><th className="pr-3">Source</th>
    <th className="pr-3">Plan</th><th className="pr-3">Months</th><th className="pr-3">₹</th><th>Reference</th>
   </tr></thead>
   <tbody>{rows.map((g,i)=><tr key={g.email+g.granted_at+i} className="border-t">
    <td className="py-2 pr-3 whitespace-nowrap">{fmt(g.granted_at)}</td>
    <td className="pr-3 break-all">{g.email}</td>
    <td className="pr-3 whitespace-nowrap">{g.source==='cashfree_sandbox'?'Verified gateway':g.source==='manual'?'Reviewed manual':'Legacy/manual'}</td>
    <td className="pr-3">{g.plan}</td><td className="pr-3">{g.months}</td><td className="pr-3">{g.amount_inr??'–'}</td>
    <td className="break-words">{g.note??'–'}</td>
   </tr>)}
   {rows.length===0&&<tr><td colSpan={7} className="py-3 text-muted-foreground">No {kind==='cashfree'?'Cashfree':'manual'} grants in the recent history.</td></tr>}
   </tbody></table></div>
 );
 return <div className="grid gap-6 lg:grid-cols-[minmax(0,390px)_minmax(0,1fr)]">
  <form onSubmit={preflight} className={`${card} grid h-fit gap-3`}>
   <h2 className="text-lg font-bold">Manual unlock or renewal</h2>
   <p className="text-sm text-muted-foreground">Only for separately verified manual payments or approved complimentary access. <strong>Cashfree orders grant Pro automatically.</strong></p>
   <Field label="Email of existing signed-in user">
    <input className={input} type="email" required value={form.email} onChange={e=>change({email:e.target.value})}/>
   </Field>
   <Field label="Reason">
    <select className={input} value={form.reason} onChange={e=>change({reason:e.target.value,amountInr:e.target.value==='complimentary'?'0':''})}>
     <option value="manual_payment">Payment received separately (not Cashfree)</option>
     <option value="complimentary">Complimentary / authorized goodwill access</option>
    </select>
   </Field>
   <div className="grid grid-cols-2 gap-3">
    <Field label="Plan"><select className={input} value={form.plan} onChange={e=>change({plan:e.target.value})}>
     <option value="pro">Pro</option><option value="institute">Institute</option>
    </select></Field>
    <Field label="Months"><input className={input} type="number" required min={1} max={36} value={form.months} onChange={e=>change({months:e.target.value})}/></Field>
   </div>
   <Field label="Amount received (₹)" hint={form.reason==='complimentary'?'Complimentary grants are recorded as ₹0.':'Required for a verified manual payment.'}>
    <input className={input} type="number" required min={0} disabled={form.reason==='complimentary'} value={form.amountInr} onChange={e=>change({amountInr:e.target.value})}/>
   </Field>
   <Field label="Payment reference / grant justification" hint="Required. Do not paste payment credentials.">
    <textarea className={input} rows={2} required minLength={8} maxLength={170} value={form.note} onChange={e=>change({note:e.target.value})}/>
   </Field>
   <Button disabled={busy} type="submit">{busy?'Checking account…':'Review manual grant'}</Button>
   {review&&<section className="space-y-3 rounded-lg border border-amber-500 p-3" aria-label="Manual grant confirmation">
    <h3 className="font-semibold">Confirm this separate manual grant</h3>
    <p className="text-sm"><strong>{review.email}</strong> · Current plan: {review.active?review.plan:'Free/expired'} · Ends: {fmt(review.planExpiresAt)}</p>
    {review.active&&<p className="text-sm text-amber-700 dark:text-amber-300">This account already has an active plan. The additional months will extend its existing expiry.</p>}
    {review.recentCashfree&&<p className="text-sm font-semibold text-red-600" role="alert">A Cashfree plan grant was recorded in the last 7 days. Do NOT unlock again for that Cashfree transaction.</p>}
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={ackEvidence} onChange={e=>setAckEvidence(e.target.checked)}/>
      I have independently verified this separate manual payment or complimentary authorization.
    </label>
    {review.active&&<label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={ackActive} onChange={e=>setAckActive(e.target.checked)}/>
      I understand this will extend an already-active subscription.
    </label>}
    {review.recentCashfree&&<label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={ackCashfree} onChange={e=>setAckCashfree(e.target.checked)}/>
      This is a separate authorized grant, not a duplicate of the recent Cashfree payment.
    </label>}
    <Button type="button" disabled={busy||!ackEvidence||(review.active&&!ackActive)||(review.recentCashfree&&!ackCashfree)}
     onClick={()=>void confirm()}>{busy?'Saving…':'Confirm manual grant'}</Button>
   </section>}
   {msg&&<Notice kind={msg.kind}>{msg.text}</Notice>}
  </form>
  <div className="grid min-w-0 gap-6">
   <section className={card}>
    <h2 className="text-lg font-bold">Find a user</h2>
    <input className={`${input} mt-3`} placeholder="Search by email" aria-label="Search users by email" value={q} onChange={e=>setQ(e.target.value)}/>
    <div className="mt-3 overflow-x-auto"><table className="w-full text-sm">
     <thead><tr className="text-left text-xs uppercase text-muted-foreground"><th className="py-1 pr-3">Email</th><th className="pr-3">Plan</th><th className="pr-3">Ends</th><th /></tr></thead>
     <tbody>{users.map(u=><tr key={u.email} className="border-t">
      <td className="py-2 pr-3 break-all">{u.email}</td>
      <td className="pr-3">{u.planActive?u.plan:'free'}</td><td className="pr-3 whitespace-nowrap">{u.planActive?fmt(u.plan_expires_at):'–'}</td>
      <td className="whitespace-nowrap text-right">
       <button type="button" className="mr-2 underline" onClick={()=>change({email:u.email})}>Review grant</button>
       {u.planActive&&<button type="button" className="text-red-600 underline" onClick={()=>void revoke(u.email)}>End plan</button>}
      </td>
     </tr>)}
     {users.length===0&&<tr><td colSpan={4} className="py-3 text-muted-foreground">No users found. Users appear here after signing in.</td></tr>}
     </tbody></table></div>
   </section>
   <section className={card}>
    <h2 className="text-lg font-bold">Cashfree — automatic grants</h2>
    <p className="mb-2 text-xs text-muted-foreground">Read-only source history. Never use manual unlock for these transactions.</p>
    {grantTable(cashfree,'cashfree')}
   </section>
   <section className={card}>
    <h2 className="text-lg font-bold">Manual and legacy grants</h2>
    <p className="mb-2 text-xs text-muted-foreground">Reviewed manual unlocks are separated from old records. Legacy entries may not have a structured payment reason.</p>
    {grantTable(manual,'manual')}
   </section>
   {showAudit&&<CashfreeSandboxAudit/>}
  </div>
 </div>;
}
