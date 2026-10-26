'use client';

import { useState } from 'react';
import { Copy, MessageCircle } from 'lucide-react';
import { useExamLanguage } from '@/components/exampro/exam-language';
import { copyUrl } from '@/lib/mobile-share';

export const validShareTestId = (id:string) => /^[a-z0-9-]{1,60}$/.test(id);

export function ShareTestButtons({testId, title, compact=false}:{
  testId:string;title:string;compact?:boolean;
}) {
  const {language,t}=useExamLanguage();
  const [copied,setCopied]=useState(false);
  const [manualUrl,setManualUrl]=useState('');
  const [manualWhatsApp,setManualWhatsApp]=useState('');
  if(!validShareTestId(testId))return null;

  const link=()=>{
    const url=new URL('/exampro',window.location.origin);
    url.searchParams.set('test',testId);
    url.searchParams.set('lang',language);
    return url.toString();
  };

  const copy=async()=>{
    const url=link();
    const ok=await copyUrl(url);
    setCopied(ok);
    setManualUrl(ok?'':url);
  };

  const share=async()=>{
    const url=link();
    const text='Practice '+title+' with ExamPro';
    // Native mobile share sheets avoid browser popup blockers and preserve
    // a student's in-progress timed exam in the current browser tab.
    if(typeof navigator.share==='function'){
      try{
        await navigator.share({title:'ExamPro mock test',text,url});
        return;
      }catch{ /* User cancelled or native share unavailable: offer WhatsApp. */ }
    }
    const wa='https://wa.me/?text='+encodeURIComponent(text+': '+url);
    setManualWhatsApp(wa);
    // A visible link is safer than navigating away from an active exam.
  };

  return <div className="flex flex-wrap gap-2">
    <button type="button" onClick={()=>void share()} aria-label={t('share')+' '+title}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-emerald-600/60 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-100">
      <MessageCircle className="h-4 w-4"/>{compact?'WhatsApp':t('share')}
    </button>
    <button type="button" onClick={()=>void copy()} aria-label={t('copy')+' '+title}
      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">
      <Copy className="h-4 w-4"/>{copied?t('copied'):(compact?'Copy':t('copy'))}
    </button>
    {manualWhatsApp&&<a href={manualWhatsApp} target="_blank" rel="noopener noreferrer" className="w-full text-xs font-semibold text-emerald-700 underline dark:text-emerald-300">Open WhatsApp share link in another tab</a>}
    {manualUrl&&<label className="w-full text-xs text-muted-foreground">
      Your browser blocked copying. Long-press the link:
      <input className="mt-1 w-full rounded-lg border bg-background px-2 py-2 text-xs text-foreground" readOnly
        value={manualUrl} onFocus={event=>event.target.select()} aria-label="Manual share link"/>
    </label>}
  </div>;
}
