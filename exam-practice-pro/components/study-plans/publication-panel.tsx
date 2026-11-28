"use client";
import { useEffect,useState } from "react";
import { admin } from "@/lib/admin";
import { Button } from "@/components/ui/button";
type History={schedule:{expected_revision:number;publish_at:string}|null;versions:{id:string;revision:number;created_at:string}[];events:{id:string;action:string;created_at:string}[]};
export function PublicationPanel({id,revision,ready,ack,draft}:{id:string;revision:number;ready:boolean;ack:boolean;draft:boolean}){
 const [history,setHistory]=useState<History|null>(null),[error,setError]=useState(""),[when,setWhen]=useState(""),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0);
 const path="/study-plans/plans/"+encodeURIComponent(id);
 useEffect(()=>{let cancelled=false;void admin<History>(path+"/publication-history").then(r=>{if(cancelled)return;if(r.ok){setHistory(r.data);setError("");}else setError(r.message);});return()=>{cancelled=true;};},[path,revision,refresh]);
 async function change(cancel:boolean){
  setBusy(true);setError("");
  try{
   const date=new Date(when);
   if(!cancel&&(!Number.isFinite(date.getTime())||date.getTime()<=Date.now())){setError("Choose a future publication time.");return;}
   const r=await admin(path+"/schedule",cancel?"DELETE":"POST",cancel?undefined:{revision,acknowledged:ack,publishAt:date.toISOString()});
   if(!r.ok){setError(r.message);return;}
   setRefresh(x=>x+1);setWhen("");
  }finally{setBusy(false);}
 }
 return <section className="space-y-3 rounded-xl border p-4" aria-label="Publishing history and schedule">
 <h3 className="font-bold">Schedule and publication history</h3>
 {error&&<p role="alert" className="text-sm text-muted-foreground">{error}</p>}
 {!history&&!error&&<p role="status">Loading publication history…</p>}
 {history&&<>{history.schedule?<div><p className="text-sm">Queued for {new Date(history.schedule.publish_at).toLocaleString()} (local time)</p>{history.schedule.expected_revision!==revision&&<p role="alert">Draft changed. Cancel and review again before rescheduling.</p>}<Button variant="outline" disabled={busy} onClick={()=>void change(true)}>Cancel schedule</Button></div>:<p className="text-sm text-muted-foreground">No scheduled publication.</p>}
 {draft&&<><label className="block text-sm">Publication date and time ({Intl.DateTimeFormat().resolvedOptions().timeZone})<input type="datetime-local" className="mt-1 block rounded-lg border bg-background p-2" value={when} onChange={e=>setWhen(e.target.value)}/></label><Button disabled={busy||!ready||!ack||!when} onClick={()=>{if(window.confirm("Schedule this reviewed edition for publication?"))void change(false);}}>Schedule reviewed edition</Button></>}
 <h4 className="text-sm font-semibold">Published versions</h4>{history.versions.length?<ul className="text-sm">{history.versions.map(v=><li key={v.id}>Revision {v.revision} · {new Date(v.created_at).toLocaleString()}</li>)}</ul>:<p className="text-sm text-muted-foreground">No recorded versions.</p>}
 <h4 className="text-sm font-semibold">Recent activity</h4>{history.events.length?<ul className="text-sm">{history.events.map(e=><li key={e.id}>{e.action} · {new Date(e.created_at).toLocaleString()}</li>)}</ul>:<p className="text-sm text-muted-foreground">No recorded activity.</p>}</>}
 </section>;
}
