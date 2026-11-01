'use client';
import {useEffect,useState} from 'react';
import Script from 'next/script';
import {api} from '@/lib/api';

type Row={id:string;billing_period:string;amount_inr:number;status:string;created_at:string};
type Checkout={orderId:string;paymentSessionId:string;mode:'sandbox';amountInr:number};
type OrderStatus={orderId:string;status:string;paid:boolean;amountInr:number;billingPeriod:string;paidAt:string|null};
declare global{interface Window{Cashfree?: (args:{mode:'sandbox'})=>{checkout:(args:{paymentSessionId:string;redirectTarget:'_self'})=>Promise<unknown>}}}
export function CashfreeSandboxCheckout({period}:{period:'monthly'|'yearly'}){
 const [phone,setPhone]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [ready,setReady]=useState(false),[history,setHistory]=useState<Row[]>([]);
 const [returnResult,setReturnResult]=useState<string>('');
 const refresh=async()=>{const r=await api<{orders:Row[]}>('/api/v1/cashfree/orders');if(r.success)setHistory(r.data?.orders||[]);};
 useEffect(()=>{void refresh();},[]);
 // After Cashfree redirects back (?cashfree_return=1&order_id=...), never trust the
 // browser callback: reconcile the order against the server, which only marks paid
 // after a verified signed webhook plus an independent Cashfree order check.
 useEffect(()=>{
  if(typeof window==='undefined')return;
  const params=new URLSearchParams(window.location.search);
  if(params.get('cashfree_return')!=='1')return;
  const orderId=params.get('order_id')||'';
  let cancelled=false;
  const reconcile=async(attempt:number)=>{
   const r=await api<OrderStatus>('/api/v1/cashfree/orders/'+encodeURIComponent(orderId)+'/status');
   if(cancelled)return;
   if(r.success&&r.data?.paid){
    setReturnResult('Payment confirmed by the server. Your Pro plan is active.');
    void refresh();return;
   }
   if(attempt<3){window.setTimeout(()=>void reconcile(attempt+1),2000);return;}
   setReturnResult(r.success
    ?'Payment is not confirmed yet. If the amount was debited, it unlocks automatically after verification — check payment history shortly.'
    :'We could not verify this order. Check payment history or contact support.');
   void refresh();
  };
  if(/^[A-Za-z0-9_]+$/.test(orderId)){
   void reconcile(0).then(()=>{
    if(!cancelled)window.history.replaceState(null,'',window.location.pathname);
   });
  }else window.history.replaceState(null,'',window.location.pathname);
  return()=>{cancelled=true;};
 },[]);
 const start=async()=>{
  setBusy(true);setError('');
  try{
   const r=await api<Checkout>('/api/v1/cashfree/orders',{method:'POST',body:{period,phone}});
   if(!r.success||!r.data?.paymentSessionId){setError(r.error?.message||'Sandbox order creation failed.');return;}
   if(!window.Cashfree){setError('Cashfree sandbox checkout is not loaded. Please refresh.');return;}
   const cf=window.Cashfree({mode:'sandbox'});
   await cf.checkout({paymentSessionId:r.data.paymentSessionId,redirectTarget:'_self'});
   void refresh();
  }catch{setError('Unable to open sandbox checkout. Your order can be checked in payment history.');}
  finally{setBusy(false)}
 };
 return <div className="space-y-2">
  <Script src="https://sdk.cashfree.com/js/v3/cashfree.js" strategy="afterInteractive" onLoad={()=>setReady(true)} />
  <p className="text-xs text-amber-700 dark:text-amber-400">Sandbox checkout · test transactions only. No real money will be charged.</p>
  <label className="block text-xs">Mobile number for gateway test order
   <input className="mt-1 w-full rounded border p-2" type="tel" inputMode="numeric" maxLength={10}
    placeholder="10-digit Indian mobile number" value={phone} onChange={e=>setPhone(e.target.value.replace(/\D/g,''))}/>
  </label>
  <button type="button" disabled={!ready||busy||!(/^[6-9][0-9]{9}$/.test(phone))}
   className="w-full rounded bg-indigo-700 px-4 py-2 text-white disabled:opacity-50" onClick={()=>void start()}>
   {busy?'Opening sandbox checkout…':'Test Cashfree checkout'}
  </button>
  {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
  {returnResult&&<p role="status" className="text-sm text-indigo-700 dark:text-indigo-300">{returnResult}</p>}
  <button type="button" className="text-sm underline" onClick={()=>void refresh()}>Refresh payment history</button>
  {history.length>0&&<ul className="space-y-1 text-xs">{history.slice(0,5).map(row=><li key={row.id}>
   {row.billing_period} · ₹{row.amount_inr} · {row.status} · {new Date(row.created_at).toLocaleDateString('en-IN')}
  </li>)}</ul>}
  <p className="text-xs text-muted-foreground">Only verified server-side payment webhooks unlock Pro. Redirects and screenshots are not proof of payment.</p>
 </div>;
}
