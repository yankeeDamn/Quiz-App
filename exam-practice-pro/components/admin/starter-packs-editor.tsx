'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { admin } from '@/lib/admin';
import { Field, LETTERS, Notice, card, input } from '@/components/admin/ui';

type Difficulty = 'Easy' | 'Moderate' | 'Hard';
interface PackQuestion { id: string; question: string; options: string[]; answer: number; explanation: string; difficulty?: string; source: 'bundled' | 'added'; edited: boolean }
interface Pack { id: string; name: string; canAddRemove: boolean; questions: PackQuestion[] }
interface Draft { question: string; options: string[]; answer: number; explanation: string; difficulty: Difficulty }

const NEW = '__new__';
const blank = (): Draft => ({ question: '', options: ['', '', '', ''], answer: 0, explanation: '', difficulty: 'Moderate' });
const toDraft = (q: PackQuestion): Draft => ({
  question: q.question, options: [...q.options], answer: q.answer, explanation: q.explanation,
  difficulty: (['Easy', 'Moderate', 'Hard'].includes(q.difficulty || '') ? q.difficulty : 'Moderate') as Difficulty,
});

/**
 * Edits the Free, practice-only exam starter packs. Railways supports add, edit and delete;
 * Banking and UPSC support editing questions, options, correct answers and explanations.
 * Saved changes reach learners' practice sessions without a redeploy.
 */
