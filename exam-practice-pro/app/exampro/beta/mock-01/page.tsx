'use client';
import {useState} from 'react';
import {useSession} from 'next-auth/react';
import Link from 'next/link';
import {api} from '@/lib/api';
import {SecureExam} from '@/components/mocks/secure-exam';
import {BetaFeedback} from '@/components/exampro/beta-feedback';

const TEST_ID='ssc-cgl-2026-mock-01';
export default function StudentBetaPage(){
 const {status}=useSession();
 const [code,setCode]=useState('');
 const [ready,setReady]=useState(false);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const redeem=async(e:React.FormEvent)=>{
  e.preventDefault();setBusy(true);setError('');
  const result=await api<{testId:string}>('/api/v1/beta/redeem',{method:'POST',body:{code:code.trim()}});
  setBusy(false);
  if(result.success&&result.data?.testId===TEST_ID){setReady(true);setCode('');}
  else setError(result.error?.message||'Invitation is not valid.');
 };
 return <main className="mx-auto max-w-5xl flex-1 px-4 py-8 space-y-5">
  <h1 className="text-2xl font-bold">ExamPro · invitation-only staging beta</h1>
  <p className="rounded border border-amber-400 p-3 text-sm">This is an unpublished practice mock for invited testers only. Do not share questions or screenshots. Results are for QA and are not official SSC scores.</p>
  {status!=='authenticated'?<p>Sign in with the verified Google/GitHub account that received the invitation. <Link className="underline" href="/auth/signin?callbackUrl=%2Fexampro%2Fbeta%2Fmock-01">Sign in</Link></p>:
  ready?<div className="space-y-6"><SecureExam testId={TEST_ID} betaMode/><BetaFeedback/></div>:
  <div className="space-y-4">
   <form onSubmit={redeem} className="space-y-3 rounded-xl border p-5">
    <label className="block text-sm font-medium" htmlFor="invitation-code">Private invitation code</label>
    <input id="invitation-code" className="w-full rounded border p-3 font-mono" required autoComplete="off" value={code} onChange={e=>setCode(e.target.value)} placeholder="Paste the 64-character invitation code"/>
    <button className="rounded bg-indigo-700 px-4 py-2 font-semibold text-white disabled:opacity-50" disabled={busy} type="submit">{busy?'Verifying…':'Redeem invitation'}</button>
   </form>
   <button className="rounded border px-4 py-2" type="button" onClick={async()=>{
    setError('');const r=await api<{authorized:boolean}>('/api/v1/beta/access');
    if(r.success&&r.data?.authorized)setReady(true);
    else setError(r.error?.message||'No active invitation.');}}>Already redeemed? Resume your exam</button>
   {error&&<p role="alert" className="text-sm text-red-600">{error}</p>}
  </div>}
 </main>;
}
