'use client';
import {useClientReady} from '@/hooks/use-client-ready';

import { useEffect, useMemo, useState } from 'react';
import { Flame, Clock3, Share2, ShieldCheck, Trophy, X } from 'lucide-react';
import { calculateCompletion, getDailyQuestions, getLocalDateKey, loadStreakState, saveStreakState, type DailyLanguage, type DailyStreakState } from '@/lib/daily-streak';

const COPY = {
  en: { title: 'Daily 5-Question Rapid Challenge', subtitle: 'Polity · Quant · Science · Reasoning · Computer & AI', play: "Play today's 5 questions", done: 'Completed today', next: 'Next question', finish: 'Finish challenge', close: 'Close', streak: 'day streak', best: 'Best', start: 'Start your daily learning habit', share: 'Challenge friends on WhatsApp', explanation: 'Explanation', score: 'Your score', timer: '90-second challenge', already: 'You have completed today’s challenge. Come back tomorrow to keep your streak going.' },
  hi: { title: 'रोज़ाना 5 प्रश्न चुनौती', subtitle: 'राजव्यवस्था · गणित · विज्ञान · तर्क · कंप्यूटर और AI', play: 'आज के 5 प्रश्न खेलें', done: 'आज पूरा हुआ', next: 'अगला प्रश्न', finish: 'चुनौती पूरी करें', close: 'बंद करें', streak: 'दिन की स्ट्रीक', best: 'सर्वश्रेष्ठ', start: 'रोज़ सीखने की आदत शुरू करें', share: 'WhatsApp पर दोस्तों को चुनौती दें', explanation: 'व्याख्या', score: 'आपका स्कोर', timer: '90 सेकंड की चुनौती', already: 'आज की चुनौती पूरी हो गई। स्ट्रीक जारी रखने के लिए कल वापस आएँ।' },
  bn: { title: 'দৈনিক ৫-প্রশ্নের চ্যালেঞ্জ', subtitle: 'সংবিধান · গণিত · বিজ্ঞান · যুক্তি · কম্পিউটার ও AI', play: 'আজকের ৫টি প্রশ্ন খেলুন', done: 'আজ সম্পূর্ণ', next: 'পরের প্রশ্ন', finish: 'চ্যালেঞ্জ শেষ করুন', close: 'বন্ধ করুন', streak: 'দিনের স্ট্রিক', best: 'সেরা', start: 'প্রতিদিন শেখার অভ্যাস শুরু করুন', share: 'WhatsApp-এ বন্ধুদের চ্যালেঞ্জ করুন', explanation: 'ব্যাখ্যা', score: 'আপনার স্কোর', timer: '৯০ সেকেন্ডের চ্যালেঞ্জ', already: 'আজকের চ্যালেঞ্জ সম্পূর্ণ। স্ট্রিক বজায় রাখতে আগামীকাল ফিরে আসুন।' },
} as const;

