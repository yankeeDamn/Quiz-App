/* eslint-disable react-hooks/set-state-in-effect -- selecting a bundled legacy quiz resets its edit form */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getAllQuizzes, getAnyQuizById } from '@/data/quizzes';
import starter from '@/data/it-certification-questions.json';
import { IT_CERTS } from '@/lib/it-certs';
import type { Question } from '@/lib/types';
import { admin } from '@/lib/admin';
import { fetchPracticeOverrides, type PracticeOverride } from '@/lib/practice-overrides';
import { Field, Notice, card, input } from '@/components/admin/ui';

type Source = 'homepage' | 'certification';
type CertQuestion = (typeof starter)[number];
type EditableQuestion = Question | CertQuestion;
type Draft = { text:string; options:string[]; answers:string[]; explanation:string };

function asDraft(question: EditableQuestion): Draft {
  if ('correctAnswers' in question) {
    return {
      text: question.question,
      options: question.options.map(o => o.text),
      answers: [...question.correctAnswers],
      explanation: question.explanation,
    };
  }
  return {text:question.question, options:[...question.options], answers:[question.correct_option], explanation:question.explanation};
}

export function PracticeLibraryTab() {
  const [source, setSource] = useState<Source>('homepage');
  const [groupId, setGroupId] = useState('aws-clf-c02');
  const [questionId, setQuestionId] = useState('');
  const [overrides, setOverrides] = useState<PracticeOverride[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{kind:'ok'|'error';text:string}|null>(null);

  const groups = useMemo(() => source === 'homepage'
    ? getAllQuizzes().map(q => ({id:q.id,name:q.title}))
    : IT_CERTS.map(c => ({id:c.code,name:c.name})), [source]);

  const questions = useMemo((): EditableQuestion[] => {
    const base: EditableQuestion[] = source === 'homepage'
      ? (getAnyQuizById(groupId)?.questions ?? [])
      : starter.filter(q => q.exam_code === groupId);
    return base.map(q => {
      const saved = overrides.find(o => o.source === source && o.id === q.id);
      const replacement = saved?.question as EditableQuestion | undefined;
      // Do not change the identity or exam code of a bundled item.
      if (!replacement || replacement.id !== q.id) return q;
      if (source === 'certification' && 'exam_code' in q &&
          ('exam_code' in replacement && replacement.exam_code !== q.exam_code)) return q;
      return replacement;
    });
  }, [source, groupId, overrides]);

  useEffect(() => {
    let mounted = true;
    fetchPracticeOverrides()
      .then(rows => { if (mounted) setOverrides(rows); })
      .catch(e => { if (mounted) setMessage({kind:'error',text:String(e.message || e)}); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    setQuestionId(questions[0]?.id || '');
    setMessage(null);
    // Only reset on source/group changes, not after an edit is saved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, groupId]);

  const current = questions.find(q => q.id === questionId);
  useEffect(() => { setDraft(current ? asDraft(current) : null); }, [current]);

  const answerIds = current
    ? ('correctAnswers' in current ? current.options.map(o=>o.id) : ['A','B','C','D'])
    : [];
  const multi = source === 'homepage' && current && 'type' in current && current.type === 'multiple';

  function changeSource(next: Source) {
    setSource(next);
    setGroupId(next === 'homepage' ? 'aws-clf-c02' : IT_CERTS[0].code);
  }

  async function save() {
    if (!current || !draft || saving) return;
    const payload = source === 'homepage'
      ? { ...(current as Question), question:draft.text,
          options:(current as Question).options.map((option,i)=>({...option,text:draft.options[i]})),
          correctAnswers:draft.answers, explanation:draft.explanation }
      : { ...(current as CertQuestion), question:draft.text,
          options:draft.options, correct_option:draft.answers[0], explanation:draft.explanation };
    setSaving(true);
    setMessage(null);
    try {
      const result = await admin<{question: EditableQuestion}>(
        `/practice/questions/${source}/${current.id}`, 'PUT', {question:payload}
      );
      if (!result.ok) {
        setMessage({kind:'error',text:result.message});
        return;
      }
      setOverrides(existing => [
        ...existing.filter(o => !(o.source === source && o.id === current.id)),
        {source,id:current.id,question:result.data.question},
      ]);
      setMessage({kind:'ok',text:'Saved to Neon. New practice sessions will use the updated question.'});
    } finally { setSaving(false); }
  }

  return <div className="grid gap-5">
    <section className={card}>
      <h2 className="text-lg font-bold">Legacy Practice Library</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Edit the older quizzes from the ExamPro homepage and the separate IT certification starters.
        These are client-side practice questions, not the server-scored Neon mock tests.
        Question IDs and existing quiz URLs remain unchanged.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Some homepage quizzes share questions (for example Multi-Cloud). An edit to a shared question
        will appear in every homepage quiz using that question ID. Existing attempts remain unchanged.
      </p>
    </section>
    {message && <Notice kind={message.kind}>{message.text}</Notice>}
    <section className={card}>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Library"><select className={input} value={source} onChange={e=>changeSource(e.target.value as Source)}>
          <option value="homepage">Homepage practice quizzes</option>
          <option value="certification">IT certification starters</option>
        </select></Field>
        <Field label="Quiz"><select className={input} value={groupId} onChange={e=>setGroupId(e.target.value)}>
          {groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
        </select></Field>
        <Field label={`Question (${questions.length})`}><select className={input} value={questionId}
          onChange={e=>{setQuestionId(e.target.value);setMessage(null);}}>
          {questions.map((q,i)=><option key={q.id} value={q.id}>{i+1}. {q.question.slice(0,65)}</option>)}
        </select></Field>
      </div>
    </section>
    {loading && <p className="text-sm text-muted-foreground">Loading saved edits…</p>}
    {current && draft && <section className={`${card} grid gap-4`}>
      <div className="flex flex-wrap justify-between gap-2">
        <h3 className="font-semibold">Edit question</h3>
        <code className="text-xs text-muted-foreground">{current.id}</code>
      </div>
      <Field label="Question"><textarea className={`${input} min-h-24`} value={draft.text}
        onChange={e=>setDraft({...draft,text:e.target.value})}/></Field>
      <p className="text-sm font-semibold">Answer options {multi ? '— select all correct answers' : '— select one correct answer'}</p>
      {draft.options.map((option,i)=>{
        const letter = answerIds[i];
        return <div className="flex items-center gap-3" key={letter}>
          <label className="flex min-w-10 items-center gap-2 text-xs font-semibold">
            <input type={multi?'checkbox':'radio'} name="practice-answer"
              checked={draft.answers.includes(letter)} onChange={e=>{
                const next=multi
                  ? (e.target.checked?[...draft.answers,letter]:draft.answers.filter(x=>x!==letter))
                  : [letter];
                setDraft({...draft,answers:next});
              }} />
            {letter.toUpperCase()}
          </label>
          <input aria-label={`Option ${letter}`} className={input} value={option}
            onChange={e=>setDraft({...draft,options:draft.options.map((v,k)=>k===i?e.target.value:v)})} />
        </div>;
      })}
      <Field label="Explanation"><textarea className={`${input} min-h-28`} value={draft.explanation}
        onChange={e=>setDraft({...draft,explanation:e.target.value})}/></Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={()=>void save()} disabled={saving || loading || draft.answers.length===0}>
          {saving?'Saving…':'Save practice question'}
        </Button>
        <Button variant="outline" onClick={()=>setDraft(asDraft(current))}>Discard changes</Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Saved changes become visible to new practice sessions without a Vercel redeploy.
        Previously started local practice attempts retain their question snapshots.
      </p>
    </section>}
  </div>;
}
