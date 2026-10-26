'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

export type ExamLanguage = 'en' | 'hi' | 'bn';
const STORAGE = 'exampro:language:v1';
const LABELS: Record<ExamLanguage,Record<string,string>> = {
  en: {
    question:'Question', next:'Next', previous:'Previous', submit:'Submit exam',
    save:'Progress saved', saving:'Saving…', answer:'Select your answer',
    share:'Share on WhatsApp', copy:'Copy link', copied:'Link copied',
    available:'Available', upcoming:'Coming soon', language:'Language',
  },
  hi: {
    question:'प्रश्न', next:'अगला', previous:'पिछला', submit:'परीक्षा जमा करें',
    save:'प्रगति सहेजी गई', saving:'सहेजा जा रहा है…', answer:'अपना उत्तर चुनें',
    share:'WhatsApp पर साझा करें', copy:'लिंक कॉपी करें', copied:'लिंक कॉपी हुआ',
    available:'उपलब्ध', upcoming:'जल्द उपलब्ध', language:'भाषा',
  },
  bn: {
    question:'প্রশ্ন', next:'পরবর্তী', previous:'পূর্ববর্তী', submit:'পরীক্ষা জমা দিন',
    save:'অগ্রগতি সংরক্ষিত', saving:'সংরক্ষণ হচ্ছে…', answer:'আপনার উত্তর বেছে নিন',
    share:'WhatsApp-এ শেয়ার করুন', copy:'লিংক কপি করুন', copied:'লিংক কপি হয়েছে',
    available:'উপলব্ধ', upcoming:'শীঘ্রই আসছে', language:'ভাষা',
  },
};
const OPTIONS: {id:ExamLanguage;label:string}[] = [
  {id:'en',label:'EN'}, {id:'hi',label:'हिं'}, {id:'bn',label:'বাং'},
];
function isLang(s: string | null): s is ExamLanguage { return s === 'en' || s === 'hi' || s === 'bn'; }
function readLanguage():ExamLanguage {
  try {
    const url = new URL(window.location.href).searchParams.get('lang');
    if (isLang(url)) return url;
    const stored = localStorage.getItem(STORAGE);
    return isLang(stored) ? stored : 'en';
  } catch { return 'en'; }
}
export function useExamLanguage() {
  const [language,setLanguage] = useState<ExamLanguage>('en');
  useEffect(()=>{
    const sync=()=>{
      const next=readLanguage();
      setLanguage(next);
      document.documentElement.setAttribute('data-exampro-lang',next);
    };
    sync();
    window.addEventListener('exampro-language-changed',sync);
    window.addEventListener('storage',sync);
    return ()=>{ window.removeEventListener('exampro-language-changed',sync);window.removeEventListener('storage',sync); };
  },[]);
  const change=(next:ExamLanguage)=>{
    try {
      localStorage.setItem(STORAGE,next);
      const url=new URL(window.location.href);
      if(url.searchParams.has('lang')){
        url.searchParams.set('lang',next);
        window.history.replaceState(window.history.state,'',url.toString());
      }
    } catch { /* storage unavailable */ }
    setLanguage(next);
    window.dispatchEvent(new Event('exampro-language-changed'));
  };
  return {language,change,t:(key:string)=>LABELS[language][key] || LABELS.en[key] || key};
}
export function LanguageSwitcher({small=false}:{small?:boolean}) {
  const {language,change,t}=useExamLanguage();
  return <div role="group" aria-label={t('language')} className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-background/80 p-0.5">
    {OPTIONS.map(option=><button key={option.id} type="button" aria-pressed={language===option.id}
      lang={option.id} onClick={()=>change(option.id)}
      className={`min-h-9 rounded-md px-2 text-xs font-bold transition-colors ${language===option.id?'bg-indigo-600 text-white':'text-foreground hover:bg-muted'} ${small?'sm:px-2':'sm:px-3'}`}>
      {option.label}
    </button>)}
  </div>;
}
function hashKey(s:string) {
  let h=2166136261;
  for(let i=0;i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),16777619);}
  return (h>>>0).toString(36);
}
/**
 * Advisory display-only translations. Never alter the canonical question,
 * option indexes, answer keys, deadlines or scored attempt payloads.
 */
export function useTranslatedTexts(texts:string[]) {
  const {language}=useExamLanguage();
  const [state,setState]=useState<{key:string;texts:string[];warning:string}|null>(null);
  const serialized=JSON.stringify(texts);
  const key=useMemo(()=>language+':'+hashKey(serialized),[language,serialized]);
  useEffect(()=>{
    if(language==='en'||texts.length===0)return;
    let cancelled=false;
    const storageKey='exampro:translated:v1:'+key;
    try {
      const cached=JSON.parse(localStorage.getItem(storageKey)||'null') as {source?:string;translated?:string[]}|null;
      if(cached?.source===serialized && cached.translated?.length===texts.length) {
        setState({key,texts:cached.translated,warning:''});return;
      }
    }catch{ /* no cache */ }
    api<{texts:string[]}>('/api/v1/exampro/translate',{public:true,method:'POST',body:{language,texts}})
      .then(r=>{
        if(cancelled)return;
        if(!r.success||!r.data||r.data.texts.length!==texts.length){
          setState({key,texts,warning:'Automatic translation is not available. Showing the original English text.'});
          return;
        }
        setState({key,texts:r.data.texts,warning:''});
        try {
          localStorage.setItem(storageKey,JSON.stringify({source:serialized,translated:r.data.texts}));
        } catch { /* private browser */ }
      })
      .catch(()=>{if(!cancelled)setState({key,texts,warning:'Automatic translation is not available. Showing English.'});});
    return()=>{cancelled=true;};
  // serialized is a stable representation of the content for this displayed question.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[language,serialized,key]);
  return {
    texts: language==='en' || state?.key!==key ? texts : state.texts,
    warning:language==='en'||state?.key!==key?'':state.warning,
  };
}
