'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

export type ExamLanguage = 'en' | 'hi' | 'bn';
const STORAGE = 'exampro:language:v1';
const LABELS: Record<ExamLanguage,Record<string,string>> = {
  en: {
    quizzes:'Quizzes', govtJobs:'Govt Jobs', certifications:'Certifications', indiaMocks:'India Mocks', examHall:'Exam Hall', dashboard:'Dashboard', institutes:'Institutes', bookmarks:'Bookmarks', pricing:'Pricing', signIn:'Sign In', signOut:'Sign Out', explore:'Explore ExamPro', learningSpace:'Choose your learning space', checking:'Checking account…', signedIn:'Signed in', guest:'Guest account', openMenu:'Open menu', toggleTheme:'Toggle theme', light:'Light', dark:'Dark', system:'System',
    question:'Question', next:'Next', previous:'Previous', submit:'Submit exam',
    save:'Progress saved', saving:'Saving…', answer:'Select your answer',
    share:'Share on WhatsApp', copy:'Copy link', copied:'Link copied',
    available:'Available', upcoming:'Coming soon', language:'Language',
  },
  hi: {
    quizzes:'क्विज़', govtJobs:'सरकारी नौकरियाँ', certifications:'प्रमाणपत्र', indiaMocks:'भारत मॉक टेस्ट', examHall:'परीक्षा कक्ष', dashboard:'डैशबोर्ड', institutes:'संस्थान', bookmarks:'बुकमार्क', pricing:'मूल्य', signIn:'साइन इन', signOut:'साइन आउट', explore:'ExamPro देखें', learningSpace:'अपना अध्ययन क्षेत्र चुनें', checking:'खाता जाँचा जा रहा है…', signedIn:'साइन इन किया', guest:'अतिथि खाता', openMenu:'मेनू खोलें', toggleTheme:'थीम बदलें', light:'हल्का', dark:'गहरा', system:'सिस्टम',
    question:'प्रश्न', next:'अगला', previous:'पिछला', submit:'परीक्षा जमा करें',
    save:'प्रगति सहेजी गई', saving:'सहेजा जा रहा है…', answer:'अपना उत्तर चुनें',
    share:'WhatsApp पर साझा करें', copy:'लिंक कॉपी करें', copied:'लिंक कॉपी हुआ',
    available:'उपलब्ध', upcoming:'जल्द उपलब्ध', language:'भाषा',
  },
  bn: {
    quizzes:'কুইজ', govtJobs:'সরকারি চাকরি', certifications:'সার্টিফিকেশন', indiaMocks:'ভারতের মক টেস্ট', examHall:'পরীক্ষা কক্ষ', dashboard:'ড্যাশবোর্ড', institutes:'প্রতিষ্ঠান', bookmarks:'বুকমার্ক', pricing:'মূল্য', signIn:'সাইন ইন', signOut:'সাইন আউট', explore:'ExamPro ঘুরে দেখুন', learningSpace:'আপনার পড়াশোনার বিভাগ বেছে নিন', checking:'অ্যাকাউন্ট যাচাই হচ্ছে…', signedIn:'সাইন ইন করা হয়েছে', guest:'অতিথি অ্যাকাউন্ট', openMenu:'মেনু খুলুন', toggleTheme:'থিম পরিবর্তন', light:'লাইট', dark:'ডার্ক', system:'সিস্টেম',
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
// Private exam and draft text must never persist in localStorage across
// account changes. This bounded per-tab cache avoids refetching repeat toggles.
const privateExamTranslations=new Map<string,{source:string;translated:string[]}>();
function rememberPrivateTranslation(key:string,source:string,translated:string[]){
  if(privateExamTranslations.has(key))privateExamTranslations.delete(key);
  privateExamTranslations.set(key,{source,translated});
  while(privateExamTranslations.size>500)privateExamTranslations.delete(privateExamTranslations.keys().next().value!);
}
function readPrivateTranslation(key:string){return privateExamTranslations.get(key)||null;}

function hashKey(s:string) {
  let h=2166136261;
  for(let i=0;i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),16777619);}
  return (h>>>0).toString(36);
}
/**
 * Advisory display-only translations. Never alter the canonical question,
 * option indexes, answer keys, deadlines or scored attempt payloads.
 */
export function useTranslatedTexts(texts:string[], options?:{exam?:boolean}) {
  const {language}=useExamLanguage();
  const exam=options?.exam===true;
  const [state,setState]=useState<{key:string;texts:string[];warning:string;machine:boolean}|null>(null);
  const serialized=JSON.stringify(texts);
  const key=useMemo(()=>language+':'+hashKey(serialized),[language,serialized]);
  useEffect(()=>{
    if(language==='en'||texts.length===0)return;
    let cancelled=false;
    const storageKey='exampro:translated:v1:'+key;
    try {
      const cached=(exam ? readPrivateTranslation(key) : JSON.parse(localStorage.getItem(storageKey)||'null')) as {source?:string;translated?:string[]}|null;
      if(cached?.source===serialized && cached.translated?.length===texts.length) {
        setState({key,texts:cached.translated,warning:'',machine:true});return;
      }
    }catch{ /* no cache */ }
    api<{texts:string[]}>(exam?'/api/v1/exampro/translate-exam':'/api/v1/exampro/translate', {public:!exam,method:'POST',body:{language,texts}})
      .then(r=>{
        if(cancelled)return;
        if(!r.success||!r.data||r.data.texts.length!==texts.length){
          setState({key,texts,warning:(r.error?.message||'Azure translation is unavailable.')+' Showing the original English text.',machine:false});
          return;
        }
        setState({key,texts:r.data.texts,warning:'',machine:true});
        try {
          if(exam)rememberPrivateTranslation(key,serialized,r.data.texts);
          else localStorage.setItem(storageKey,JSON.stringify({source:serialized,translated:r.data.texts}));
        } catch { /* private browser */ }
      })
      .catch(()=>{if(!cancelled)setState({key,texts,warning:'Azure translation is unavailable. Showing English.',machine:false});});
    return()=>{cancelled=true;};
  // serialized is a stable representation of the content for this displayed question.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[language,serialized,key,exam]);
  return {
    texts: language==='en' || state?.key!==key ? texts : state.texts,
    warning:language==='en'||state?.key!==key?'':state.warning,
    machineTranslated:language!=='en'&&state?.key===key&&state.machine,
    loading:language!=='en'&&texts.length>0&&state?.key!==key,
  };
}
