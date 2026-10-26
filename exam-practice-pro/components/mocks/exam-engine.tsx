'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Bookmark, Clock, Flag, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExamLanguageSwitcher, useExamLanguage, useExamTranslation } from '@/lib/exampro-language';
import { ShareTest } from '@/components/mocks/share-test';
import { WhatsAppButton } from '@/components/mocks/whatsapp-button';
import {
  type MockTest,
  type Shuffled,
  formatClock,
  negativeLabel,
  scoreTest,
  shuffleTest,
} from '@/lib/mocks';

type Mode = 'test' | 'practice';
const LETTERS = ['A', 'B', 'C', 'D'];
const SAVED_KEY = 'epp_saved_mock_questions';

function readSaved(): string[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeSaved(list: string[]) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(list));
  } catch {
    /* storage can be blocked */
  }
}

type PaletteState = 'unseen' | 'unanswered' | 'answered' | 'marked' | 'answered-marked';

export function ExamEngine({ test, mode }: { test: MockTest; mode: Mode }) {
  const practice = mode === 'practice';
  const {lang,setLang,labels}=useExamLanguage();
  const [items, setItems] = useState<Shuffled[]>(() => shuffleTest(test, !practice));
  const [answers, setAnswers] = useState<number[]>(() => test.questions.map(() => -1));
  const [marked, setMarked] = useState<boolean[]>(() => test.questions.map(() => false));
  const [seen, setSeen] = useState<boolean[]>(() => test.questions.map((_, i) => i === 0));
  const [checked, setChecked] = useState<boolean[]>(() => test.questions.map(() => false));
  const [current, setCurrent] = useState(0);
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [secondsLeft, setSecondsLeft] = useState(test.minutes * 60);
  const [elapsed, setElapsed] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [finished, setFinished] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [saved, setSaved] = useState<string[]>(() => readSaved());
  const [tabSwitches, setTabSwitches] = useState(0);
  const spent = useRef<number[]>(test.questions.map(() => 0));
  const submitRef = useRef<() => void>(() => {});

  const [spentSnapshot, setSpentSnapshot] = useState<number[]>([]);

  const submit = useCallback(() => {
    setSpentSnapshot([...spent.current]);
    setConfirming(false);
    setFinished(true);
  }, []);
  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  // One timer for the whole test.
  useEffect(() => {
    if (finished) return;
    const id = window.setInterval(() => {
      spent.current[current] += 1;
      setElapsed(Math.round((Date.now() - startedAt) / 1000));
      if (!practice) {
        const left = Math.max(0, test.minutes * 60 - Math.round((Date.now() - startedAt) / 1000));
        setSecondsLeft(left);
        if (left <= 0) submitRef.current();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [finished, current, startedAt, practice, test.minutes]);

  // Count tab switches during a timed test.
  useEffect(() => {
    if (practice || finished) return;
    const onHide = () => {
      if (document.hidden) setTabSwitches((n) => n + 1);
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [practice, finished]);

  const goTo = useCallback((i: number) => {
    const next = Math.max(0, Math.min(test.questions.length - 1, i));
    setCurrent(next);
    setSeen((s) => s.map((v, k) => (k === next ? true : v)));
    setPaletteOpen(false);
  }, [test.questions.length]);

  const choose = useCallback(
    (position: number) => {
      if (finished) return;
      if (practice && checked[current]) return;
      setAnswers((a) => a.map((v, k) => (k === current ? position : v)));
      if (practice) setChecked((c) => c.map((v, k) => (k === current ? true : v)));
    },
    [current, checked, finished, practice]
  );

  // Keyboard: A-D or 1-4 to answer, arrows to move.
  useEffect(() => {
    if (finished || confirming) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const k = e.key.toLowerCase();
      if ('1234'.includes(k) && k.length === 1) choose(Number(k) - 1);
      else if ('abcd'.includes(k) && k.length === 1) choose('abcd'.indexOf(k));
      else if (k === 'arrowright') goTo(current + 1);
      else if (k === 'arrowleft') goTo(current - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [choose, current, finished, confirming, goTo]);

  const toggleSaved = (id: string) => {
    setSaved((list) => {
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      writeSaved(next);
      return next;
    });
  };

  const stateOf = (i: number): PaletteState => {
    const a = answers[i] > -1;
    if (marked[i]) return a ? 'answered-marked' : 'marked';
    if (a) return 'answered';
    return seen[i] ? 'unanswered' : 'unseen';
  };

  const result = useMemo(() => (finished ? scoreTest(test, items, answers) : null), [finished, test, items, answers]);

  const retake = () => {
    setItems(shuffleTest(test, !practice));
    setAnswers(test.questions.map(() => -1));
    setMarked(test.questions.map(() => false));
    setSeen(test.questions.map((_, i) => i === 0));
    setChecked(test.questions.map(() => false));
    spent.current = test.questions.map(() => 0);
    setCurrent(0);
    setStartedAt(Date.now());
    setSecondsLeft(test.minutes * 60);
    setElapsed(0);
    setTabSwitches(0);
    setFinished(false);
  };

  const visible = items[current]?.question;
  const content = visible ? [visible.question,...visible.options,...(practice && checked[current] ? [visible.explanation] : [])] : [];
  const translated = useExamTranslation(lang,content);
  if (finished && result) {
    return (
      <ResultView
        test={test}
        items={items}
        answers={answers}
        result={result}
        practice={practice}
        elapsed={elapsed}
        spent={spentSnapshot}
        saved={saved}
        onToggleSaved={toggleSaved}
        tabSwitches={tabSwitches}
        onRetake={retake}
      />
    );
  }

  const item = items[current];
  const q = item.question;
  const sectionIndex = q.section;
  const section = test.sections[sectionIndex];
  const done = practice && checked[current];
  const picked = answers[current];
  const answeredCount = answers.filter((a) => a > -1).length;
  const lowTime = !practice && secondsLeft <= 300;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col px-4 py-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold">{test.name}</h1>
          <p className="text-xs text-muted-foreground">
            {practice ? 'Practice mode · answers show after each question' : `+${test.marksPerCorrect} per correct · ${negativeLabel(test.negativeMarks)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExamLanguageSwitcher lang={lang} onChange={setLang}/>
          {!test.id.startsWith('custom-') && <ShareTest id={test.id} title={test.name} lang={lang} compact/>}
          <span
            className={`inline-flex min-w-24 items-center justify-center gap-2 rounded-lg px-3 py-2 font-mono text-lg font-semibold tabular-nums ${
              lowTime ? 'bg-red-600 text-white' : 'bg-muted'
            }`}
            role="timer"
            aria-label={practice ? 'Time spent' : 'Time left'}
          >
            <Clock className="h-4 w-4" aria-hidden="true" />
            {formatClock(practice ? elapsed : secondsLeft)}
          </span>
          <Button variant="outline" className="lg:hidden" onClick={() => setPaletteOpen(true)}>
            <Layers className="mr-2 h-4 w-4" aria-hidden="true" />
            Palette
          </Button>
          <Button onClick={() => setConfirming(true)}>{practice ? 'Finish' : 'Submit'}</Button>
        </div>
      </div>

      {test.sections.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto" role="tablist" aria-label="Sections">
          {test.sections.map((s, i) => (
            <button
              key={s.name}
              role="tab"
              aria-selected={i === sectionIndex}
              onClick={() => goTo(s.from)}
              className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-semibold ${
                i === sectionIndex ? 'border-foreground bg-foreground text-background' : 'bg-card hover:border-foreground/50'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 grid flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Question */}
        <section className="min-w-0 rounded-xl border bg-card p-5" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono">
              {labels.question} {current + 1} {labels.of} {test.questions.length}
            </span>
            <span aria-hidden="true">·</span>
            <span>{section.name}</span>
            <button
              onClick={() => toggleSaved(q.id)}
              aria-pressed={saved.includes(q.id)}
              className={`ml-auto inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                saved.includes(q.id) ? 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300' : 'hover:border-foreground/50'
              }`}
            >
              <Bookmark className="h-3.5 w-3.5" aria-hidden="true" />
              {saved.includes(q.id) ? 'Saved' : 'Save question'}
            </button>
          </div>

          {lang!=='en' && translated.state==='unavailable' && <p role="status" className="mt-2 text-xs text-amber-700">{labels.translateError}</p>}
          <h2 lang={lang} className="mt-4 text-xl font-semibold leading-snug">{translated.texts[0]||q.question}</h2>

          <div className="mt-5 grid gap-3" role="group" aria-label="Options">
            {item.order.map((original, position) => {
              const isRight = original === q.answer;
              let tone = 'bg-background hover:border-foreground/50';
              if (done) {
                if (isRight) tone = 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40';
                else if (position === picked) tone = 'border-red-600 bg-red-50 dark:bg-red-950/40';
              } else if (position === picked) tone = 'border-foreground bg-muted';
              return (
                <button
                  key={position}
                  onClick={() => choose(position)}
                  disabled={done}
                  className={`flex min-h-14 w-full items-center gap-4 rounded-xl border px-4 py-3 text-left transition-colors disabled:cursor-default ${tone}`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 font-mono text-sm font-semibold ${
                      done && isRight
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : done && position === picked
                          ? 'border-red-600 bg-red-600 text-white'
                          : position === picked
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-orange-600 text-orange-700 dark:text-orange-400'
                    }`}
                  >
                    {LETTERS[position]}
                  </span>
                  <span lang={lang} className="min-w-0 break-words">{translated.texts[original+1]||q.options[original]}</span>
                </button>
              );
            })}
          </div>

          {done && (
            <div
              className={`mt-5 rounded-xl border-l-4 p-4 ${
                item.order[picked] === q.answer ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' : 'border-red-600 bg-red-50 dark:bg-red-950/40'
              }`}
            >
              <p className="font-semibold">
                {item.order[picked] === q.answer ? 'Correct.' : `Not quite. The answer is ${LETTERS[item.order.indexOf(q.answer)]}.`}
              </p>
              <p lang={lang} className="mt-1 text-sm">{translated.texts[5]||q.explanation}</p>
              <DoubtButton test={test} item={item} index={current} picked={picked} />
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2 border-t pt-4">
            {!practice && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setMarked((m) => m.map((v, k) => (k === current ? true : v)));
                    goTo(current + 1);
                  }}
                >
                  <Flag className="mr-2 h-4 w-4" aria-hidden="true" />
                  Mark for review
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAnswers((a) => a.map((v, k) => (k === current ? -1 : v)));
                    setMarked((m) => m.map((v, k) => (k === current ? false : v)));
                  }}
                >
                  Clear response
                </Button>
              </>
            )}
            <span className="flex-1" />
            <Button variant="outline" onClick={() => goTo(current - 1)} disabled={current === 0}>
              Previous
            </Button>
            {current === test.questions.length - 1 ? (
              <Button onClick={() => setConfirming(true)}>{practice ? 'Finish practice' : 'Save and review'}</Button>
            ) : (
              <Button onClick={() => goTo(current + 1)}>{practice ? 'Next' : 'Save and next'}</Button>
            )}
          </div>
        </section>

        {/* Palette */}
        <aside
          className={`min-w-0 rounded-xl border bg-card p-4 lg:block ${paletteOpen ? 'fixed inset-x-3 bottom-3 top-24 z-50 block overflow-auto shadow-2xl' : 'hidden'}`}
          aria-label="Question palette"
        >
          <div className="mb-3 flex items-center justify-between lg:hidden">
            <h2 className="font-semibold">Question palette</h2>
            <Button variant="outline" size="sm" onClick={() => setPaletteOpen(false)}>
              Close
            </Button>
          </div>
          <PaletteLegend practice={practice} />
          <div className="mt-4 grid gap-4">
            {test.sections.map((s, si) => (
              <div key={s.name}>
                {test.sections.length > 1 && <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.name}</h3>}
                <div className="grid grid-cols-[repeat(auto-fill,minmax(40px,1fr))] gap-2">
                  {Array.from({ length: s.to - s.from }, (_, k) => s.from + k).map((i) => (
                    <PaletteButton
                      key={i}
                      index={i}
                      active={i === current}
                      state={practice ? practiceState(i, checked, answers, items) : stateOf(i)}
                      onClick={() => goTo(i)}
                    />
                  ))}
                </div>
                {si < test.sections.length - 1 && <span className="sr-only">End of section</span>}
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {answeredCount} of {test.questions.length} answered
            {!practice && tabSwitches > 0 ? ` · ${tabSwitches} tab switch${tabSwitches === 1 ? '' : 'es'} noted` : ''}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">Keys: A–D or 1–4 to answer, ← → to move.</p>
        </aside>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="w-full max-w-md rounded-xl border bg-card p-6">
            <h2 id="confirm-title" className="text-lg font-bold">
              {practice ? 'Finish this practice set?' : 'Submit this test?'}
            </h2>
            <ul className="mt-3 space-y-1 text-sm">
              <li>Answered: {answeredCount}</li>
              <li>Not answered: {test.questions.length - answeredCount}</li>
              {!practice && <li>Marked for review: {marked.filter(Boolean).length}</li>}
              {!practice && <li>Time left: {formatClock(secondsLeft)}</li>}
            </ul>
            <p className="mt-3 text-sm text-muted-foreground">
              {practice ? 'You will see your summary and can review every question.' : 'You cannot change answers after submitting.'}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirming(false)}>
                Go back
              </Button>
              <Button onClick={submit}>{practice ? 'Finish' : 'Submit test'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function practiceState(i: number, checked: boolean[], answers: number[], items: Shuffled[]): PaletteState | 'right' | 'wrong' {
  if (!checked[i]) return 'unseen';
  const it = items[i];
  return it.order[answers[i]] === it.question.answer ? 'right' : 'wrong';
}

const PALETTE_STYLE: Record<string, string> = {
  unseen: 'bg-muted text-foreground',
  unanswered: 'bg-red-600 text-white',
  answered: 'bg-emerald-600 text-white',
  marked: 'bg-violet-600 text-white rounded-full',
  'answered-marked': 'bg-violet-600 text-white rounded-full ring-2 ring-emerald-500',
  right: 'bg-emerald-600 text-white',
  wrong: 'bg-red-600 text-white',
};

function PaletteButton({ index, state, active, onClick }: { index: number; state: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={`Question ${index + 1}, ${state.replace('-', ' ')}`}
      aria-current={active ? 'true' : undefined}
      className={`h-10 rounded-lg border-2 font-mono text-sm font-semibold ${PALETTE_STYLE[state]} ${active ? 'border-foreground' : 'border-transparent'}`}
    >
      {index + 1}
    </button>
  );
}

function PaletteLegend({ practice }: { practice: boolean }) {
  const rows = practice
    ? [
        ['bg-emerald-600', 'Correct'],
        ['bg-red-600', 'Wrong'],
        ['bg-muted', 'Not tried'],
      ]
    : [
        ['bg-emerald-600', 'Answered'],
        ['bg-red-600', 'Not answered'],
        ['bg-muted', 'Not visited'],
        ['bg-violet-600 rounded-full', 'Marked'],
      ];
  return (
    <ul className="grid grid-cols-2 gap-2 text-xs">
      {rows.map(([c, label]) => (
        <li key={label} className="flex items-center gap-2">
          <span className={`inline-block h-4 w-4 rounded ${c}`} aria-hidden="true" />
          {label}
        </li>
      ))}
    </ul>
  );
}

function DoubtButton({ test, item, index, picked }: { test: MockTest; item: Shuffled; index: number; picked: number }) {
  const q = item.question;
  const text = [
    `Hi, I have a doubt in "${test.name}", question ${index + 1}.`,
    '',
    q.question,
    ...item.order.map((o, p) => `${LETTERS[p]}) ${q.options[o]}`),
    '',
    `My answer: ${picked > -1 ? LETTERS[picked] : 'not answered'}. Correct answer: ${LETTERS[item.order.indexOf(q.answer)]}.`,
    'Please explain.',
  ].join('\n');
  return <WhatsAppButton text={text} label="Discuss on WhatsApp" variant="outline" className="mt-3" />;
}

// ── Result ─────────────────────────────────────────────

function ResultView({
  test,
  items,
  answers,
  result,
  practice,
  elapsed,
  spent,
  saved,
  onToggleSaved,
  tabSwitches,
  onRetake,
}: {
  test: MockTest;
  items: Shuffled[];
  answers: number[];
  result: ReturnType<typeof scoreTest>;
  practice: boolean;
  elapsed: number;
  spent: number[];
  saved: string[];
  onToggleSaved: (id: string) => void;
  tabSwitches: number;
  onRetake: () => void;
}) {
  const [filter, setFilter] = useState<'all' | 'wrong' | 'skipped' | 'saved'>('all');
  const {lang,setLang}=useExamLanguage();
  const share = `I scored ${result.score} out of ${result.total} (${result.percent}%) in "${test.name}" on Exam Practice Pro. Try it too!`;
  const headline = practice ? `${result.correct} / ${test.questions.length}` : `${result.score} / ${result.total}`;

  const rows = items
    .map((item, i) => ({ item, i, picked: answers[i] }))
    .filter(({ item, picked }) => {
      const status = picked < 0 ? 'skipped' : item.order[picked] === item.question.answer ? 'right' : 'wrong';
      if (filter === 'wrong') return status === 'wrong';
      if (filter === 'skipped') return status === 'skipped';
      if (filter === 'saved') return saved.includes(item.question.id);
      return true;
    });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">{practice ? 'Practice summary' : 'Result'}</p>
        <ExamLanguageSwitcher lang={lang} onChange={setLang}/>
        {!test.id.startsWith('custom-') && <ShareTest id={test.id} title={test.name} lang={lang} compact/>}
      </div>
      <h1 className="mt-1 text-2xl font-bold">{test.name}</h1>

      <div className="mt-5 grid gap-4 rounded-xl border bg-card p-6 sm:grid-cols-[auto_1fr] sm:items-center">
        <p className="text-5xl font-extrabold tabular-nums">{headline}</p>
        <div>
          <p className="font-semibold">{practice ? 'Questions right' : `${result.percent}% of the total marks`}</p>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${result.percent} percent`}>
            <div className="h-full bg-blue-600" style={{ width: `${practice ? Math.round((result.correct / test.questions.length) * 100) : result.percent}%` }} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {result.accuracy >= 75 ? 'Strong attempt. Keep the streak going.' : result.accuracy >= 50 ? 'Good base. Review the wrong answers below.' : 'Practise the weak topics below, then retake this test.'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Correct" value={result.correct} tone="text-emerald-600" />
        <Stat label="Wrong" value={result.wrong} tone="text-red-600" />
        <Stat label="Skipped" value={result.skipped} />
        <Stat label="Accuracy" value={`${result.accuracy}%`} />
        <Stat label="Time taken" value={formatClock(elapsed)} />
      </div>
      {!practice && tabSwitches > 0 && <p className="mt-2 text-xs text-muted-foreground">Tab switches noted during the test: {tabSwitches}</p>}

      <div className="mt-5 flex flex-wrap gap-2">
        <WhatsAppButton text={share} label="Share score on WhatsApp" />
        <WhatsAppButton
          text={`Hi, I just finished "${test.name}" and scored ${practice ? `${result.correct} of ${test.questions.length}` : `${result.score} of ${result.total}`}. Can we plan what to practise next?`}
          label="Talk to a mentor"
          variant="outline"
        />
        <Button variant="outline" onClick={onRetake}>
          Retake
        </Button>
        <Button variant="outline" asChild>
          <Link href="/india-mocks">All mock tests</Link>
        </Button>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="min-w-0 rounded-xl border bg-card p-4">
          <h2 className="font-semibold">By section</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground">
                  <th className="py-1 pr-3">Section</th>
                  <th className="pr-3">Right</th>
                  <th className="pr-3">Wrong</th>
                  <th className="pr-3">Skipped</th>
                  <th>Marks</th>
                </tr>
              </thead>
              <tbody>
                {result.sections.map((s) => (
                  <tr key={s.name} className="border-t">
                    <td className="py-2 pr-3 font-medium">{s.name}</td>
                    <td className="pr-3 tabular-nums">{s.correct}</td>
                    <td className="pr-3 tabular-nums">{s.wrong}</td>
                    <td className="pr-3 tabular-nums">{s.skipped}</td>
                    <td className="tabular-nums">{s.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="min-w-0 rounded-xl border bg-card p-4">
          <h2 className="font-semibold">By topic</h2>
          <ul className="mt-3 space-y-3">
            {result.topics.map((t) => {
              const pct = t.attempted ? Math.round((t.correct / t.attempted) * 100) : 0;
              const label = !t.attempted ? 'Not attempted' : pct >= 75 ? 'Strong' : pct >= 50 ? 'Improving' : 'Needs work';
              const bar = pct >= 75 ? 'bg-emerald-600' : pct >= 50 ? 'bg-amber-500' : 'bg-red-600';
              return (
                <li key={t.name}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="min-w-0 break-words">{t.name}</span>
                    <span className="shrink-0 font-mono text-xs">
                      {t.correct}/{t.attempted} · {label}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <h2 className="mt-10 text-xl font-bold">Review every question</h2>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter review">
        {(['all', 'wrong', 'skipped', 'saved'] as const).map((f) => (
          <button
            key={f}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium capitalize ${filter === f ? 'border-foreground bg-foreground text-background' : 'bg-card'}`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-4">
        {rows.length === 0 && <p className="text-muted-foreground">Nothing here yet.</p>}
        {rows.map(({ item, i, picked }) => {
          const q = item.question;
          const status = picked < 0 ? 'skipped' : item.order[picked] === q.answer ? 'right' : 'wrong';
          const border = status === 'right' ? 'border-l-emerald-600' : status === 'wrong' ? 'border-l-red-600' : 'border-l-amber-500';
          return (
            <article key={q.id + i} className={`rounded-xl border border-l-4 bg-card p-4 ${border}`}>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">Q{i + 1}</span>
                <span aria-hidden="true">·</span>
                <span>{q.topicName}</span>
                <span className="ml-auto rounded px-2 py-0.5 font-mono font-semibold uppercase">{status === 'right' ? 'Correct' : status === 'wrong' ? 'Wrong' : 'Skipped'}</span>
                <span className="font-mono">{spent[i]}s</span>
                <button
                  onClick={() => onToggleSaved(q.id)}
                  aria-pressed={saved.includes(q.id)}
                  className="rounded-lg border px-2 py-1 font-semibold"
                >
                  {saved.includes(q.id) ? 'Saved' : 'Save'}
                </button>
              </div>
              <p className="mt-2 font-semibold">{q.question}</p>
              <ol className="mt-3 space-y-1.5">
                {item.order.map((original, p) => {
                  const right = original === q.answer;
                  const mine = p === picked && !right;
                  return (
                    <li
                      key={p}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${right ? 'bg-emerald-50 dark:bg-emerald-950/40' : mine ? 'bg-red-50 dark:bg-red-950/40' : 'bg-muted/50'}`}
                    >
                      <span className="w-5 font-mono text-xs font-semibold">{LETTERS[p]}</span>
                      <span className="min-w-0 break-words">{q.options[original]}</span>
                      {right && <span className="ml-auto shrink-0 font-mono text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-400">Right answer</span>}
                      {mine && <span className="ml-auto shrink-0 font-mono text-xs font-semibold uppercase text-red-700 dark:text-red-400">Your answer</span>}
                    </li>
                  );
                })}
              </ol>
              <div className="mt-3 rounded-lg bg-muted/60 p-3 text-sm">
                <b>Why:</b> {q.explanation}
              </div>
              <DoubtButton test={test} item={item} index={i} picked={picked} />
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, tone = '' }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
