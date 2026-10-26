'use client';

import { useState } from 'react';
import { Copy, MessageCircle } from 'lucide-react';
import { useExamLanguage } from '@/components/exampro/exam-language';

export const validShareTestId = (id:string) => /^[a-z0-9-]{1,60}$/.test(id);

export function ShareTestButtons({testId, title, compact=false}:{
  testId:string;title:string;compact?:boolean;
}) {
  const {language,t}=useExamLanguage();
  const [copied,setCopied]=useState(false);
  if(!validShareTestId(testId))return null;
  const link=()=>{
    const url=new URL('/exampro',window.location.origin);
    url.searchParams.set('test',testId);
    url.searchParams.set('lang',language);
    return url.toString();
  };
  const copy=async()=>{
    try {await navigator.clipboard.writeText(link());setCopied(true);}
    catch {setCopied(false);}
  };
  const share=()=>{
    const text=`Practice ${title} with ExamPro: ${link()}`;
    window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank','noopener,noreferrer');
  };
  return <div className="flex flex-wrap gap-2">
    <button type="button" onClick={share} aria-label={t('share')+' '+title}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-emerald-600/60 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-100">
      <MessageCircle className="h-4 w-4"/>{compact?'WhatsApp':t('share')}
    </button>
    <button type="button" onClick={()=>void copy()} aria-label={t('copy')+' '+title}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">
      <Copy className="h-4 w-4"/>{copied?t('copied'):(compact?'Copy':t('copy'))}
    </button>
  </div>;
}
