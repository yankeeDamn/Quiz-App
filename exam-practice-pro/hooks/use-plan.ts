'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { fetchPlanState, type PlanState } from '@/lib/mocks';
const GUEST:PlanState={signedIn:false,active:false,plan:'free',expiresAt:null,loaded:true};
const LOADING:PlanState={...GUEST,loaded:false};
/** Keep access display tied to the current account; the API enforces access again. */
export function usePlan():PlanState{
  const {data:session,status}=useSession();
  const key=session?.user?(session.user.id??session.user.email??'user'):null;
  const [fetched,setFetched]=useState<{key:string;state:PlanState}|null>(null);
  useEffect(()=>{
    if(!key)return;
    let cancelled=false;
    const load=()=>{void fetchPlanState().then(state=>{if(!cancelled)setFetched({key,state});});};
    load();window.addEventListener('focus',load);window.addEventListener('exampro:payment-verified',load);
    return()=>{cancelled=true;window.removeEventListener('focus',load);window.removeEventListener('exampro:payment-verified',load);};
  },[key]);
  if(status==='loading')return LOADING;
  if(!key)return GUEST;
  return fetched?.key===key?fetched.state:LOADING;
}
