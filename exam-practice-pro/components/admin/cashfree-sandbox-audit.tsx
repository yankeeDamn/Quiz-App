'use client';
import { useState } from 'react';
import { CreditCard, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { admin } from '@/lib/admin';
import { card } from './ui';
type Order={id:string;plan:string;billing_period:string;amount_inr:number;status:string;created_at:string;paid_at:string|null;granted_at:string|null};
type Event={order_id:string;event_type:string;outcome:string;created_at:string};
const tint=(status:string)=>status==='paid'?'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200':status==='failed'||status==='expired'?'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200':'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200';
export function CashfreeSandboxAudit(){
 const [orders,setOrders]=useState<Order[]>([]),[events,setEvents]=useState<Event[]>([]);
 const [error,setError]=useState(''),[loading,setLoading]=useState(false),[loaded,setLoaded]=useState(false);
 const refresh=async()=>{
  setLoading(true);setError('');
  const r=await admin<{orders:Order[];events:Event[]}>('/cashfree/sandbox-audit');
  setLoading(false);
  if(r.ok){setOrders(r.data.orders);setEvents(r.data.events);setLoaded(true);}else setError(r.message);
 };
 return <section aria-label="Cashfree sandbox audit" className="space-y-5">
  <div className={`${card} flex flex-wrap items-center justify-between gap-4`}><div><span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900 dark:bg-amber-950 dark:text-amber-200">SANDBOX · TEST TRANSACTIONS</span><h2 className="mt-3 text-xl font-bold">Cashfree payment audit</h2><p className="mt-2 max-w-xl text-sm text-muted-foreground">Read-only staging records. Refresh loads recorded order and webhook status; payment verification and grants use the existing signed webhook flow.</p></div><Button variant="outline" disabled={loading} onClick={()=>void refresh()}><RefreshCw className={`h-4 w-4 ${loading?'animate-spin':''}`}/>{loading?'Loading…':'Refresh Sandbox Status'}</Button></div>
  {error&&<p role="alert" className="rounded-xl border border-amber-300 p-4 text-sm">{error}</p>}
  {loaded&&<>
   <div className="grid gap-3 sm:grid-cols-3">{[['Paid',orders.filter(o=>o.status==='paid').length],['Pending',orders.filter(o=>['initiated','pending'].includes(o.status)).length],['Failed / expired',orders.filter(o=>['failed','expired'].includes(o.status)).length]].map(([label,count])=><div className={card} key={label}><p className="text-2xl font-bold tabular-nums">{count}</p><p className="mt-1 text-xs text-muted-foreground">{label} · latest {orders.length} orders</p></div>)}</div>
   <div className="grid gap-4 md:grid-cols-2">{orders.map(o=><article key={o.id} className={card}><div className="flex items-center justify-between gap-3"><CreditCard className="h-5 w-5 text-indigo-500"/><span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase ${tint(o.status)}`}>{o.status}</span></div><h3 className="mt-4 text-xl font-bold">₹{o.amount_inr.toLocaleString('en-IN')} <span className="text-xs font-normal text-muted-foreground">/ {o.billing_period} · sandbox</span></h3><p className="mt-2 break-all font-mono text-xs text-muted-foreground">{o.id}</p><p className="mt-3 text-xs">Plan grant: <strong>{o.granted_at?'Recorded':'Not recorded'}</strong> · {new Date(o.created_at).toLocaleString('en-IN')}</p></article>)}</div>
   {orders.length===0&&<p className={card}>No sandbox orders recorded.</p>}
   <section className={card}><h3 className="font-bold">Verified webhook activity</h3><div className="mt-3 max-h-80 divide-y overflow-y-auto">{events.map((e,i)=><div className="py-3 text-xs" key={e.order_id+i}><p className="font-semibold">{e.event_type}<span className="ml-2 rounded-full bg-muted px-2 py-1">{e.outcome}</span></p><p className="mt-2 text-muted-foreground">{e.order_id} · {new Date(e.created_at).toLocaleString('en-IN')}</p></div>)}{events.length===0&&<p className="py-4 text-sm text-muted-foreground">No verified webhook activity recorded.</p>}</div></section>
  </>}
 </section>;
}
