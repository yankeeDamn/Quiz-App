/* eslint-disable react-hooks/set-state-in-effect -- these effects load data from the API when the page opens */
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { admin, type AdminTest, type AdminTopic, type TestSection } from '@/lib/admin';
import { Field, Notice, card, input } from '@/components/admin/ui';

interface Draft {
  id: string;
  name: string;
  exam: string;
  level: string;
  tier: 'free' | 'premium';
  minutes: string;
  marksPerCorrect: string;
  negativeMarks: string;
  passPercent: string;
  sections: TestSection[];
  active: boolean;
}

const blank = (topic: string): Draft => ({
  id: '', name: '', exam: '', level: 'Moderate', tier: 'free', minutes: '30', marksPerCorrect: '1', negativeMarks: '0.25', passPercent:'50',
  sections: [{ name: '', parts: [{ topic, from: 0, to: 10 }] }], active: false,
});

const countOf = (t: AdminTest) => t.active && t.questionCount !== undefined ? t.questionCount : t.sections.reduce((n, s) => n + s.parts.reduce((m, p) => m + (p.to - p.from), 0), 0);

export function TestsTab() {
  const [tests, setTests] = useState<AdminTest[]>([]);
  const [topics, setTopics] = useState<AdminTopic[]>([]);
  const [draftTestingEnabled,setDraftTestingEnabled] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{name:string;minutes:number;questionCount:number;questions:{id:string;question:string}[]}|null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    const [t, p, status] = await Promise.all([admin<{ tests: AdminTest[] }>('/tests'), admin<{ topics: AdminTopic[] }>('/topics'), admin<{enabled:boolean}>('/draft-testing/status')]);
    setDraftTestingEnabled(status.ok && status.data.enabled);
    if (t.ok) setTests(t.data.tests); else setMsg({ kind: 'error', text: t.message });
    if (p.ok) setTopics(p.data.topics);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const toBody = (d: Draft) => ({
    id: d.id, name: d.name, exam: d.exam, level: d.level, tier: d.tier, minutes: Number(d.minutes),
    marksPerCorrect: Number(d.marksPerCorrect), negativeMarks: Number(d.negativeMarks), passPercent:Number(d.passPercent), sections: d.sections, active: d.active,
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const existing = tests.find(t => t.id === editingId);
    if (draft.active && !existing?.active &&
      !window.confirm('Publish this mock to learners? All source topics must already be active and every configured question present. Finish academic, language and accessibility review first.')) return;
    setMsg(null);
    const r = editingId ? await admin(`/tests/${editingId}`, 'PUT', toBody(draft)) : await admin('/tests', 'POST', toBody(draft));
    if (r.ok) {
      setMsg({ kind: 'ok', text: editingId ? 'Test saved.' : 'Draft created. Publish it when ready.' });
      setDraft(null);
      setEditingId(null);
      void load();
    } else setMsg({ kind: 'error', text: r.message });
  };

  const quick = async (t: AdminTest, change: Partial<AdminTest>) => {
    if (change.active === true && !t.active &&
      !window.confirm('Publish "' + t.name + '" to learners? This is NOT a private Test Draft. Source topics must be active and all questions reviewed.')) return;
    const next = { ...t, ...change };
    const r = await admin(`/tests/${t.id}`, 'PUT', next);
    if (!r.ok) setMsg({ kind: 'error', text: r.message });
    void load();
  };

  const showPreview = async(t:AdminTest)=>{
    const r=await admin<{name:string;minutes:number;questionCount:number;questions:{id:string;question:string}[]}>(`/tests/${t.id}/preview`);
    if(r.ok)setPreview(r.data);else setMsg({kind:'error',text:r.message});
  };

  const edit = (t: AdminTest) => {
    setEditingId(t.id);
    setDraft({ ...t, minutes: String(t.minutes), marksPerCorrect: String(t.marksPerCorrect), negativeMarks: String(t.negativeMarks), passPercent:String(t.passPercent??50) });
  };

  const setSection = (i: number, s: TestSection) => draft && setDraft({ ...draft, sections: draft.sections.map((x, k) => (k === i ? s : x)) });
  const firstTopic = topics[0]?.id ?? '';

  return (
    <div className="grid gap-6">
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Full mock tests</h2>
          <Button onClick={() => { setEditingId(null); setDraft(blank(firstTopic)); }}>New mock test</Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Topic tests are made automatically for every topic with questions, and are always free.</p>
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Publishing is separate from Test Draft: the backend blocks it until all referenced topics and question positions are active. Complete independent editorial and accessibility review before activating topics.</p>
        {draftTestingEnabled && <p className="mt-2 rounded-lg border border-amber-400 p-3 text-xs" role="status">Staging draft exam QA is enabled for verified admins. Use <strong>Test Draft</strong> to start a private, server-timed exam without publishing topics or tests. Draft question counts are configured ranges; use Preview to verify active question rows.</p>}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-muted-foreground"><th className="py-1 pr-3">Test</th><th className="pr-3">Exam</th><th className="pr-3">Questions</th><th className="pr-3">Access</th><th className="pr-3">Live</th><th /></tr></thead>
            <tbody>
              {tests.map((t) => (
                <tr key={t.id} className={`border-t ${t.active ? '' : 'opacity-60'}`}>
                  <td className="py-2 pr-3 font-medium">{t.name}<span className="block font-mono text-xs font-normal text-muted-foreground">{t.id}</span></td>
                  <td className="pr-3">{t.exam}</td>
                  <td className="pr-3 tabular-nums">{countOf(t)}</td>
                  <td className="pr-3">
                    <button className="rounded border px-2 py-1 text-xs font-semibold" onClick={() => void quick(t, { tier: t.tier === 'free' ? 'premium' : 'free' })} aria-label={`Change access for ${t.name}`}>
                      {t.tier === 'free' ? 'Free' : 'Pro only'}
                    </button>
                  </td>
                  <td className="pr-3">
                    <button className="rounded border px-2 py-1 text-xs font-semibold" onClick={() => void quick(t, { active: !t.active })} aria-label={`Publish or unpublish ${t.name}`} title="Publishing requires active source topics, all questions present, and confirmation">
                      {t.active ? 'Published' : 'Draft'}
                    </button>
                  </td>
                  <td className="text-right whitespace-nowrap">
                    {!t.active && draftTestingEnabled && <><Link className="font-semibold text-indigo-700 underline dark:text-indigo-300" href={`/admin/draft-test/${encodeURIComponent(t.id)}`}>Test Draft</Link> · </>}
                    <button className="underline" onClick={() => void showPreview(t)}>Preview</button> · <button className="underline" onClick={() => edit(t)}>Edit</button>
                  </td>
                </tr>
              ))}
              {tests.length === 0 && <tr><td colSpan={6} className="py-3 text-muted-foreground">No mock tests yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {preview && <section className={card}><h2 className="text-lg font-semibold">Preview: {preview.name}</h2><p className="text-sm text-muted-foreground">{preview.questionCount} active questions · {preview.minutes} minutes. Only published tests appear in the student catalogue.</p><ol className="mt-3 list-inside list-decimal space-y-1 text-sm">{preview.questions.slice(0,30).map(q=><li key={q.id}>{q.question}</li>)}</ol><Button className="mt-4" variant="outline" onClick={()=>setPreview(null)}>Close preview</Button></section>}

      {draft && (
        <form onSubmit={save} className={`${card} grid gap-4`}>
          <h2 className="text-lg font-bold">{editingId ? `Edit ${editingId}` : 'New mock test'}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {!editingId && <Field label="Id" hint="Lower case, dashes, for example ssc3"><input className={input} required value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value })} /></Field>}
            <Field label="Name"><input className={input} required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></Field>
            <Field label="Exam group" hint="SSC, Banking, Railways… decides the filter it appears under"><input className={input} required value={draft.exam} onChange={(e) => setDraft({ ...draft, exam: e.target.value })} /></Field>
            <Field label="Level">
              <select className={input} value={draft.level} onChange={(e) => setDraft({ ...draft, level: e.target.value })}>
                {['Easy', 'Moderate', 'Hard'].map((l) => <option key={l}>{l}</option>)}
              </select>
            </Field>
            <Field label="Access">
              <select className={input} value={draft.tier} onChange={(e) => setDraft({ ...draft, tier: e.target.value as 'free' | 'premium' })}>
                <option value="free">Free for everyone</option>
                <option value="premium">Pro plan only</option>
              </select>
            </Field>
            <Field label="Minutes"><input className={input} type="number" min={1} max={300} required value={draft.minutes} onChange={(e) => setDraft({ ...draft, minutes: e.target.value })} /></Field>
            <Field label="Marks per right answer"><input className={input} type="number" step="0.25" min={0.25} required value={draft.marksPerCorrect} onChange={(e) => setDraft({ ...draft, marksPerCorrect: e.target.value })} /></Field>
            <Field label="Pass percentage"><input className={input} type="number" min={0} max={100} required value={draft.passPercent} onChange={e=>setDraft({...draft,passPercent:e.target.value})}/></Field>
            <Field label="Marks lost per wrong answer"><input className={input} type="number" step="0.01" min={0} required value={draft.negativeMarks} onChange={(e) => setDraft({ ...draft, negativeMarks: e.target.value })} /></Field>
          </div>

          <div className="grid gap-4">
            {draft.sections.map((s, si) => (
              <fieldset key={si} className="grid gap-3 rounded-lg border p-3">
                <legend className="px-1 text-sm font-semibold">Section {si + 1}</legend>
                <Field label="Section name"><input className={input} required value={s.name} onChange={(e) => setSection(si, { ...s, name: e.target.value })} /></Field>
                {s.parts.map((p, pi) => {
                  const t = topics.find((x) => x.id === p.topic);
                  const setPart = (change: Partial<typeof p>) => setSection(si, { ...s, parts: s.parts.map((x, k) => (k === pi ? { ...x, ...change } : x)) });
                  return (
                    <div key={pi} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_90px_90px_auto]">
                      <Field label="Questions from topic" hint={t ? `Numbers #0 to #${Math.max(0, t.total - 1)} exist` : undefined}>
                        <select className={input} value={p.topic} onChange={(e) => setPart({ topic: e.target.value })}>
                          {topics.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                        </select>
                      </Field>
                      <Field label="From #"><input className={input} type="number" min={0} value={p.from} onChange={(e) => setPart({ from: Number(e.target.value) })} /></Field>
                      <Field label="Up to #"><input className={input} type="number" min={1} value={p.to} onChange={(e) => setPart({ to: Number(e.target.value) })} /></Field>
                      <button type="button" className="min-h-10 text-sm underline" disabled={s.parts.length === 1} onClick={() => setSection(si, { ...s, parts: s.parts.filter((_, k) => k !== pi) })}>Remove</button>
                    </div>
                  );
                })}
                <div className="flex gap-3">
                  <Button type="button" variant="outline" size="sm" onClick={() => setSection(si, { ...s, parts: [...s.parts, { topic: firstTopic, from: 0, to: 10 }] })}>Add topic range</Button>
                  {draft.sections.length > 1 && <Button type="button" variant="outline" size="sm" onClick={() => setDraft({ ...draft, sections: draft.sections.filter((_, k) => k !== si) })}>Remove section</Button>}
                </div>
              </fieldset>
            ))}
            <div><Button type="button" variant="outline" onClick={() => setDraft({ ...draft, sections: [...draft.sections, { name: '', parts: [{ topic: firstTopic, from: 0, to: 10 }] }] })}>Add section</Button></div>
          </div>
          <p className="text-xs text-muted-foreground">&ldquo;From #&rdquo; is included, &ldquo;Up to #&rdquo; is not. 0 to 10 means the first ten questions of the topic. Use different ranges in different tests so learners do not see the same questions.</p>
          <div className="flex gap-2">
            <Button type="submit">{editingId ? 'Save test' : 'Create test'}</Button>
            <Button type="button" variant="outline" onClick={() => { setDraft(null); setEditingId(null); }}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
}
