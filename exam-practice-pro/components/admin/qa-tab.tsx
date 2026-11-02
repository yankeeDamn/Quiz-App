'use client';
import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { admin } from '@/lib/admin';
import { card } from './ui';
import { BetaInvitePanel } from './beta-invite-panel';
import { BetaFeedbackDashboard } from './beta-feedback-dashboard';
import { MockComparisonAudit } from './mock-comparison-audit';
import { CglContentPipeline } from './cgl-content-pipeline';
export function QaTab(){
  const [enabled,setEnabled]=useState<boolean|null>(null),[error,setError]=useState('');
  useEffect(()=>{let active=true;void admin<{enabled:boolean}>('/draft-testing/status').then(r=>{if(!active)return;if(r.ok)setEnabled(r.data.enabled);else setError(r.message);});return()=>{active=false;};},[]);
  if(error)return <p role="alert">{error}</p>;
  if(enabled===null)return <p role="status">Checking staging QA availability…</p>;
  if(!enabled)return <div className={card}><ShieldCheck className="h-8 w-8 text-indigo-500"/><h2 className="mt-3 font-bold">Staging QA tools are disabled here</h2><p className="mt-2 text-sm text-muted-foreground">Use the isolated staging environment with draft testing enabled for beta invitations, feedback and Mock 01 / 02 comparison. Publication reviews remain available in Mocks &amp; Tests Manager.</p></div>;
  return <div className="grid gap-6"><div className="grid items-start gap-6 xl:grid-cols-2"><BetaInvitePanel/><BetaFeedbackDashboard/></div><MockComparisonAudit/><CglContentPipeline/></div>;
}
