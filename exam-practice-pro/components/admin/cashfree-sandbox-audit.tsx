'use client';
import {useState} from 'react';
import {admin} from '@/lib/admin';
type Order={id:string;plan:string;billing_period:string;amount_inr:number;status:string;created_at:string;paid_at:string|null;granted_at:string|null};
type Event={order_id:string;event_type:string;outcome:string;created_at:string};
export function CashfreeSandboxAudit(){
 const [orders,setOrders]=useState<Order[]>([]),[events,setEvents]=useState<Event[]>([]);
 const [error,setError]=useState(''),[loading,setLoading]=useState(false),[loaded,setLoaded]=useState(false);
 const refresh=async()=>{
  setLoading(true);setError('');
  const r=await admin<{orders:Order[];events:Event[]}>('/cashfree/sandbox-audit');
  setLoading(false);setLoaded(true);
  if(r.ok){setOrders(r.data.orders);setEvents(r.data.events);}else setError(r.message);
 };
 return <section aria-label="Cashfree sandbox audit" className="space-y-3 rounded-xl border p-5">
  <h2 className="text-lg font-semibold">Cashfree sandbox payment audit</h2>
  <p className="text-xs text-muted-foreground">Read-only staging records. No live charges, refunds or manual paid-status overrides are supported here.</p>
  <button type="button" className="rounded border px-3 py-2 text-sm" disabled={loading} onClick={()=>void refresh()}>{loading?'Loading…':'Refresh sandbox payment audit'}</button>
  {error&&<p role="alert" className="text-red-600">{error}</p>}
  {loaded&&<><h3 className="font-semibold text-sm">Orders ({orders.length})</h3>
   <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th>ID</th><th>Plan</th><th>Amount</th><th>Status</th><th>Granted</th></tr></thead><tbody>{orders.map(o=><tr className="border-t" key={o.id}><td className="p-2 break-all">{o.id}</td><td className="p-2">{o.billing_period}</td><td className="p-2">₹{o.amount_inr}</td><td className="p-2">{o.status}</td><td className="p-2">{o.granted_at?'Yes':'No'}</td></tr>)}</tbody></table></div>
   <h3 className="font-semibold text-sm">Verified webhook activity ({events.length})</h3>
   <ul className="max-h-64 overflow-y-auto text-xs space-y-1">{events.map((e,i)=><li className="border-b p-2" key={e.order_id+i}>{e.event_type} · {e.outcome} · {new Date(e.created_at).toLocaleString('en-IN')}</li>)}</ul>
  </>}
 </section>;
}
