/* eslint-disable react-hooks/set-state-in-effect -- these effects load data from the API when the page opens */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { admin, parseBulk, type AdminQuestion, type AdminTopic, type QuestionInput } from '@/lib/admin';
import { Field, LETTERS, Notice, card, input } from '@/components/admin/ui';
import { CsvImport } from '@/components/admin/csv-import';

const EMPTY: QuestionInput = { question: '', options: ['', '', '', ''], answer: 0, explanation: '', difficulty:'Moderate' };
const BULK_HINT = 'question | option A | option B | option C | option D | right answer (A-D) | explanation';

export function QuestionsTab() {
  const [topics, setTopics] = useState<AdminTopic[]>([]);
  const [topic, setTopic] = useState('');
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<QuestionInput>(EMPTY);
  const [bulk, setBulk] = useState('');
  const [newTopic, setNewTopic] = useState({ id: '', name: '', category: '' });
  const [showInactive, setShowInactive] = useState(false);
  const [topicDetails,setTopicDetails] = useState({name:'',category:''});

  const loadTopics = useCallback(async () => {
    const r = await admin<{ topics: AdminTopic[] }>('/topics');
    if (r.ok) {
      setTopics(r.data.topics);
      setTopic((t) => t || r.data.topics[0]?.id || '');
    } else setMsg({ kind: 'error', text: r.message });
  }, []);

  const loadQuestions = useCallback(async (id: string) => {
    if (!id) return;
    const r = await admin<{ questions: AdminQuestion[] }>(`/topics/${id}/questions`);
    if (r.ok) setQuestions(r.data.questions);
    else setMsg({ kind: 'error', text: r.message });
  }, []);

  useEffect(() => { void loadTopics(); }, [loadTopics]);
  useEffect(() => { void loadQuestions(topic); }, [topic, loadQuestions]);

  useEffect(()=>{const current=topics.find(t=>t.id===topic);if(current)setTopicDetails({name:current.name,category:current.category});},[topics,topic]);
  const saveTopic=async(e:React.FormEvent)=>{e.preventDefault();
    const r=await admin(`/topics/${topic}`,'PUT',topicDetails);
    if(r.ok){setMsg({kind:'ok',text:'Topic updated.'});void loadTopics()}
    else setMsg({kind:'error',text:r.message});
  };
  const refresh = async () => { await Promise.all([loadTopics(), loadQuestions(topic)]); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const r = editing
      ? await admin(`/questions/${editing}`, 'PUT', draft)
      : await admin(`/topics/${topic}/questions`, 'POST', { questions: [draft] });
    if (r.ok) {
      setMsg({ kind: 'ok', text: editing ? 'Question updated.' : 'Question added.' });
      setDraft(EMPTY);
      setEditing(null);
      void refresh();
    } else setMsg({ kind: 'error', text: r.message });
  };

  const parsed = parseBulk(bulk);
  const importBulk = async () => {
    setMsg(null);
    const r = await admin<{ added: number }>(`/topics/${topic}/questions`, 'POST', { questions: parsed.rows });
    if (r.ok) {
      setMsg({ kind: 'ok', text: `Added ${r.data.added} questions to this topic.` });
      setBulk('');
      void refresh();
    } else setMsg({ kind: 'error', text: r.message });
  };

  const setActive = async (id: string, active: boolean) => {
    const r = await admin(`/questions/${id}/active`, 'POST', { active });
    if (!r.ok) setMsg({ kind: 'error', text: r.message });
    void refresh();
  };

  const addTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await admin('/topics', 'POST', newTopic);
    if (r.ok) {
      setMsg({ kind: 'ok', text: `Topic "${newTopic.name}" created. Add questions to it, then use it in a mock test.` });
      setTopic(newTopic.id.toLowerCase());
      setNewTopic({ id: '', name: '', category: '' });
      void loadTopics();
    } else setMsg({ kind: 'error', text: r.message });
  };

  const current = topics.find((t) => t.id === topic);
  const shown = questions.filter((q) => showInactive || q.active);

  return (
    <div className="grid gap-6">
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}

      <section className={`${card} grid gap-3`}>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Topic">
            <select className={`${input} min-w-64`} value={topic} onChange={(e) => { setTopic(e.target.value); setEditing(null); setDraft(EMPTY); }}>
              {topics.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.live} live)</option>)}
            </select>
          </Field>
          {current && <p className="pb-2 text-sm text-muted-foreground">{current.category} · {current.live} live, {current.total - current.live} retired · topic id <code>{current.id}</code></p>}
        </div>
        <details><summary className="cursor-pointer text-sm font-semibold">Edit this topic</summary><form onSubmit={saveTopic} className="mt-3 flex flex-wrap items-end gap-3"><Field label="Name"><input className={input} required value={topicDetails.name} onChange={e=>setTopicDetails({...topicDetails,name:e.target.value})}/></Field><Field label="Category"><input className={input} required value={topicDetails.category} onChange={e=>setTopicDetails({...topicDetails,category:e.target.value})}/></Field><Button type="submit" disabled={!topic}>Save topic</Button></form></details>
        <details>
          <summary className="cursor-pointer text-sm font-semibold">Create a new topic</summary>
          <form onSubmit={addTopic} className="mt-3 grid gap-3 sm:grid-cols-4">
            <Field label="Id" hint="Lower case, no spaces"><input className={input} required value={newTopic.id} onChange={(e) => setNewTopic({ ...newTopic, id: e.target.value })} /></Field>
            <Field label="Name"><input className={input} required value={newTopic.name} onChange={(e) => setNewTopic({ ...newTopic, name: e.target.value })} /></Field>
            <Field label="Category" hint="For example Quantitative"><input className={input} required value={newTopic.category} onChange={(e) => setNewTopic({ ...newTopic, category: e.target.value })} /></Field>
            <div className="flex items-end"><Button type="submit">Create topic</Button></div>
          </form>
        </details>
      </section>

      <CsvImport topic={topic} onSaved={()=>void refresh()} />
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={save} className={`${card} grid h-fit gap-3`}>
          <h2 className="text-lg font-bold">{editing ? 'Edit question' : 'Add a question'}</h2>
          <Field label="Question"><textarea className={`${input} min-h-20`} required value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} /></Field>
          {draft.options.map((o, i) => (
            <div key={i} className="flex items-end gap-2">
              <Field label={`Option ${LETTERS[i]}`}><input className={input} required value={o} onChange={(e) => setDraft({ ...draft, options: draft.options.map((x, k) => (k === i ? e.target.value : x)) })} /></Field>
              <label className="flex min-h-10 items-center gap-1 whitespace-nowrap text-sm">
                <input type="radio" name="right" checked={draft.answer === i} onChange={() => setDraft({ ...draft, answer: i })} /> Right
              </label>
            </div>
          ))}
          <Field label="Difficulty"><select className={input} value={draft.difficulty||'Moderate'} onChange={e=>setDraft({...draft,difficulty:e.target.value})}>{['Easy','Moderate','Hard'].map(d=><option key={d}>{d}</option>)}</select></Field>
          <Field label="Explanation" hint="Shown to the learner after the answer."><textarea className={`${input} min-h-16`} required value={draft.explanation} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} /></Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={!topic}>{editing ? 'Save changes' : 'Add question'}</Button>
            {editing && <Button type="button" variant="outline" onClick={() => { setEditing(null); setDraft(EMPTY); }}>Cancel</Button>}
          </div>
        </form>

        <section className={`${card} grid h-fit gap-3`}>
          <h2 className="text-lg font-bold">Paste many questions</h2>
          <p className="text-sm text-muted-foreground">One question per line, parts split by <code>|</code>. Prepare them in a spreadsheet or notes app and paste here. Up to 200 at a time.</p>
          <code className="block overflow-x-auto rounded bg-muted p-2 text-xs">{BULK_HINT}</code>
          <textarea className={`${input} min-h-40 font-mono text-xs`} aria-label="Questions to import" value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder="What is 20% of 150? | 25 | 30 | 35 | 40 | B | 0.2 × 150 = 30." />
          {bulk.trim() && (
            <p className="text-sm">{parsed.rows.length} ready{parsed.errors.length ? `, ${parsed.errors.length} with problems` : ''}.</p>
          )}
          {parsed.errors.slice(0, 5).map((er) => <Notice key={er} kind="error">{er}</Notice>)}
          <Button onClick={importBulk} disabled={!topic || parsed.rows.length === 0 || parsed.errors.length > 0}>
            Add {parsed.rows.length || ''} questions to this topic
          </Button>
        </section>
      </div>

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Questions in this topic</h2>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show retired</label>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Retiring hides a question from learners but keeps the numbering, so mock tests that use ranges do not shift.</p>
        <ul className="mt-3 divide-y">
          {shown.map((q) => (
            <li key={q.id} className={`grid gap-1 py-3 ${q.active ? '' : 'opacity-60'}`}>
              <p className="font-medium"><span className="mr-2 font-mono text-xs text-muted-foreground">#{q.position}</span>{q.question}</p>
              <p className="text-sm text-muted-foreground">
                {q.options.map((o, i) => <span key={i} className={i === q.answer ? 'font-semibold text-emerald-700 dark:text-emerald-400' : ''}>{LETTERS[i]}) {o}{'   '}</span>)}
              </p>
              <p className="text-xs text-muted-foreground">Why: {q.explanation}</p>
              <div className="flex gap-3 text-sm">
                <button className="underline" onClick={() => { setEditing(q.id); setDraft({ question: q.question, options: q.options, answer: q.answer, explanation: q.explanation, difficulty:q.difficulty }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Edit</button>
                <button className="underline" onClick={() => void setActive(q.id, !q.active)}>{q.active ? 'Retire' : 'Bring back'}</button>
              </div>
            </li>
          ))}
          {shown.length === 0 && <li className="py-3 text-muted-foreground">No questions yet.</li>}
        </ul>
      </section>
    </div>
  );
}
