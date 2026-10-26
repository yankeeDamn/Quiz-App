'use client';

import {useEffect,useState} from 'react';
import {api} from '@/lib/api';

export type ExamLanguage='en'|'hi'|'bn';
const KEY='exampro:language:v1';
export const LANGUAGE_LABELS:Record<ExamLanguage,string>={en:'EN',hi:'हिं',bn:'বাং'};
export const LABELS={
 en:{question:'Question',of:'of',submit:'Submit exam',next:'Next',previous:'Previous',clear:'Clear answer',saved:'Progress saved',saving:'Saving…',answered:'answered',explanation:'Explanation',translateError:'Translation unavailable; showing English.'},
 hi:{question:'प्रश्न',of:'में से',submit:'परीक्षा जमा करें',next:'अगला',previous:'पिछला',clear:'उत्तर हटाएं',saved:'प्रगति सहेजी गई',saving:'सहेज रहे हैं…',answered:'उत्तर दिए',explanation:'व्याख्या',translateError:'अनुवाद उपलब्ध नहीं; अंग्रेज़ी दिखाई जा रही है।'},
 bn:{question:'প্রশ্ন',of:'এর মধ্যে',submit:'জমা দিন',next:'পরবর্তী',previous:'পূর্ববর্তী',clear:'উত্তর মুছুন',saved:'সংরক্ষিত',saving:'সংরক্ষণ চলছে…',answered:'উত্তর দেওয়া',explanation:'ব্যাখ্যা',translateError:'অনুবাদ পাওয়া যায়নি; ইংরেজি দেখানো হচ্ছে।'},
};

export function isExamLanguage(v:string|null):v is ExamLanguage {return v==='en'||v==='hi'||v==='bn';}
export function useExamLanguage(){
 const [lang,setLang]=useState<ExamLanguage>('en');
 useEffect(()=>{
  try{
   const query=new URL(window.location.href).searchParams.get('lang');
   const value=isExamLanguage(query)?query:localStorage.getItem(KEY);
   if(isExamLanguage(value))setLang(value);
  }catch{/* browser storage may be blocked */}
 },[]);
 function select(next:ExamLanguage){
  setLang(next);
  try{
   localStorage.setItem(KEY,next);
   const url=new URL(window.location.href);
   url.searchParams.set('lang',next);
   window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);
  }catch{/* selection still works in this view */}
 }
 return {lang,setLang:select,labels:LABELS[lang]};
}
export function ExamLanguageSwitcher({lang,onChange}:{lang:ExamLanguage;onChange:(lang:ExamLanguage)=>void}){
 return <div role="group" aria-label="Exam language" className="inline-flex rounded-lg border border-indigo-200 bg-white/85 p-0.5 text-xs font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
  {(['en','hi','bn'] as const).map(v=><button key={v} type="button" aria-pressed={lang===v} lang={v}
   className={'min-h-9 rounded-md px-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 '+(lang===v?'bg-indigo-700 text-white':'hover:bg-indigo-50 dark:hover:bg-slate-800')}
   onClick={()=>onChange(v)}>{LANGUAGE_LABELS[v]}</button>)}
 </div>;
}
type Translation={lang:ExamLanguage;texts:string[];state:'original'|'loading'|'translated'|'unavailable'};
function cacheKey(lang:ExamLanguage,source:string[]) {
 const input=lang+'\u0000'+source.join('\u0000');
 let n=2166136261;
 for(let i=0;i<input.length;i++)n=Math.imul(n^input.charCodeAt(i),16777619)>>>0;
 return 'exampro:translated:v1:'+lang+':'+n.toString(16);
}

/** Only translates the *currently visible* text. No mass submission of the question bank. */
export function useExamTranslation(lang:ExamLanguage,source:string[]):Translation {
 const key=JSON.stringify(source);
 const [current,setCurrent]=useState<{key:string;lang:ExamLanguage;texts:string[];state:Translation['state']}|null>(null);
 useEffect(()=>{
  if(lang==='en'||source.length===0)return;
  let active=true;
  const clean=source.map(s=>s.slice(0,1000));
  const storeKey=cacheKey(lang,clean);
  try{
   const raw=localStorage.getItem(storeKey);
   if(raw){
    const value=JSON.parse(raw) as {source:string[];texts:string[]};
    if(JSON.stringify(value.source)===JSON.stringify(clean)&&value.texts.length===clean.length){
     setCurrent({key,lang,texts:value.texts,state:'translated'});return;
    }
   }
  }catch{/* translation remains available online */}
  api<{lang:string;texts:string[]}>('/api/v1/translate',{method:'POST',public:true,body:{lang,texts:clean}})
   .then(r=>{
    if(!active)return;
    if(r.success&&r.data?.texts?.length===clean.length){
     setCurrent({key,lang,texts:r.data.texts,state:'translated'});
     try{localStorage.setItem(storeKey,JSON.stringify({source:clean,texts:r.data.texts}));}catch{}
    }else setCurrent({key,lang,texts:source,state:'unavailable'});
   }).catch(()=>{if(active)setCurrent({key,lang,texts:source,state:'unavailable'});});
  return()=>{active=false;};
  // key represents the source array, which may be recreated by React.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[lang,key]);
 if(lang==='en')return{lang,texts:source,state:'original'};
 if(current?.key===key&&current.lang===lang)return {lang,texts:current.texts,state:current.state};
 return {lang,texts:source,state:'loading'};
}
