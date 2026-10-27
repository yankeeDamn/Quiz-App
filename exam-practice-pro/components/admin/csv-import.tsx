'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { admin, type QuestionInput } from '@/lib/admin';
import { Notice } from '@/components/admin/ui';

const HEADER=['question','option_a','option_b','option_c','option_d','correct_option','explanation','difficulty'];
const EXAMPLE=['What does IaaS commonly provide?','Virtual machines','Email accounts only','Paper invoices','Domain registration only','A','Infrastructure as a Service provides compute resources.','Easy'];

function parseCsv(source:string): string[][] {
 const rows:string[][]=[];let row:string[]=[],field='',quoted=false;
 const data=source.replace(/^\uFEFF/,'');
 for(let i=0;i<data.length;i++){
  const ch=data[i];
  if(ch==='"'){
   if(quoted&&data[i+1]==='"'){field+='"';i++}
   else if(quoted)quoted=false;
   else if(!field)quoted=true;
   else throw Error('Unexpected quotation mark');
  }else if(ch===','&&!quoted){row.push(field);field=''}
  else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&data[i+1]==='\n')i++;row.push(field);field='';if(row.some(x=>x.trim()))rows.push(row);row=[]}
  else field+=ch;
 }
 if(quoted)throw Error('Unclosed CSV quotation mark');
 if(field||row.length){row.push(field);rows.push(row)}
 return rows;
}
function toRows(source:string):QuestionInput[]{
 const parsed=parseCsv(source);
 if(parsed.length<2||parsed[0].map(x=>x.trim().toLowerCase()).join(',')!==HEADER.join(','))throw Error('Expected CSV header: '+HEADER.join(', '));
 return parsed.slice(1).map((fields,i)=>{
  if(fields.length!==HEADER.length)throw Error(`Row ${i+2}: expected ${HEADER.length} columns`);
  const letter=fields[5].trim().toUpperCase();
  if(!['A','B','C','D'].includes(letter))throw Error(`Row ${i+2}: correct_option must be A, B, C or D`);
  return {question:fields[0].trim(),options:fields.slice(1,5).map(x=>x.trim()),answer:letter.charCodeAt(0)-65,explanation:fields[6].trim(),difficulty:fields[7].trim()||'Moderate'};
 });
}
function downloadTemplate(){
 const quote=(text:string)=>'"'+text.replaceAll('"','""')+'"';
 const csv=[HEADER,EXAMPLE].map(row=>row.map(quote).join(',')).join('\r\n')+'\r\n';
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
 const a=document.createElement('a');a.href=url;a.download='exampro-questions-template.csv';a.click();
 URL.revokeObjectURL(url);
}
export function CsvImport({topic,onSaved}:{topic:string;onSaved:()=>void}){
 const [rows,setRows]=useState<QuestionInput[]>([]);
 const [selectedFile,setSelectedFile]=useState('');
 const [message,setMessage]=useState('');
 const [errors,setErrors]=useState<{row:number;message:string}[]>([]);
 const [approved,setApproved]=useState(false);
 const [busy,setBusy]=useState(false);
 const read=async(file?:File)=>{
  setApproved(false);setErrors([]);setRows([]);setMessage('');setSelectedFile('');
  if(!file)return;
  try{
   if(file.size>1024*1024)throw Error('Maximum CSV size is 1 MB');
   if(!file.name.toLowerCase().endsWith('.csv'))throw Error('Choose a downloaded .csv file, not the GitHub HTML page.');
   const parsed=toRows(await file.text());
   if(parsed.length>200)throw Error('Maximum 200 questions per import');
   setSelectedFile(file.name);
   setRows(parsed);setMessage(`${file.name}: ${parsed.length} rows parsed. Validate against the database before importing.`);
  }catch(e){setMessage(e instanceof Error?e.message:'Could not parse CSV')}
 };
 const preview=async()=>{
  setBusy(true);setApproved(false);
  try{
   const result=await admin<{valid:boolean;count:number;errors:{row:number;message:string}[]}>(`/topics/${topic}/questions/preview`,'POST',{questions:rows});
   if(!result.ok)throw Error(result.message);
   setErrors(result.data.errors);setApproved(result.data.valid);
   setMessage(result.data.valid?`${result.data.count} rows validated. Ready to import.`:'Fix the listed errors and upload a corrected file.');
  }catch(e){setMessage(e instanceof Error?e.message:'Validation failed')}
  finally{setBusy(false)}
 };
 const save=async()=>{
  setBusy(true);
  try{
   const result=await admin<{valid:boolean;added:number;errors:{row:number;message:string}[]}>(`/topics/${topic}/import`,'POST',{questions:rows});
   if(!result.ok)throw Error(result.message);
   setErrors(result.data.errors);setApproved(false);
   if(result.data.valid){setMessage(`Imported ${result.data.added} questions.`);setRows([]);onSaved()}
   else setMessage('Import cancelled: data changed or duplicates found. No rows were saved.');
  }catch(e){setMessage(e instanceof Error?e.message:'Import failed')}
  finally{setBusy(false)}
 };
 return <section className="rounded-xl border bg-card p-5">
  <h2 className="text-lg font-bold">CSV question import</h2><p className="mt-1 text-sm text-muted-foreground">Download the original sample, edit it in a spreadsheet, then preview and validate before an all-or-nothing import. Existing questions are preserved.</p>
  <div className="mt-3 flex flex-wrap gap-3"><Button type="button" variant="outline" onClick={downloadTemplate}>Download CSV template</Button>
   <input aria-label="Choose CSV file" className="max-w-full rounded-lg border border-input px-3 py-2 text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 file:font-semibold" type="file" accept=".csv,text/csv"
     onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';void read(file)}}/></div>
  <p className="mt-2 text-xs text-muted-foreground">Choose the downloaded raw .csv file for the selected topic (not the GitHub page). If the file dialog does not open, use Chrome or Edge on a desktop and try again.</p>
  {selectedFile&&<p className="mt-2 text-sm font-semibold" aria-live="polite">Selected: {selectedFile} — {rows.length} rows</p>}
  {message&&<p className="mt-3 text-sm" role="status">{message}</p>}
  {errors.map((error,i)=><Notice key={i} kind="error">Row {error.row}: {error.message}</Notice>)}
  <div className="mt-4 flex gap-2"><Button type="button" disabled={!topic||busy||rows.length===0} onClick={()=>void preview()}>Validate {rows.length||''} rows</Button><Button type="button" disabled={!approved||busy} onClick={()=>void save()}>Import validated rows</Button></div>
 </section>
}
