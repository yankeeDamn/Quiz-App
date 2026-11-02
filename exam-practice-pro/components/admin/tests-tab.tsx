/* eslint-disable react-hooks/set-state-in-effect -- these effects load data from the API when the page opens */
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { admin, type AdminTest, type AdminTopic, type TestSection } from '@/lib/admin';
import { Field, Notice, card, input } from '@/components/admin/ui';
import { LiveCatalogue } from '@/components/admin/live-catalogue';
import { PublicationChecklist } from '@/components/admin/publication-checklist';
import { MockReview } from '@/components/admin/mock-review';
import { MockReleaseReadiness } from '@/components/admin/mock-release-readiness';

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

const countOf = (t: AdminTest) => t.configuredQuestionCount ?? t.sections.reduce((n, s) => n + s.parts.reduce((m, p) => m + (p.to - p.from), 0), 0);
const changed = () => window.dispatchEvent(new Event('exampro-catalogue-changed'));

export function TestsTab({onEditQuestions,initialView='all'}:{onEditQuestions?:(topic:string)=>void;initialView?:'all'|'live'|'hidden'}) {
  const [view,setView]=useState(initialView);
  const [checklistId,setChecklistId]=useState<string|null>(null);
  const [search,setSearch]=useState('');
  const [category,setCategory]=useState('all');
  const [busy,setBusy]=useState(false);
  const [bulk,setBulk]=useState<{id:string;name:string;ready:boolean;blocker:string|null}[]|null>(null);
  const [tests, setTests] = useState<AdminTest[]>([]);
  const [topics, setTopics] = useState<AdminTopic[]>([]);
  const [draftTestingEnabled,setDraftTestingEnabled] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reviewId,setReviewId] = useState<string|null>(null);
  const [readinessId,setReadinessId] = useState<string|null>(null);
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
    setMsg(null);setBusy(true);
    const r = editingId ? await admin(`/tests/${editingId}`, 'PUT', toBody(draft)) : await admin('/tests', 'POST', toBody(draft));
    setBusy(false);
    if (r.ok) {
      changed();
      setMsg({ kind: 'ok', text: editingId ? 'Test saved.' : 'Draft created. Publish it when ready.' });
      setDraft(null);
      setEditingId(null);
      void load();
    } else setMsg({ kind: 'error', text: r.message });
  };

  const quick = async (t: AdminTest, change: Partial<AdminTest>) => {
    if(busy)return;
    if (change.active === true && !t.active &&
      !window.confirm('Publish "' + t.name + '" to learners? Source topics and every question must pass review.')) return;
    if (change.tier && !window.confirm(`Change "${t.name}" to ${change.tier==='free'?'Free':'Pro'}? Source question access and review checks still apply.`)) return;
    setBusy(true);setMsg(null);
    const r = await admin(`/tests/${t.id}`, 'PUT', { ...t, ...change });
    setBusy(false);
    setMsg(r.ok?{kind:'ok',text:'Test updated. Catalogue pages refresh on focus or within 30 seconds.'}:{kind:'error',text:r.message});
    if(r.ok)changed();
    else if(r.status===409)setChecklistId(t.id);
    await load();
  };
  const checkBulk=async()=>{
    setBusy(true);setMsg(null);
    const r=await admin<{candidates:{id:string;name:string;ready:boolean;blocker:string|null}[]}>('/tests/publication-candidates');
    setBusy(false);
    if(r.ok)setBulk(r.data.candidates);else setMsg({kind:'error',text:r.message});
  };
  const publishReviewed=async()=>{
    const ready=bulk?.filter(t=>t.ready)??[];
    if(!ready.length||!window.confirm(`Publish these ${ready.length} reviewed drafts?\n${ready.map(t=>t.name).join('\n')}`))return;
    setBusy(true);let published=0;const failed:string[]=[];
    for(const item of ready){
      const t=tests.find(t=>t.id===item.id);
      if(!t){failed.push(item.name+': reload required');continue;}
      const r=await admin(`/tests/${t.id}`,'PUT',{...t,active:true});
      if(r.ok)published++;else failed.push(`${t.name}: ${r.message}`);
    }
    setBusy(false);setBulk(null);changed();await load();
    setMsg({kind:failed.length?'error':'ok',text:`${published} published. ${failed.length?failed.join('; '):'All selected drafts passed the server review gates.'}`});
  };
  const remove=async(t:AdminTest)=>{
    if(!window.confirm(`Delete the draft definition "${t.name}"? Source questions are retained. Definitions with attempts or reserved shared paid questions cannot be deleted.`))return;
    setBusy(true);const r=await admin(`/tests/${t.id}`,'DELETE');setBusy(false);
    setMsg(r.ok?{kind:'ok',text:'Draft definition deleted; source questions retained.'}:{kind:'error',text:r.message});
    if(r.ok)changed();await load();
  };
  const duplicate=(t:AdminTest)=>{
    setEditingId(null);setDraft({...t,id:'',name:`${t.name} (Copy)`.slice(0,120),active:false,
      minutes:String(t.minutes),marksPerCorrect:String(t.marksPerCorrect),negativeMarks:String(t.negativeMarks),passPercent:String(t.passPercent??50)});
    setMsg({kind:'ok',text:'Choose a new ID to duplicate this definition as a draft. The copy shares source questions; it is not a distinct question bank.'});
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

      <div role="group" aria-label="Admin mock views" className="flex flex-wrap gap-2">
        {([['all',`All mock definitions (${tests.length})`],['live','Live Catalogue'],['hidden',`Drafts / Hidden (${tests.filter(t=>!t.liveInCatalogue).length})`]] as const).map(([id,label])=><Button key={id} variant={view===id?'default':'outline'} aria-pressed={view===id} onClick={()=>setView(id)}>{label}</Button>)}
      </div>
      {view==='live'?<LiveCatalogue definitions={tests} onEditQuestions={onEditQuestions}/>:<section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Mocks &amp; Tests Manager</h2>
          <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={()=>void checkBulk()}>Publish All Reviewed Drafts</Button><Button disabled={busy} onClick={() => { setEditingId(null); setDraft(blank(firstTopic)); }}>+ Create New Mock Test</Button></div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Topic tests are made automatically for every topic with questions, and are always free.</p>
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Publishing is separate from Test Draft: the backend blocks it until all referenced topics and question positions are active. Complete independent editorial and accessibility review before activating topics.</p>
        {draftTestingEnabled && <p className="mt-2 rounded-lg border border-amber-400 p-3 text-xs" role="status">Staging draft exam QA is enabled for verified admins. Use <strong>Test Draft</strong> to start a private, server-timed exam without publishing topics or tests. Draft question counts are configured ranges; use Preview to verify active question rows.</p>}
        <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]"><input className={input} aria-label="Search mock tests" placeholder="Search test name or ID…" value={search} onChange={e=>setSearch(e.target.value)}/><select className={input} aria-label="Filter mock test category" value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All categories</option>{[...new Set(tests.map(t=>t.exam))].sort().map(exam=><option key={exam}>{exam}</option>)}</select></div>
        {bulk&&<div className="mt-4 space-y-3 rounded-xl border bg-muted/30 p-4"><h3 className="font-bold">Review publication candidates</h3><p className="text-sm">{bulk.filter(t=>t.ready).length} ready of {bulk.length} drafts. Each will be checked again when published.</p><ul className="max-h-60 space-y-2 overflow-y-auto text-xs">{bulk.map(t=><li key={t.id}><strong>{t.name}</strong> · {t.ready?'Ready':t.blocker}</li>)}</ul><div className="flex flex-wrap gap-2"><Button disabled={busy||!bulk.some(t=>t.ready)} onClick={()=>void publishReviewed()}>{busy?'Publishing…':'Publish reviewed candidates'}</Button><Button variant="outline" disabled={busy} onClick={()=>setBulk(null)}>Cancel</Button></div></div>}
        <div className="mt-5 overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground"><th className="p-3">Test Name &amp; Exam</th><th className="p-3">Questions / Mins</th><th className="p-3">Current Tier</th><th className="p-3">Publish Status</th><th className="p-3">Sectional Timer</th><th className="p-3">Actions</th></tr></thead>
            <tbody>
              {tests.filter(t=>(view!=='hidden'||!t.liveInCatalogue)&&(category==='all'||t.exam===category)&&`${t.name} ${t.id}`.toLowerCase().includes(search.toLowerCase())).map((t) => (
                <tr key={t.id} className="border-t align-top hover:bg-muted/20">
                  <td className="min-w-52 p-3"><p className="font-semibold">{t.name}</p><span className="mt-1 block text-xs text-muted-foreground">{t.exam} · {t.id}</span>{t.hiddenReason&&<p className="mt-2 max-w-xs text-xs text-amber-700 dark:text-amber-300">{t.hiddenReason}</p>}</td>
                  <td className="p-3 text-xs tabular-nums"><p className="whitespace-nowrap">{countOf(t)} Qs · {t.minutes} mins</p><p className="mt-1 text-muted-foreground">{t.questionCount??0} accessible</p></td>
                  <td className="p-3"><button type="button" disabled={busy} className={`min-h-10 whitespace-nowrap rounded-full px-3 text-xs font-bold disabled:opacity-50 ${t.tier==='free'?'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200':'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200'}`} onClick={() => void quick(t, { tier: t.tier === 'free' ? 'premium' : 'free' })} aria-label={`Change access for ${t.name}`}>{t.tier === 'free' ? '● Free' : '★ PRO'}</button></td>
                  <td className="p-3"><button type="button" disabled={busy} className={`min-h-10 whitespace-nowrap rounded-full border px-3 text-xs font-semibold disabled:opacity-50 ${t.active&&t.liveInCatalogue?'border-emerald-300 text-emerald-700 dark:text-emerald-300':'border-amber-300 text-amber-800 dark:text-amber-300'}`} onClick={() => void quick(t, { active: !t.active })} aria-label={`Publish or unpublish ${t.name}`}>{t.active?(t.liveInCatalogue?'Published · Live':'Active · Hidden'):'Draft · Hidden'}</button></td>
                  <td className="p-3"><span className="inline-block whitespace-nowrap rounded-lg bg-muted px-2 py-1.5 text-xs">{t.sectionTimingMinutes?`${t.sectionTimingMinutes}m Section Locks`:'Standard / pending validation'}</span></td>
                  <td className="min-w-60 p-3"><div className="flex max-w-xs flex-wrap gap-x-3 gap-y-2 text-xs">
                    {!t.active && draftTestingEnabled && <Link className="min-h-8 font-semibold text-indigo-700 underline dark:text-indigo-300" href={`/admin/draft-test/${encodeURIComponent(t.id)}`}>Test Draft</Link>}
                    {countOf(t)===100&&/ssc/i.test(t.exam)&&/cgl/i.test(t.name)&&<button type="button" className="min-h-8 underline" onClick={() => {setReadinessId(t.id);setReviewId(null);setPreview(null)}}>Release readiness</button>}
                    <button type="button" className="min-h-8 font-semibold text-indigo-700 underline dark:text-indigo-300" onClick={()=>setChecklistId(t.id)}>Publication checklist</button>
                    <button type="button" className="min-h-8 underline" onClick={() => onEditQuestions?.(t.sections[0]?.parts[0]?.topic??'')}>Edit Questions</button>
                    {countOf(t)===100&&/ssc/i.test(t.exam)&&/cgl/i.test(t.name)&&<button type="button" className="min-h-8 underline" onClick={() => {setReviewId(t.id);setReadinessId(null);setPreview(null)}}>Academic Review</button>}
                    <button type="button" className="min-h-8 underline" onClick={() => void showPreview(t)}>Preview Test</button>
                    <button type="button" className="min-h-8 underline" onClick={() => edit(t)}>Edit</button>
                    <button type="button" className="min-h-8 underline" disabled={busy} onClick={() => duplicate(t)}>Duplicate</button>
                    <button type="button" className="min-h-8 text-red-700 underline disabled:opacity-40 dark:text-red-300" disabled={busy||t.active} onClick={()=>void remove(t)}>Delete</button>
                  </div></td>
                </tr>
              ))}
              {tests.length>0&&!tests.some(t=>(view!=='hidden'||!t.liveInCatalogue)&&(category==='all'||t.exam===category)&&`${t.name} ${t.id}`.toLowerCase().includes(search.toLowerCase()))&&<tr><td colSpan={6} className="p-5 text-muted-foreground">No tests match this search.</td></tr>}
              {tests.length === 0 && <tr><td colSpan={6} className="p-5 text-muted-foreground">No mock tests loaded. Create a draft, or check any API error above.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>}

      {checklistId&&<PublicationChecklist key={checklistId} testId={checklistId} onClose={()=>setChecklistId(null)} onEditQuestions={onEditQuestions}/>}
      {readinessId && <MockReleaseReadiness key={readinessId} testId={readinessId} onClose={()=>setReadinessId(null)} />}
      {reviewId && <MockReview key={reviewId} testId={reviewId} onClose={()=>setReviewId(null)} />}

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
            <Button disabled={busy} type="submit">{editingId ? 'Save test' : 'Create test'}</Button>
            <Button type="button" variant="outline" onClick={() => { setDraft(null); setEditingId(null); }}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
}
