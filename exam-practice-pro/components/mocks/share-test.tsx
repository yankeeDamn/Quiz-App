'use client';

import {useState} from 'react';
import {Copy, Share2} from 'lucide-react';
import type {ExamLanguage} from '@/lib/exampro-language';

export function testShareUrl(id:string,lang:ExamLanguage,origin:string){
 // Guard against an untrusted exam id being used in a link.
 if(!/^[a-z0-9-]{1,60}$/.test(id))return '';
 const url=new URL('/exampro',origin);
 url.searchParams.set('test',id);
 if(lang!=='en')url.searchParams.set('lang',lang);
 return url.toString();
}
export function ShareTest({id,title,lang='en',compact=false}:{
 id:string;title:string;lang?:ExamLanguage;compact?:boolean
}) {
 const [message,setMessage]=useState('');
 const link=()=>testShareUrl(id,lang,window.location.origin);
 async function copy(){
  const url=link();if(!url)return;
  try{
   await navigator.clipboard.writeText(url);setMessage('Link copied');
  }catch{setMessage('Copy not available. Use WhatsApp to share.');}
 }
 function whatsapp(){
  const url=link();if(!url)return;
  const text=encodeURIComponent('Try '+title+' on ExamPro: '+url);
  window.open('https://wa.me/?text='+text,'_blank','noopener,noreferrer');
 }
 return <div className="inline-flex flex-wrap items-center gap-2">
  <button type="button" onClick={()=>void copy()} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-current/20 px-3 py-2 text-xs font-semibold hover:bg-muted" aria-label={'Copy link for '+title}>
   <Copy className="h-4 w-4"/>{compact?'Copy':'Copy link'}
  </button>
  <button type="button" onClick={whatsapp} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800" aria-label={'Share '+title+' on WhatsApp'}>
   <Share2 className="h-4 w-4"/>{compact?'WhatsApp':'Share on WhatsApp'}
  </button>
  <span className="sr-only" role="status">{message}</span>
 </div>;
}
