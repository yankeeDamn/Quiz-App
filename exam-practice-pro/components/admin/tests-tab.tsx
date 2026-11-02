/* eslint-disable react-hooks/set-state-in-effect -- these effects load data from the API when the page opens */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { admin, type AdminTest, type AdminTopic, type TestSection } from '@/lib/admin';
import { Field, Notice, card, input } from '@/components/admin/ui';
import { LiveCatalogue } from '@/components/admin/live-catalogue';
import { PublicationChecklist } from '@/components/admin/publication-checklist';
import { MockReview } from '@/components/admin/mock-review';
import { MockReleaseReadiness } from '@/components/admin/mock-release-readiness';
import { MockManager } from '@/components/admin/mock-manager';

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

const changed = () => window.dispatchEvent(new Event('exampro-catalogue-changed'));

export function TestsTab({onEditQuestions,initialView='all',initialTestId=''}:{onEditQuestions?:(topic:string,testId?:string)=>void;initialView?:'all'|'live'|'hidden';initialTestId?:string}) {
  const [view,setView]=useState(initialView);
  const [checklistId,setChecklistId]=useState<string|null>(initialTestId||null);
  const [loading,setLoading]=useState(true);
  const [confirmation,setConfirmation]=useState<{test:AdminTest;change?:Partial<AdminTest>;remove?:boolean}|null>(null);
  const mutationLock=useRef(false);
  const [busy,setBusy]=useState(false);
  const [bulk,setBulk]=useState<{id:string;name:string;ready:boolean;blocker:string|null}[]|null>(null);
  const [tests, setTests] = useState<AdminTest[]>([]);
  const [topics, setTopics] = useState<AdminTopic[]>([]);
  const [draftTestingEnabled,setDraftTestingEnabled] = useState(false);
  const editorHeading=useRef<HTMLHeadingElement>(null);
  const secondaryPanel=useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reviewId,setReviewId] = useState<string|null>(null);
  const [readinessId,setReadinessId] = useState<string|null>(null);
  const [preview, setPreview] = useState<{name:string;minutes:number;questionCount:number;questions:{id:string;question:string}[]}|null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [t, p, status] = await Promise.all([admin<{ tests: AdminTest[] }>('/tests'), admin<{ topics: AdminTopic[] }>('/topics'), admin<{enabled:boolean}>('/draft-testing/status')]);
    setDraftTestingEnabled(status.ok && status.data.enabled);
    if (t.ok) setTests(t.data.tests); else setMsg({ kind: 'error', text: t.message });
    if (p.ok) setTopics(p.data.topics);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const draftIdentity=draft?(editingId??'new'):null;
  useEffect(()=>{if(draftIdentity!==null)requestAnimationFrame(()=>{editorHeading.current?.scrollIntoView({behavior:'smooth',block:'start'});editorHeading.current?.focus({preventScroll:true});});},[draftIdentity]);
  useEffect(()=>{if(reviewId||readinessId)requestAnimationFrame(()=>secondaryPanel.current?.scrollIntoView({behavior:'smooth',block:'start'}));},[reviewId,readinessId]);

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
    setBusy(true);setMsg(null);
    const r = await admin(`/tests/${t.id}`, 'PUT', { ...t, ...change });
    setBusy(false);
    setMsg(r.ok?{kind:'ok',text:'Test updated. Catalogue pages refresh on focus or within 30 seconds.'}:{kind:'error',text:r.message});
    if(r.ok){changed();if(change.active!==undefined)setChecklistId(null);}
    else if(r.status===409)setChecklistId(t.id);
    await load();
  };
  const askQuick=(t:AdminTest,change:Partial<AdminTest>)=>setConfirmation({test:t,change});
  const checkBulk=async()=>{
    setBusy(true);setMsg(null);
    const r=await admin<{candidates:{id:string;name:string;ready:boolean;blocker:string|null}[]}>('/tests/publication-candidates');
    setBusy(false);
    if(r.ok)setBulk(r.data.candidates);else setMsg({kind:'error',text:r.message});
  };
  const publishReviewed=async()=>{
    const ready=bulk?.filter(t=>t.ready)??[];
    if(!ready.length||mutationLock.current)return;
    mutationLock.current=true;
    setBusy(true);let published=0;const failed:string[]=[];
    for(const item of ready){
      const t=tests.find(t=>t.id===item.id);
      if(!t){failed.push(item.name+': reload required');continue;}
      const r=await admin(`/tests/${t.id}`,'PUT',{...t,active:true});
      if(r.ok)published++;else failed.push(`${t.name}: ${r.message}`);
    }
    setBusy(false);setBulk(null);changed();await load();mutationLock.current=false;
    setMsg({kind:failed.length?'error':'ok',text:`${published} published. ${failed.length?failed.join('; '):'All selected drafts passed the server review gates.'}`});
  };
  const remove=async(t:AdminTest)=>{
    setBusy(true);const r=await admin(`/tests/${t.id}`,'DELETE');setBusy(false);
    setMsg(r.ok?{kind:'ok',text:'Draft definition deleted; source questions retained.'}:{kind:'error',text:r.message});
    if(r.ok)changed();await load();
  };
  const confirmAction=async()=>{
    if(!confirmation||mutationLock.current)return;
    mutationLock.current=true;
    try{
      if(confirmation.remove)await remove(confirmation.test);
      else if(confirmation.change)await quick(confirmation.test,confirmation.change);
      setConfirmation(null);
    }finally{mutationLock.current=false;}
  };
  const duplicate=(t:AdminTest)=>{
    setEditingId(null);setDraft({...t,id:'',name:`${t.name} (Copy)`.slice(0,120),active:false,
      minutes:String(t.minutes),marksPerCorrect:String(t.marksPerCorrect),negativeMarks:String(t.negativeMarks),passPercent:String(t.passPercent??50)});
    setMsg({kind:'ok',text:'Choose a new ID to duplicate this definition as a draft. The copy shares source questions; it is not a distinct question bank.'});
  };

  const showPreview = async(t:AdminTest)=>{
    if(busy)return;
    setBusy(true);
    const r=await admin<{name:string;minutes:number;questionCount:number;questions:{id:string;question:string}[]}>(`/tests/${t.id}/preview`);
    setBusy(false);
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
      {view==='live'?<LiveCatalogue definitions={tests} onEditQuestions={onEditQuestions}/>:<MockManager
        tests={tests} hiddenOnly={view==='hidden'} busy={busy} loading={loading} draftTestingEnabled={draftTestingEnabled} initialSearch={initialTestId}
        onCreate={()=>{setEditingId(null);setDraft(blank(firstTopic));}} onRefresh={()=>{setMsg(null);void load();}} onCheckDrafts={()=>void checkBulk()}
        onReadiness={t=>setChecklistId(t.id)} onQuestions={onEditQuestions?t=>onEditQuestions(t.sections[0]?.parts[0]?.topic??'',t.id):undefined}
        onPreview={t=>void showPreview(t)} onEdit={edit} onTier={t=>askQuick(t,{tier:t.tier==='free'?'premium':'free'})}
        onPublish={t=>askQuick(t,{active:!t.active})} onDuplicate={duplicate} onDelete={t=>setConfirmation({test:t,remove:true})}
        onRelease={t=>{setReadinessId(t.id);setReviewId(null);}} onAcademic={t=>{setReviewId(t.id);setReadinessId(null);}}
      />}
      {bulk&&<Dialog open onOpenChange={open=>{if(!open&&!busy)setBulk(null);}}><DialogContent showCloseButton={!busy} className="max-h-[90dvh] overflow-y-auto rounded-3xl p-6 sm:max-w-2xl"><DialogHeader><DialogTitle>Review publication candidates</DialogTitle><DialogDescription>{bulk.filter(t=>t.ready).length} ready of {bulk.length} drafts. Publication does not perform human review. Only the ready definitions listed below will be submitted; the server checks each one again.</DialogDescription></DialogHeader><ul className="max-h-80 space-y-3 overflow-y-auto text-sm">{bulk.map(t=><li key={t.id} className="rounded-xl border p-3"><strong>{t.name}</strong><p className={`mt-1 text-xs ${t.ready?'text-emerald-700 dark:text-emerald-300':'text-muted-foreground'}`}>{t.ready?'Ready to publish':t.blocker||'Not ready'}</p></li>)}</ul><div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy} onClick={()=>setBulk(null)}>Cancel</Button><Button disabled={busy||!bulk.some(t=>t.ready)} onClick={()=>void publishReviewed()}>{busy?'Publishing…':'Publish reviewed candidates'}</Button></div></DialogContent></Dialog>}
      {confirmation&&<Dialog open onOpenChange={open=>{if(!open&&!busy)setConfirmation(null);}}><DialogContent showCloseButton={!busy} className="rounded-3xl p-6 sm:max-w-lg"><DialogHeader><DialogTitle>{confirmation.remove?'Delete unused draft?':confirmation.change?.tier?'Change mock access?':confirmation.change?.active?'Publish this mock?':'Unpublish this mock?'}</DialogTitle><DialogDescription>{confirmation.test.name}</DialogDescription></DialogHeader><div className="rounded-xl border bg-muted/30 p-4 text-sm leading-relaxed">{confirmation.remove?'This removes the mock definition only. Source questions and existing attempts are retained. The server blocks deletion if the definition has attempts, is active or reserves shared paid questions.':confirmation.change?.tier?`The mock will use ${confirmation.change.tier==='free'?'Free':'Pro'} access. Source question access and review status are unchanged. Inaccessible or unreviewed source questions can keep this mock hidden.`:confirmation.change?.active?'The server will check all source topics, question positions, recorded reviews and required editorial sign-offs. Learners can see the mock only after all publication checks pass.':'This removes the mock from the learner catalogue. Source questions and saved attempts are preserved.'}</div><div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy} onClick={()=>setConfirmation(null)}>Cancel</Button><Button variant={confirmation.remove?'destructive':'default'} disabled={busy} onClick={()=>void confirmAction()}>{busy?<><LoaderCircle className="animate-spin"/>Saving…</>:confirmation.remove?'Delete draft':confirmation.change?.tier?'Confirm access change':confirmation.change?.active?'Confirm publication':'Unpublish mock'}</Button></div></DialogContent></Dialog>}

      {checklistId&&<Dialog open onOpenChange={open=>{if(!open&&!busy)setChecklistId(null);}}><DialogContent showCloseButton={!busy} className="max-h-[90dvh] overflow-y-auto rounded-3xl p-1 sm:max-w-5xl"><DialogTitle className="sr-only">Mock publishing readiness</DialogTitle><DialogDescription className="sr-only">Review source questions and topic readiness before publishing.</DialogDescription><PublicationChecklist key={checklistId} testId={checklistId} onClose={()=>setChecklistId(null)} onEditQuestions={onEditQuestions} busy={busy} actionError={msg?.kind==='error'?msg.text:''} onPublish={id=>{const t=tests.find(t=>t.id===id);if(t)askQuick(t,{active:true});}}/></DialogContent></Dialog>}
      <div ref={secondaryPanel} className="scroll-mt-24"/>
      {readinessId && <MockReleaseReadiness key={readinessId} testId={readinessId} onClose={()=>setReadinessId(null)} />}
      {reviewId && <MockReview key={reviewId} testId={reviewId} onClose={()=>setReviewId(null)} />}

      {preview&&<Dialog open onOpenChange={open=>{if(!open)setPreview(null);}}><DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl p-6 sm:max-w-2xl"><DialogHeader><DialogTitle>Preview: {preview.name}</DialogTitle><DialogDescription>{preview.questionCount} active source questions · {preview.minutes} minutes. Private preview does not publish this mock.</DialogDescription></DialogHeader><ol className="list-inside list-decimal space-y-3 text-sm">{preview.questions.slice(0,30).map(q=><li key={q.id}>{q.question}</li>)}</ol>{preview.questionCount>30&&<p className="text-xs text-muted-foreground">Showing the first 30 question stems. Use Test draft for a complete private run.</p>}<Button variant="outline" onClick={()=>setPreview(null)}>Close preview</Button></DialogContent></Dialog>}

      {draft && (
        <form onSubmit={save} className={card} aria-busy={busy}><fieldset disabled={busy} className="grid gap-4">
          <h2 ref={editorHeading} tabIndex={-1} className="scroll-mt-24 text-lg font-bold focus:outline-none">{editingId ? `Edit ${editingId}` : 'New mock test'}</h2>
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
        </fieldset></form>
      )}
    </div>
  );
}
