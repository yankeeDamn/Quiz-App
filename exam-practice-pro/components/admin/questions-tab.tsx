/* eslint-disable react-hooks/set-state-in-effect -- load admin data and synchronize topic forms */
'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,CheckCircle2,ChevronDown,FileUp,FolderPlus,LoaderCircle,Plus,RefreshCw,Search,ShieldCheck} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {admin,parseBulk,type AdminQuestion,type AdminTopic,type QuestionInput} from '@/lib/admin';
import {Field,LETTERS,Notice,card,input} from './ui';
import {CsvImport} from './csv-import';
import {QuestionCard,questionStage} from './question-card';
import {QuestionReviewDialog,type QuestionAction} from './question-review-dialog';

const EMPTY:QuestionInput={question:'',options:['','','',''],answer:0,explanation:'',difficulty:'Moderate'};
const BULK_HINT='question | option A | option B | option C | option D | right answer (A-D) | explanation';
const changed=()=>window.dispatchEvent(new Event('exampro-catalogue-changed'));
type Message={kind:'ok'|'error';text:string};
type ActionTarget={question:AdminQuestion;action:QuestionAction;tier?:'free'|'premium'};

export function QuestionsTab({initialTopic='',onBackToMocks,mockId}:{initialTopic?:string;onBackToMocks?:()=>void;mockId?:string}){
 const [topics,setTopics]=useState<AdminTopic[]>([]),[topic,setTopic]=useState(initialTopic);
 const [error,setError]=useState(''),[loaded,setLoaded]=useState(false),[workspaceBusy,setWorkspaceBusy]=useState(false);
 const [creating,setCreating]=useState(false),[createBusy,setCreateBusy]=useState(false);
 const [newTopic,setNewTopic]=useState({id:'',name:'',category:''});
 const loadTopics=useCallback(async()=>{
  const r=await admin<{topics:AdminTopic[]}>('/topics');
  if(r.ok){setTopics(r.data.topics);setLoaded(true);setError('');setTopic(t=>t||r.data.topics[0]?.id||'');}
  else setError(r.message);
 },[]);
 useEffect(()=>{void loadTopics();},[loadTopics]);
 const create=async(e:React.FormEvent)=>{
  e.preventDefault();if(createBusy)return;setCreateBusy(true);setError('');
  const r=await admin('/topics','POST',{...newTopic,active:false});setCreateBusy(false);
  if(r.ok){await loadTopics();setTopic(newTopic.id.trim().toLowerCase());setNewTopic({id:'',name:'',category:''});setCreating(false);}
  else setError(r.message);
 };
 const current=topics.find(t=>t.id===topic);
 return <div className="space-y-5">
  <section className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-5 dark:border-indigo-900 dark:from-indigo-950/40 dark:to-violet-950/30 sm:p-6">
   <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-indigo-700 dark:text-indigo-300">Question review workspace</p><h2 className="mt-2 text-xl font-bold">Check, approve and publish with confidence.</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Choose a topic, review each question, then return to the mock to publish the complete test.</p></div>{onBackToMocks&&<Button type="button" variant="outline" disabled={workspaceBusy} onClick={onBackToMocks}><ArrowLeft/>{mockId?'Back to this mock':'Go to mock manager'}</Button>}</div>
   <ol className="mt-5 grid gap-3 text-xs sm:grid-cols-3">{[['1','Choose access','Free practice or Pro only'],['2','Review & publish','Check the answer and explanation'],['3','Release the mock','Activate ready topics, then publish the test']].map(([n,title,detail])=><li key={n} className="flex items-start gap-2 rounded-xl border border-indigo-100 bg-background/70 p-3 dark:border-indigo-900"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 font-bold text-white">{n}</span><span><strong className="block">{title}</strong><span className="mt-1 block leading-5 text-muted-foreground">{detail}</span></span></li>)}</ol>
  </section>
  {error&&<Notice kind="error">{error}</Notice>}
  <section className={`${card} flex flex-wrap items-end gap-4`}>
   <div className="min-w-0 flex-1"><Field label="Choose a topic"><select className={input} aria-label="Choose a topic" value={topic} disabled={workspaceBusy} onChange={e=>setTopic(e.target.value)}>{!topics.length&&<option value="">{loaded?'Create your first topic':'Loading topics…'}</option>}{topics.map(t=><option key={t.id} value={t.id}>{t.name} · {t.category}</option>)}</select></Field></div>
   <Button type="button" variant="outline" disabled={workspaceBusy} onClick={()=>setCreating(v=>!v)}><FolderPlus/>{creating?'Close new topic':'New topic'}</Button>
  </section>
  {creating&&<form onSubmit={create} className={`${card} grid gap-4 sm:grid-cols-3`}><div className="sm:col-span-3"><h3 className="font-bold">Create a private topic</h3><p className="mt-1 text-xs text-muted-foreground">New topics start inactive. Add and review questions before making them available.</p></div><Field label="Topic ID" hint="Lowercase letters, numbers and dashes"><input className={input} required value={newTopic.id} onChange={e=>setNewTopic({...newTopic,id:e.target.value})}/></Field><Field label="Topic name"><input className={input} required value={newTopic.name} onChange={e=>setNewTopic({...newTopic,name:e.target.value})}/></Field><Field label="Category"><input className={input} required value={newTopic.category} onChange={e=>setNewTopic({...newTopic,category:e.target.value})}/></Field><Button type="submit" disabled={createBusy}>{createBusy?<LoaderCircle className="animate-spin"/>:<Plus/>}{createBusy?'Creating…':'Create private topic'}</Button></form>}
  {current?<TopicWorkspace key={topic} topic={topic} current={current} onTopicsChanged={loadTopics} onBusyChange={setWorkspaceBusy} onBackToMocks={onBackToMocks}/>:loaded&&<div className={`${card} text-sm text-muted-foreground`}>{topics.length?'Choose an existing topic to review its questions.':'Create a topic, then add or import your questions.'}</div>}
 </div>;
}

function TopicWorkspace({topic,current,onTopicsChanged,onBusyChange,onBackToMocks}:{topic:string;current:AdminTopic;onTopicsChanged:()=>Promise<void>;onBusyChange:(busy:boolean)=>void;onBackToMocks?:()=>void}){
 const [questions,setQuestions]=useState<AdminQuestion[]>([]),[loaded,setLoaded]=useState(false),[loadError,setLoadError]=useState('');
 const [message,setMessage]=useState<Message|null>(null),[rowMessages,setRowMessages]=useState<Record<string,Message>>({});
 const [busy,setBusy]=useState(false),[busyId,setBusyId]=useState<string|null>(null);
 const lock=useRef(false),alive=useRef(true),request=useRef(0);
 const [reviewing,setReviewing]=useState<AdminQuestion|null>(null),[dialogError,setDialogError]=useState('');
 const [target,setTarget]=useState<ActionTarget|null>(null),[topicAction,setTopicAction]=useState(false);
 const [panel,setPanel]=useState<'edit'|'import'|null>(null),[editing,setEditing]=useState<string|null>(null),[draft,setDraft]=useState<QuestionInput>(EMPTY);
 const [bulk,setBulk]=useState(''),[search,setSearch]=useState(''),[filter,setFilter]=useState('all'),[page,setPage]=useState(1);
 const editorHeading=useRef<HTMLHeadingElement>(null);
 const [topicDetails,setTopicDetails]=useState({name:current.name,category:current.category});
 const load=useCallback(async()=>{
  const version=++request.current;
  const r=await admin<{questions:AdminQuestion[]}>(`/topics/${encodeURIComponent(topic)}/questions`);
  if(!alive.current||version!==request.current)return;
  if(r.ok){setQuestions(r.data.questions);setLoadError('');setLoaded(true);}else setLoadError(r.message);
 },[topic]);
 useEffect(()=>{alive.current=true;void load();return()=>{alive.current=false;onBusyChange(false);};},[load,onBusyChange]);
 useEffect(()=>{setTopicDetails({name:current.name,category:current.category});},[current.name,current.category]);
 useEffect(()=>{if(panel==='edit')requestAnimationFrame(()=>{editorHeading.current?.scrollIntoView({behavior:'smooth',block:'start'});editorHeading.current?.focus({preventScroll:true});});},[panel,editing]);
 const begin=()=>{if(lock.current)return false;lock.current=true;setBusy(true);onBusyChange(true);return true;};
 const finish=()=>{lock.current=false;if(alive.current){setBusy(false);setBusyId(null);onBusyChange(false);}};
 const announce=(msg:Message)=>{setMessage(msg);};
 const refresh=async()=>{await Promise.all([load(),onTopicsChanged()]);};
 const active=questions.filter(q=>q.active);
 const counts={all:questions.length,'needs-review':questions.filter(q=>questionStage(q)==='needs-review').length,reviewed:questions.filter(q=>questionStage(q)==='reviewed').length,published:questions.filter(q=>questionStage(q)==='published').length,retired:questions.filter(q=>!q.active).length};
 const shown=questions.filter(q=>(filter==='all'||questionStage(q)===filter)&&`${q.question} ${q.explanation} ${q.position}`.toLowerCase().includes(search.toLowerCase()));
 const pages=Math.max(1,Math.ceil(shown.length/10)),currentPage=Math.min(page,pages);
 const visible=shown.slice((currentPage-1)*10,currentPage*10);
 const pending=questions.filter(q=>q.active&&['needs-review','reviewed'].includes(questionStage(q)));
 const activationReady=counts.published>0&&!active.some(q=>q.review_status==='published'&&!q.reviewed_at);
 const workflow=async(q:AdminQuestion,action:QuestionAction,tier?:'free'|'premium')=>{
  if(!begin())return false;
  setBusyId(q.id);setDialogError('');
  try{
   const r=await admin<{question:AdminQuestion}>(`/questions/${q.id}/workflow`,'POST',{action,revision:q.revision,tier,acknowledged:['review','review_publish'].includes(action)});
   if(!alive.current)return false;
   if(!r.ok){const msg={kind:'error' as const,text:r.message};setRowMessages(m=>({...m,[q.id]:msg}));setDialogError(r.message);announce(msg);if(r.status===409)await load();return false;}
   setQuestions(rows=>rows.map(row=>row.id===q.id?r.data.question:row));changed();void onTopicsChanged();
   const text=action==='review_publish'||action==='publish'?'Question published. Its mock still needs separate publication.':action==='review'?'Review saved. This question is ready to publish.':action==='access'?'Access changed. Review this version again before publishing.':action==='draft'?'Question returned to draft and hidden from learners.':action==='restore'?'Question restored. Check its review and publication status.':'Question retired. Test ranges and saved attempts are retained.';
   setRowMessages(m=>({...m,[q.id]:{kind:'ok',text}}));announce({kind:'ok',text});return true;
  }finally{finish();}
 };
 const confirmReview=async(action:QuestionAction,next:boolean)=>{
  if(!reviewing)return;const q=reviewing;
  const ok=await workflow(q,action);
  if(!ok)return;
  const nextQuestion=next?pending.find(row=>row.id!==q.id):undefined;
  setReviewing(nextQuestion??null);setDialogError('');
 };
 const confirmAction=async()=>{if(!target)return;const ok=await workflow(target.question,target.action,target.tier);if(ok){setTarget(null);setDialogError('');}};
 const openReview=(q:AdminQuestion)=>{setDialogError('');setReviewing(q);};
 const openEdit=(q?:AdminQuestion)=>{setEditing(q?.id??null);setDraft(q?{question:q.question,options:[...q.options],answer:q.answer,explanation:q.explanation,difficulty:q.difficulty}:{...EMPTY,options:[...EMPTY.options]});setPanel('edit');};
 const saveQuestion=async(e:React.FormEvent)=>{
  e.preventDefault();if(!begin())return;
  try{
   const r=editing?await admin(`/questions/${editing}`,'PUT',draft):await admin(`/topics/${topic}/questions`,'POST',{questions:[draft]});
   if(!alive.current)return;
   if(r.ok){announce({kind:'ok',text:editing?'Changes saved. Review the updated question before publishing again.':'Question added as a private draft. Review it when ready.'});setPanel(null);setEditing(null);setDraft(EMPTY);changed();await refresh();}
   else announce({kind:'error',text:r.message});
  }finally{finish();}
 };
 const parsed=parseBulk(bulk);
 const importBulk=async()=>{
  if(!begin())return;
  try{const r=await admin<{added:number}>(`/topics/${topic}/questions`,'POST',{questions:parsed.rows});if(!alive.current)return;if(r.ok){announce({kind:'ok',text:`Added ${r.data.added} private draft questions. Review before publishing.`});setBulk('');await refresh();}else announce({kind:'error',text:r.message});}finally{finish();}
 };
 const toggleTopic=async()=>{
  if(!begin())return;
  try{const r=await admin(`/topics/${topic}/active`,'POST',{active:!current.active});if(!alive.current)return;if(r.ok){announce({kind:'ok',text:current.active?'Topic deactivated. Its learner tests are hidden.':'Topic activated. Return to the mock and check its publication checklist.'});setTopicAction(false);changed();await onTopicsChanged();}else {setDialogError(r.message);announce({kind:'error',text:r.message});}}finally{finish();}
 };
 const saveTopic=async(e:React.FormEvent)=>{
  e.preventDefault();if(!begin())return;
  try{const r=await admin(`/topics/${topic}`,'PUT',topicDetails);if(r.ok){announce({kind:'ok',text:'Topic details saved.'});await onTopicsChanged();changed();}else announce({kind:'error',text:r.message});}finally{finish();}
 };
 return <div className="space-y-5">
  {message&&<div className="sticky top-20 z-20 rounded-xl bg-background shadow-sm"><Notice kind={message.kind}>{message.text}</Notice></div>}
  {loadError&&<Notice kind="error">{loadError}</Notice>}
  <section className={`${card} space-y-5`}>
   <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-bold">{current.name}</h2><p className="mt-1 text-sm text-muted-foreground">{current.category} · {topic}</p></div><span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${current.active?'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200':'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'}`}>{current.active?<CheckCircle2 className="h-3.5 w-3.5"/>:<ShieldCheck className="h-3.5 w-3.5"/>}{current.active?'Topic active':'Topic private'}</span></div>
   <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Needs review',counts['needs-review'],'needs-review'],['Ready to publish',counts.reviewed,'reviewed'],['Published & reviewed',counts.published,'published'],['Retired',counts.retired,'retired']].map(([label,n,status])=><button key={label} type="button" className={`rounded-xl border p-3 text-left transition-colors hover:bg-muted/40 ${filter===status?'border-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/30':'bg-muted/15'}`} onClick={()=>{setFilter(String(status));setPage(1);}}><span className="text-2xl font-bold tabular-nums">{loaded?n:'—'}</span><span className="mt-1 block text-xs text-muted-foreground">{label}</span></button>)}</div>
   <div className="flex flex-wrap items-center gap-2"><Button type="button" className="min-h-11 bg-indigo-600 text-white hover:bg-indigo-700" disabled={busy||!pending.length||!pending[0]?.revision} onClick={()=>openReview(pending[0])}><ShieldCheck/>Review next question</Button><Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={()=>openEdit()}><Plus/>Add question</Button><Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={()=>setPanel(panel==='import'?null:'import')}><FileUp/>Import questions</Button><Button type="button" variant="ghost" className="min-h-11" disabled={busy} onClick={()=>void refresh()}><RefreshCw/>Refresh</Button></div>
   {!current.active&&<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 p-4"><p className="max-w-xl text-xs leading-5 text-muted-foreground">{activationReady?'Reviewed, published questions are ready. Activate the topic, then return to your mock to publish the test.':'Publish at least one reviewed question and review any already-published questions before activating this topic.'}</p><Button type="button" variant="outline" className="min-h-11" disabled={busy||!activationReady} onClick={()=>{setDialogError('');setTopicAction(true);}}>Activate ready topic</Button></div>}
   <details><summary className="flex min-h-10 cursor-pointer items-center gap-2 text-xs font-semibold text-muted-foreground">Topic settings <ChevronDown className="h-3.5 w-3.5"/></summary><form onSubmit={saveTopic} className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Topic name"><input className={input} required value={topicDetails.name} onChange={e=>setTopicDetails({...topicDetails,name:e.target.value})}/></Field><Field label="Category"><input className={input} required value={topicDetails.category} onChange={e=>setTopicDetails({...topicDetails,category:e.target.value})}/></Field><div className="flex flex-wrap gap-2"><Button type="submit" variant="outline" disabled={busy}>Save topic details</Button>{current.active&&<Button type="button" variant="ghost" disabled={busy} onClick={()=>{setDialogError('');setTopicAction(true);}}>Deactivate topic…</Button>}</div></form></details>
  </section>
  {panel==='edit'&&<form onSubmit={saveQuestion} className={card} aria-busy={busy}><fieldset disabled={busy} className="space-y-4">
   <div className="flex items-center justify-between gap-3"><h2 ref={editorHeading} tabIndex={-1} className="scroll-mt-24 text-lg font-bold focus:outline-none">{editing?'Edit question':'Add a private draft question'}</h2><Button type="button" variant="ghost" disabled={busy} onClick={()=>setPanel(null)}>Close editor</Button></div>
   {editing&&<p className="text-xs text-amber-800 dark:text-amber-300">Saving changes hides this question and resets its review. Saved student attempt snapshots are preserved.</p>}
   <Field label="Question"><textarea className={`${input} min-h-24`} required value={draft.question} onChange={e=>setDraft({...draft,question:e.target.value})}/></Field>
   <div className="grid gap-3 sm:grid-cols-2">{draft.options.map((option,i)=><label key={i} className={`rounded-xl border p-3 ${draft.answer===i?'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20':''}`}><span className="mb-2 flex items-center gap-2 text-sm font-semibold"><input type="radio" name="right" checked={draft.answer===i} onChange={()=>setDraft({...draft,answer:i})}/>{LETTERS[i]} · {draft.answer===i?'Correct answer':'Mark as correct'}</span><input className={input} required aria-label={`Option ${LETTERS[i]}`} value={option} onChange={e=>setDraft({...draft,options:draft.options.map((v,n)=>n===i?e.target.value:v)})}/></label>)}</div>
   <Field label="Answer explanation"><textarea className={`${input} min-h-24`} required value={draft.explanation} onChange={e=>setDraft({...draft,explanation:e.target.value})}/></Field><Field label="Difficulty"><select className={`${input} max-w-xs`} value={draft.difficulty} onChange={e=>setDraft({...draft,difficulty:e.target.value})}>{['Easy','Moderate','Hard'].map(v=><option key={v}>{v}</option>)}</select></Field>
   <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy}>{busy&&<LoaderCircle className="animate-spin"/>}{busy?'Saving…':editing?'Save changes as draft':'Save private draft'}</Button><Button type="button" variant="outline" disabled={busy} onClick={()=>setPanel(null)}>Cancel</Button></div>
  </fieldset></form>}
  {panel==='import'&&<div className="space-y-4"><CsvImport key={topic} topic={topic} onSaved={()=>void refresh()}/><section className={`${card} space-y-3`}><h2 className="font-bold">Paste questions instead</h2><p className="text-xs text-muted-foreground">One question per line, up to 200. Imported questions start as private drafts.</p><code className="block overflow-x-auto rounded-lg bg-muted p-3 text-xs">{BULK_HINT}</code><textarea className={`${input} min-h-40 font-mono text-xs`} aria-label="Questions to import" value={bulk} onChange={e=>setBulk(e.target.value)}/><p className="text-xs text-muted-foreground">{parsed.rows.length} parsed · {parsed.errors.length} errors</p>{parsed.errors.slice(0,5).map(e=><Notice key={e} kind="error">{e}</Notice>)}<Button type="button" disabled={busy||!parsed.rows.length||parsed.rows.length>200||!!parsed.errors.length} onClick={()=>void importBulk()}>Import {parsed.rows.length||''} private draft questions</Button></section></div>}
  <section className="space-y-4" aria-label="Questions in this topic">
   <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex w-full max-w-md items-center gap-2 rounded-xl border bg-card px-3"><Search className="h-4 w-4 shrink-0 text-muted-foreground"/><input className="min-h-11 w-full bg-transparent text-sm outline-none" aria-label="Search questions in selected topic" placeholder="Search question, explanation or number…" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/></label><select className={`${input} sm:w-auto`} aria-label="Question review status" value={filter} onChange={e=>{setFilter(e.target.value);setPage(1);}}><option value="all">All questions ({counts.all})</option><option value="needs-review">Needs human review ({counts['needs-review']})</option><option value="reviewed">Ready to publish ({counts.reviewed})</option><option value="published">Published & reviewed ({counts.published})</option><option value="retired">Retired ({counts.retired})</option></select></div>
   {!loaded&&!loadError&&<div className={card} role="status">Loading questions…</div>}
   {loaded&&<p className="text-xs text-muted-foreground" role="status">{shown.length} matching questions · Page {currentPage} of {pages}. Retiring keeps question numbering and saved attempts intact.</p>}
   {visible.map(q=><QuestionCard key={q.id} question={q} busy={busy} onReview={()=>openReview(q)} onEdit={()=>openEdit(q)} onAction={action=>{setDialogError('');setTarget({question:q,action});}} onAccess={tier=>{if(tier!==q.access_tier){setDialogError('');setTarget({question:q,action:'access',tier});}}} message={rowMessages[q.id]}/>)}
   {loaded&&!shown.length&&<div className={`${card} py-10 text-center`}><CheckCircle2 className="mx-auto h-8 w-8 text-indigo-500"/><h3 className="mt-3 font-bold">{questions.length?'No questions match these filters':'This topic is ready for its first question'}</h3><p className="mt-2 text-sm text-muted-foreground">{questions.length?'Change the status filter or search text to see other questions.':'Add a question or import your own question file.'}</p><Button type="button" variant="outline" className="mt-4" onClick={()=>{setFilter('all');setSearch('');setPage(1);}}>Reset filters</Button></div>}
   {pages>1&&<div className="flex items-center justify-between gap-3"><Button type="button" variant="outline" disabled={currentPage===1||busy} onClick={()=>setPage(currentPage-1)}><ArrowLeft/>Previous page</Button><p className="text-xs text-muted-foreground">{currentPage} / {pages}</p><Button type="button" variant="outline" disabled={currentPage>=pages||busy} onClick={()=>setPage(currentPage+1)}>Next page<ArrowRight/></Button></div>}
  </section>
  {onBackToMocks&&<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-5"><div><h3 className="font-bold">Ready to release the complete mock?</h3><p className="mt-1 text-xs text-muted-foreground">Question publishing does not publish its mock. Check source topics, tier and exam readiness next.</p></div><Button type="button" disabled={busy} onClick={onBackToMocks}>Continue to mock publishing<ArrowRight/></Button></div>}
  {reviewing&&<QuestionReviewDialog key={reviewing.id+reviewing.revision} question={reviewing} busy={busy&&busyId===reviewing.id} error={dialogError} hasNext={pending.some(q=>q.id!==reviewing.id)} onClose={()=>{setReviewing(null);setDialogError('');}} onConfirm={(action,next)=>void confirmReview(action,next)}/>}
  {target&&<Dialog open onOpenChange={open=>{if(!open&&!busy)setTarget(null);}}><DialogContent showCloseButton={!busy} className="rounded-2xl sm:max-w-lg"><DialogHeader><DialogTitle>{target.action==='access'?'Change question access?':target.action==='retire'?'Retire this question?':target.action==='restore'?'Restore this question?':'Return this question to draft?'}</DialogTitle><DialogDescription>Question #{target.question.position} · {target.question.question}</DialogDescription></DialogHeader><p className="text-sm leading-6">{target.action==='access'?`Change to ${target.tier==='premium'?'Pro only':'Free practice'}. This clears the recorded review and hides the question until reviewed and published again. Every mock using it can be affected.`:target.action==='retire'?'This hides the question from learners. Mocks using its position may become incomplete and hidden; saved attempts are preserved.':target.action==='restore'?'This restores the question to its original position. If it is already reviewed and published, it may become visible to learners again.':'This removes the review approval and hides the question until it is reviewed and published again.'}</p>{dialogError&&<Notice kind="error">{dialogError}</Notice>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={()=>setTarget(null)}>Cancel</Button><Button type="button" disabled={busy} onClick={()=>void confirmAction()}>{busy&&<LoaderCircle className="animate-spin"/>}{busy?'Saving…':'Confirm change'}</Button></div></DialogContent></Dialog>}
  {topicAction&&<Dialog open onOpenChange={open=>{if(!open&&!busy)setTopicAction(false);}}><DialogContent showCloseButton={!busy} className="rounded-2xl sm:max-w-lg"><DialogHeader><DialogTitle>{current.active?'Deactivate this topic?':'Activate this ready topic?'}</DialogTitle><DialogDescription>{current.name}</DialogDescription></DialogHeader><p className="text-sm leading-6">{current.active?'This hides topic practice and may hide mocks that use it. Other source topics and saved attempts are preserved.':`${counts.published} reviewed and published questions are ready. Any remaining drafts stay private. The mock itself must still be published separately.`}</p>{dialogError&&<Notice kind="error">{dialogError}</Notice>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={()=>setTopicAction(false)}>Cancel</Button><Button disabled={busy} onClick={()=>void toggleTopic()}>{busy?'Saving…':current.active?'Deactivate topic':'Activate topic'}</Button></div></DialogContent></Dialog>}
 </div>;
}