export function StarterPacksEditor() {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [packId, setPackId] = useState('railways-rrb-starter');
  const [requestedId, setRequestedId] = useState('');
  const [edit, setEdit] = useState<{ key: string; draft: Draft } | null>(null);
  const [rev, setRev] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmFor, setConfirmFor] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const pack = useMemo(() => packs.find(p => p.id === packId), [packs, packId]);
  // Fall back to the first question when the requested one is gone (pack switch, delete).
  const questionId = requestedId === NEW || pack?.questions.some(q => q.id === requestedId)
    ? requestedId : pack?.questions[0]?.id ?? '';
  const current = pack?.questions.find(q => q.id === questionId);
  const adding = questionId === NEW;
  const editKey = `${packId}:${questionId}:${rev}`;
  const draft: Draft | null = edit?.key === editKey ? edit.draft
    : adding ? blank() : current ? toDraft(current) : null;
  const setDraft = (next: Draft) => setEdit({ key: editKey, draft: next });
  const choose = (id: string) => { setRequestedId(id); setMessage(null); };

  const load = useCallback(async () => {
    const result = await admin<{ packs: Pack[] }>('/practice/starter-packs');
    if (!result.ok) { setMessage({ kind: 'error', text: result.message }); return null; }
    setPacks(result.data.packs);
    setRev(n => n + 1); // discard stale form edits after every reload
    return result.data.packs;
  }, []);

  useEffect(() => {
    let live = true;
    void admin<{ packs: Pack[] }>('/practice/starter-packs').then(result => {
      if (!live) return;
      if (result.ok) setPacks(result.data.packs); else setMessage({ kind: 'error', text: result.message });
      setLoading(false);
    });
    return () => { live = false; };
  }, []);

  const valid = !!draft && draft.question.trim().length >= 5 && draft.explanation.trim().length >= 3 &&
    draft.options.every(o => o.trim()) && new Set(draft.options.map(o => o.trim().toLowerCase())).size === 4;

  async function save() {
    if (!draft || !pack || busy) return;
    setBusy(true); setMessage(null);
    try {
      const path = `/practice/starter-packs/${pack.id}/questions`;
      const result = adding
        ? await admin<{ question: { id: string } }>(path, 'POST', { question: draft })
        : await admin<{ question: { id: string } }>(`${path}/${encodeURIComponent(questionId)}`, 'PUT', { question: draft });
      if (!result.ok) { setMessage({ kind: 'error', text: result.message }); return; }
      await load();
      choose(result.data.question.id); setMessage({ kind: 'ok', text: adding ? 'Question added. Learners see it in practice mode now.' : 'Saved. Learners see the update in practice mode now.' });
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!pack || !current || busy) return;
    setBusy(true); setMessage(null);
    try {
      const result = await admin(`/practice/starter-packs/${pack.id}/questions/${encodeURIComponent(current.id)}`, 'DELETE');
      if (!result.ok) { setMessage({ kind: 'error', text: result.message }); return; }
      await load();
      choose('');
      setMessage({ kind: 'ok', text: 'Question deleted from the practice pack.' });
    } finally { setBusy(false); setConfirmFor(''); }
  }

  return <div className="grid gap-5">
    <section className={card}>
      <h2 className="text-lg font-bold">Exam starter packs</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Free, practice-only question packs shown on the India Mocks page. Changes are saved to the database and
        appear in learners&apos; practice sessions without a redeploy. The original questions stay as a fallback if the API is offline.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Railways RRB Starter: add, edit and delete questions. Banking IBPS and UPSC General Studies: edit questions, options,
        correct answers and explanations. Packs are never scored on the server and never require a paid plan.
      </p>
    </section>
    {message && <Notice kind={message.kind}>{message.text}</Notice>}
    <section className={card}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starter pack"><select className={input} value={packId} onChange={e => { setPackId(e.target.value); choose(''); }}>
          {(packs.length ? packs : [{ id: packId, name: 'Railways RRB Starter' }]).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select></Field>
        <Field label={`Question (${pack?.questions.length ?? 0})`}><select className={input} value={questionId} disabled={!pack}
          onChange={e => choose(e.target.value)}>
          {adding && <option value={NEW}>New question</option>}
          {pack?.questions.map((q, i) => <option key={q.id} value={q.id}>{i + 1}. {q.question.slice(0, 65)}{q.edited ? ' (edited)' : q.source === 'added' ? ' (added)' : ''}</option>)}
        </select></Field>
      </div>
      {pack?.canAddRemove && <div className="mt-4"><Button variant="outline" disabled={busy || adding} onClick={() => choose(NEW)}>Add question</Button></div>}
    </section>
    {loading && <p className="text-sm text-muted-foreground">Loading starter packs…</p>}
    {draft && pack && <section className={`${card} grid gap-4`}>
      <div className="flex flex-wrap justify-between gap-2">
        <h3 className="font-semibold">{adding ? `Add a question to ${pack.name}` : 'Edit question'}</h3>
        {!adding && <code className="text-xs text-muted-foreground">{questionId}</code>}
      </div>
      <Field label="Question"><textarea className={`${input} min-h-24`} value={draft.question} maxLength={600}
        onChange={e => setDraft({ ...draft, question: e.target.value })} /></Field>
      <p className="text-sm font-semibold">Answer options — select the one correct answer</p>
      {draft.options.map((option, i) => <div className="flex items-center gap-3" key={LETTERS[i]}>
        <label className="flex min-w-10 items-center gap-2 text-xs font-semibold">
          <input type="radio" name="starter-pack-answer" checked={draft.answer === i} onChange={() => setDraft({ ...draft, answer: i })} />
          {LETTERS[i]}
        </label>
        <input aria-label={`Option ${LETTERS[i]}`} className={input} value={option} maxLength={200}
          onChange={e => setDraft({ ...draft, options: draft.options.map((v, k) => k === i ? e.target.value : v) })} />
      </div>)}
      <Field label="Explanation"><textarea className={`${input} min-h-28`} value={draft.explanation} maxLength={1000}
        onChange={e => setDraft({ ...draft, explanation: e.target.value })} /></Field>
      <Field label="Difficulty"><select className={input} value={draft.difficulty} onChange={e => setDraft({ ...draft, difficulty: e.target.value as Difficulty })}>
        {['Easy', 'Moderate', 'Hard'].map(d => <option key={d}>{d}</option>)}
      </select></Field>
      {!valid && <p className="text-xs text-muted-foreground">Needs a question, four different options, a correct answer and an explanation.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void save()} disabled={busy || loading || !valid}>{busy ? 'Saving…' : adding ? 'Add question' : 'Save question'}</Button>
        {adding
          ? <Button variant="outline" disabled={busy} onClick={() => choose('')}>Cancel</Button>
          : <Button variant="outline" disabled={busy || !current} onClick={() => setEdit(null)}>Discard changes</Button>}
        {pack.canAddRemove && !adding && (confirmFor === questionId
          ? <>
              <Button variant="destructive" disabled={busy} onClick={() => void remove()}>Confirm delete</Button>
              <Button variant="outline" disabled={busy} onClick={() => setConfirmFor('')}>Keep question</Button>
            </>
          : <Button variant="outline" disabled={busy || pack.questions.length <= 1} onClick={() => setConfirmFor(questionId)}>Delete question</Button>)}
      </div>
    </section>}
  </div>;
}