export function DailyStreakWidget() { const ready=useClientReady(); return ready ? <DailyStreakContent/> : null; }
function DailyStreakContent() {
  const [language, setLanguage] = useState<DailyLanguage>('en');
  const [state, setState] = useState<DailyStreakState>(loadStreakState);
  const [open, setOpen] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const questions = useMemo(() => getDailyQuestions(getLocalDateKey()), []);
  const copy = COPY[language];
  const question = questions[questionIndex];

  useEffect(() => {
    if (!open || finished || startedAt === null) return;
    const timer = window.setInterval(() => setSeconds(Math.min(90, Math.floor((Date.now() - startedAt) / 1000))), 250);
    return () => window.clearInterval(timer);
  }, [open, finished, startedAt]);

  const start = () => {
    if (state.lastCompletedDate === getLocalDateKey()) return;
    setQuestionIndex(0); setAnswers([]); setSelected(null); setSeconds(0); setStartedAt(Date.now()); setFinished(false); setOpen(true);
  };

  const choose = (index: number) => {
    if (selected !== null) return;
    setSelected(index);
    const nextAnswers = [...answers, index];
    setAnswers(nextAnswers);
    window.setTimeout(() => {
      if (questionIndex === 4) {
        const score = nextAnswers.reduce((total, answer, i) => total + (answer === questions[i].correctIndex ? 1 : 0), 0);
        const elapsed = Math.min(90, Math.max(1, Math.floor((Date.now() - (startedAt ?? Date.now())) / 1000)));
        const next = calculateCompletion(state, score, elapsed, nextAnswers);
        saveStreakState(next); setState(next); setSeconds(elapsed); setFinished(true);
      } else { setQuestionIndex((i) => i + 1); setSelected(null); }
    }, 850);
  };

  const share = () => {
    const emojiGrid = questions.map((q, i) => answers[i] === q.correctIndex ? '🟩' : '🟥').join('');
    const message = `🔥 Day ${state.currentStreak} streak on ExamPro! I scored ${state.todayScore}/5 in ${state.todayTimeSeconds}s (${emojiGrid}). Can you beat me? ${window.location.origin}/?daily=1`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <section id="daily-streak" className="container mx-auto px-4 py-5 sm:py-7" aria-labelledby="daily-streak-title">
      <div className="relative overflow-hidden rounded-2xl border border-amber-400/25 bg-gradient-to-r from-[#161D2E] via-[#1A2236] to-[#231F22] text-slate-50 shadow-lg shadow-black/30 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-amber-400/50 before:to-transparent before:content-[\'\']">
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-amber-400"><Flame className="h-7 w-7" /></span>
            <div><p className="text-sm font-bold text-amber-400">{state.currentStreak} {copy.streak} <span className="mx-1 text-amber-400">·</span> {copy.best}: {state.bestStreak}d</p><h2 id="daily-streak-title" className="text-lg font-extrabold text-slate-50 sm:text-xl">{copy.title}</h2><p className="mt-1 text-sm text-slate-300">{copy.subtitle}</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="daily-language">Challenge language</label>
            <select id="daily-language" value={language} onChange={(e) => setLanguage(e.target.value as DailyLanguage)} className="min-h-10 rounded-lg border border-slate-700 bg-[#0D121F] px-2 text-sm text-slate-50 [color-scheme:dark]"><option value="en">EN</option><option value="hi">हिं</option><option value="bn">বাং</option></select>
            <button type="button" onClick={start} disabled={state.lastCompletedDate === getLocalDateKey()} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60">{state.lastCompletedDate === getLocalDateKey() ? '✓ ' + copy.done : '⚡ ' + copy.play}</button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 bg-[#0D121F]/80 px-4 py-3 text-sm sm:px-6">
          <div className="flex items-center gap-2 text-slate-300"><Clock3 className="h-4 w-4" />{copy.timer}</div>
          <div className="flex items-center gap-1.5" aria-label="Last seven days activity">{Array.from({ length: 7 }, (_, i) => { const date = new Date(); date.setDate(date.getDate() - (6 - i)); const key = getLocalDateKey(date); const done = state.completedDates.includes(key); return <span key={key} title={key} className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${done ? 'border border-amber-400/30 bg-amber-400 text-[#0A0F1C]' : 'border border-slate-700 bg-slate-800 text-slate-300'}`}>{done ? '✓' : ['M','T','W','T','F','S','S'][date.getDay() === 0 ? 6 : date.getDay() - 1]}</span>; })}</div>
          <p className="text-xs text-slate-300">{state.todayScore !== null ? `${copy.score}: ${state.todayScore}/5 · ${state.todayTimeSeconds}s` : copy.start}</p>
        </div>
        {open && <div className="border-t border-slate-800/80 bg-background p-4 text-foreground sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3"><p className="text-sm font-bold">Q{Math.min(questionIndex + 1, 5)} / 5 · {question.topic}</p><div className="flex items-center gap-3"><span className="text-sm tabular-nums text-muted-foreground">{seconds}/90s</span><button type="button" onClick={() => setOpen(false)} aria-label={copy.close} className="rounded p-1 hover:bg-muted"><X className="h-4 w-4" /></button></div></div>
          {finished ? <div className="py-5 text-center"><Trophy className="mx-auto h-10 w-10 text-amber-500" /><h3 className="mt-2 text-2xl font-extrabold">🔥 {state.currentStreak} {copy.streak}!</h3><p className="mt-1 text-muted-foreground">{copy.score}: {state.todayScore}/5 · {state.todayTimeSeconds}s</p><p className="mt-2 text-2xl">{questions.map((q, i) => answers[i] === q.correctIndex ? '🟩' : '🟥').join('')}</p><button type="button" onClick={share} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700"><Share2 className="h-4 w-4" />{copy.share}</button><p className="mt-3 text-xs text-muted-foreground"><ShieldCheck className="mr-1 inline h-4 w-4" />Progress is saved on this device.</p></div> : <><h3 className="text-lg font-bold leading-relaxed">{question.question[language]}</h3><div className="mt-4 grid gap-2 sm:grid-cols-2">{question.options[language].map((option, index) => <button key={option} type="button" disabled={selected !== null} onClick={() => choose(index)} className={`min-h-12 rounded-xl border p-3 text-left text-sm font-medium transition-colors ${selected === index ? index === question.correctIndex ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950' : 'border-rose-500 bg-rose-50 dark:bg-rose-950' : 'hover:border-accent-ink hover:bg-accent-soft dark:hover:bg-accent-soft'}`}>{option}</button>)}</div>{selected !== null && <p className="mt-4 rounded-lg bg-muted p-3 text-sm"><strong>{copy.explanation}:</strong> {question.explanation[language]}</p>}</>}
        </div>}
      </div>
    </section>
  );
}
