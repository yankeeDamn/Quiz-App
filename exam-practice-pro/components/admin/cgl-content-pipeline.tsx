'use client';
import {useState} from 'react';
import {admin} from '@/lib/admin';
type Issue={section:string;row:number;message:string};
type Preview={valid:boolean;counts:Record<string,number>;issues:Issue[];academicApproved:number;hindiVerified:number;hindiRequired:number};
type Progress={id:string;name:string;draft:boolean;actual:number;expected:number;academicApproved:number;hindiVerified:number;hindiRequired:number};
export function CglContentPipeline(){
 const [number,setNumber]=useState(2),[source,setSource]=useState('');
 const [preview,setPreview]=useState<Preview|null>(null),[tests,setTests]=useState<Progress[]>([]);
 const [error,setError]=useState(''),[working,setWorking]=useState(false),[notice,setNotice]=useState('');
 const refresh=async()=>{
  setError('');const r=await admin<{tests:Progress[]}>('/content-pipeline/dashboard');
  if(r.ok)setTests(r.data.tests);else setError(r.message);
 };
 const stage=async()=>{
  if(!preview?.valid||!window.confirm('Create 100 questions and four INACTIVE staging topics for Mock '+String(number).padStart(2,'0')+'? This does NOT publish or approve anything.'))return;
  setWorking(true);setError('');setNotice('');
  try{
   const questions=JSON.parse(source) as unknown;
   const r=await admin<{testId:string}>('/content-pipeline/stage-draft','POST',{number,questions,confirmDraftOnly:true});
   if(r.ok){setNotice('Created inactive staging draft '+r.data.testId+'. Human reviews are pending.');setPreview(null);await refresh();}
   else setError(r.message);
  }catch{setError('Invalid JSON.')}
  finally{setWorking(false)}
 };
 const inspect=async()=>{
  setError('');setPreview(null);setWorking(true);
  try{
   const parsed=JSON.parse(source) as unknown;
   const r=await admin<Preview>('/content-pipeline/preview','POST',{number,questions:parsed});
   if(r.ok)setPreview(r.data);else setError(r.message);
  }catch{setError('Invalid JSON. Expected an object with reasoning, general-awareness, quant, english arrays.')}
  finally{setWorking(false)}
 };
 return <section className="space-y-4 rounded-xl border p-5" aria-label="SSC CGL draft content pipeline">
  <h2 className="text-lg font-semibold">SSC CGL Mock 02–10 · Draft content QA</h2>
  <p className="text-sm text-muted-foreground">Staging-only preview. No questions, mocks, approvals, or publication settings are saved here.</p>
  <div className="flex flex-wrap gap-3 items-end">
   <label className="text-sm">Mock number <select className="ml-2 rounded border p-2" value={number} onChange={e=>setNumber(Number(e.target.value))}>{Array.from({length:9},(_,i)=>i+2).map(x=><option key={x} value={x}>{String(x).padStart(2,'0')}</option>)}</select></label>
   <button type="button" className="rounded border px-3 py-2 text-sm" onClick={()=>void refresh()}>Load draft progress</button>
  </div>
  {tests.length>0&&<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="text-left">Draft</th><th>Questions</th><th>Academic</th><th>Hindi</th><th>State</th></tr></thead><tbody>
   {tests.map(t=><tr key={t.id} className="border-t"><td className="py-2">{t.name}</td><td className="text-center">{t.actual}/{t.expected}</td><td className="text-center">{t.academicApproved}/{t.expected}</td><td className="text-center">{t.hindiVerified}/{t.hindiRequired}</td><td className="text-center">{t.draft?'Draft':'Published'}</td></tr>)}
  </tbody></table></div>}
  <label className="block text-sm">Question bank JSON — four arrays of 25 questions each
   <textarea rows={6} className="mt-2 w-full rounded border p-3 font-mono text-xs" value={source} onChange={e=>setSource(e.target.value)} placeholder={'{ "reasoning": [], "general-awareness": [], "quant": [], "english": [] }'}/>
  </label>
  <button type="button" disabled={working||!source.trim()} onClick={()=>void inspect()} className="rounded bg-indigo-700 px-4 py-2 text-white disabled:opacity-50">Validate draft only</button>
  {preview?.valid&&<button type="button" disabled={working} onClick={()=>void stage()} className="ml-3 rounded border border-amber-500 px-4 py-2 text-sm">Create inactive staging draft (confirmation required)</button>}
  {notice&&<p role="status" className="text-sm">{notice}</p>}
  {error&&<p role="alert" className="text-red-600">{error}</p>}
  {preview&&<div role="status" className="space-y-2 text-sm"><p className="font-semibold">{preview.valid?'Validation passed — still requires human QA':'Validation blocked'} · {Object.values(preview.counts).reduce((a,b)=>a+b,0)}/100 rows</p>
   <p>Initial review status: academic 0/100; human Hindi 0/75 (not automatically approved).</p>
   <ul className="max-h-64 overflow-y-auto list-disc pl-5">{preview.issues.slice(0,100).map((i,k)=><li key={k}>{i.section}, row {i.row}: {i.message}</li>)}</ul>
  </div>}
 </section>;
