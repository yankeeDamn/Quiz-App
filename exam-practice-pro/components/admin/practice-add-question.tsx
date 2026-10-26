'use client';
import { useState } from 'react';
import { admin } from '@/lib/admin';
import { Button } from '@/components/ui/button';
import { card, input } from '@/components/admin/ui';
import type { PracticeAddition } from '@/lib/practice-overrides';
export function PracticeAddQuestion({source,groupId,onAdded}:{
 source:'homepage'|'certification';groupId:string;onAdded:(row:PracticeAddition)=>void
}) {
 const [open,setOpen]=useState(false);
 const [type,setType]=useState<'single'|'multiple'|'true-false'>('single');
 const [subject,setSubject]=useState('Cloud Computing');
 const [topic,setTopic]=useState('Fundamentals');
 const [difficulty,setDifficulty]=useState('Easy');
 const [question,setQuestion]=useState('');
 const [options,setOptions]=useState(['','','','']);
 const [correct,setCorrect]=useState<string[]>([]);
 const [explanation,setExplanation]=useState('');
 const [error,setError]=useState('');
 const [saving,setSaving]=useState(false);
 const ids=source==='certification'?['A','B','C','D']:type==='true-false'?['true','false']:['a','b','c','d'];
 const multiple=source==='homepage' && type==='multiple';
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();if(!correct.length)return setError('Select a correct answer.');
  const payload=source==='certification'
   ?{exam_code:groupId,subject,question,options,correct_option:correct[0],explanation,review_status:'needs_review'}
   :{subject,topic,difficulty,type,question,options:ids.map((id,i)=>({id,text:options[i]})),correctAnswers:correct,explanation};
  setSaving(true);setError('');
  try {
   const result=await admin<{addition:PracticeAddition}>('/practice/questions','POST',{source,groupId,question:payload});
   if(!result.ok){setError(result.message);return;}
   onAdded(result.data.addition);setQuestion('');setCorrect([]);setExplanation('');
   setOptions(type==='true-false'?['True','False']:['','','','']);setOpen(false);
  } catch {setError('API unavailable. Check Render deployment.');}
  finally{setSaving(false);}
 };
 return <section className={card}>
  <div className="flex flex-wrap justify-between gap-3">
   <h3 className="text-lg font-bold">Add new practice question</h3>
   <Button variant="outline" onClick={()=>setOpen(!open)}>{open?'Cancel':'Add question'}</Button>
  </div>
  {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
  {open && <form onSubmit={e=>void submit(e)} className="mt-4 grid gap-3">
   <label>Subject<input className={input} required minLength={2} value={subject} onChange={e=>setSubject(e.target.value)}/></label>
   {source==='homepage' && <>
    <label>Topic<input className={input} required minLength={2} value={topic} onChange={e=>setTopic(e.target.value)}/></label>
    <label>Difficulty<select className={input} value={difficulty} onChange={e=>setDifficulty(e.target.value)}>{['Easy','Medium','Hard'].map(x=><option key={x}>{x}</option>)}</select></label>
    <label>Question type<select className={input} value={type} onChange={e=>{const v=e.target.value as typeof type;setType(v);setCorrect([]);setOptions(v==='true-false'?['True','False']:['','','','']);}}>
     <option value="single">Single choice</option><option value="multiple">Multiple correct</option><option value="true-false">True / False</option>
    </select></label>
   </>}
   <label>Question<textarea className={input} required minLength={5} maxLength={600} value={question} onChange={e=>setQuestion(e.target.value)}/></label>
   <p className="text-sm">Choose the correct {multiple?'answers':'answer'} below.</p>
   {ids.map((id,i)=><div key={id} className="flex items-center gap-2">
    <input type={multiple?'checkbox':'radio'} name="new-answer" checked={correct.includes(id)}
     onChange={e=>setCorrect(multiple?(e.target.checked?[...correct,id]:correct.filter(x=>x!==id)):[id])}/>
    <label className="w-12">{id.toUpperCase()}</label>
    <input className={input} required value={options[i]??''} onChange={e=>setOptions(v=>v.map((x,k)=>k===i?e.target.value:x))}/>
   </div>)}
   <label>Explanation<textarea className={input} required minLength={3} maxLength={1000} value={explanation} onChange={e=>setExplanation(e.target.value)}/></label>
   <Button type="submit" disabled={saving||!correct.length}>{saving?'Saving…':'Save new question'}</Button>
  </form>}
 </section>;
}
