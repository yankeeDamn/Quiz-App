'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {api} from '@/lib/api';
type Order={keyId:string;orderId:string;amount:number;currency:string;name:string;months:number};
type Status={status:'created'|'paid';paidAt:string|null;months:number};
type CheckoutConstructor=new (options:Record<string,unknown>)=>{open:()=>void};
declare global{interface Window{Razorpay?:CheckoutConstructor}}
async function checkoutScript(){
 if(window.Razorpay)return;
 await new Promise<void>((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='https://checkout.razorpay.com/v1/checkout.js';script.async=true;
  script.onload=()=>resolve();script.onerror=()=>reject(new Error('Payment checkout script unavailable'));
  document.body.appendChild(script);
 });
}
export function RazorpayCheckout({yearly,email}:{yearly:boolean;email:string|null}){
 const [enabled,setEnabled]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [orderId,setOrderId]=useState<string|null>(null);
 useEffect(()=>{let active=true;void api<{enabled:boolean}>('/api/v1/payments/config',{public:true}).then(r=>{if(active&&r.success)setEnabled(Boolean(r.data?.enabled));}).catch(()=>{});return()=>{active=false}},[]);
 if(!enabled)return null;
 async function pay(){
  if(!email)return;
  setBusy(true);setMessage('');
  try{
   const r=await api<Order>('/api/v1/payments/orders',{method:'POST',body:{plan:'pro',term:yearly?'yearly':'monthly'}});
   if(!r.success||!r.data)throw new Error(r.error?.message||'Could not create order.');
   const order=r.data;
   await checkoutScript();
   if(!window.Razorpay)throw new Error('Payment checkout unavailable.');
   setOrderId(order.orderId);
   const instance=new window.Razorpay({
    key:order.keyId,order_id:order.orderId,amount:order.amount,currency:order.currency,
    name:'ExamPro',description:`Pro access for ${order.months} month(s)`,
    prefill:{email},
    handler:()=>{setMessage('Checkout returned successfully. Your Pro plan will activate only after confirmed payment capture. Select Check payment below.');},
    modal:{ondismiss:()=>setMessage('Checkout closed. No plan has been unlocked.')}
   });
   instance.open();
  }catch(error){setMessage(error instanceof Error?error.message:'Payment checkout unavailable.')}
  finally{setBusy(false)}
 }
 async function check(){
  if(!orderId)return;
  setBusy(true);
  try{
   const r=await api<Status>(`/api/v1/payments/orders/${encodeURIComponent(orderId)}`);
   if(r.success&&r.data){
    setMessage(r.data.status==='paid'
     ? 'Payment verified and Pro activated. Refresh the page to see your new access.'
     : 'Awaiting confirmed payment capture. No charge is assumed from the browser return.');
   }else setMessage(r.error?.message||'Could not check order status.');
  }finally{setBusy(false)}
 }
 return <section className="my-7 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5 dark:border-indigo-900 dark:bg-indigo-950/30">
   <h2 className="text-lg font-bold">Secure online Pro checkout</h2>
   <p className="mt-1 text-sm text-muted-foreground">One-time payment for {yearly?'12 months (₹1,990)':'1 month (₹199)'}. Access is activated by a verified payment webhook, not by the checkout popup.</p>
   {!email?<Link href="/auth/signin?callbackUrl=/pricing" className="mt-3 inline-block rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white">Sign in before paying</Link>:
   <button type="button" disabled={busy} onClick={pay} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy?'Processing…':'Pay securely with Razorpay'}</button>}
   {orderId&&<button type="button" onClick={check} disabled={busy} className="ml-3 mt-3 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">Check payment</button>}
   {message&&<p role="status" className="mt-3 text-sm">{message}</p>}
   <p className="mt-3 text-xs text-muted-foreground">Questions or billing disputes? Review the refund policy and contact support before paying.</p>
 </section>;
}
