'use strict';
/**
 * Public, read-only recruitment index from official Indian government sites.
 * Scrapes ONLY pinned government URLs and does NOT present indexed notices as
 * endorsements or applications. Never fabricates open vacancies or deadlines.
 */
const crypto = require('node:crypto');
const EMPLOYMENT_URL='https://employmentnews.gov.in/newemp/AllJobs.aspx?k=All';
const UPSC_URL='https://cms.upsc.gov.in/examination-calendar/';
const TTL_MS=30*60*1000;
const MAX_STALE_MS=6*60*60*1000;
const MAX_BYTES=1024*1024;
const cache=new Map();
const pending=new Map();
const failureUntil=new Map();
const SOURCES=Object.freeze([
 {id:'employment-news',label:'Employment News (Govt. of India)',url:EMPLOYMENT_URL,type:'vacancies'},
 {id:'upsc',label:'UPSC Forthcoming Examinations',url:UPSC_URL,type:'upcoming'},
]);
const PORTALS=Object.freeze([
 {name:'Employment News',category:'General',url:EMPLOYMENT_URL,description:'Government recruitment advertisements and closing dates'},
 {name:'Staff Selection Commission',category:'SSC',url:'https://ssc.gov.in/',description:'SSC CGL, CHSL, MTS, GD, JE notices and calendar'},
 {name:'Union Public Service Commission',category:'UPSC',url:UPSC_URL,description:'UPSC forthcoming examinations and official annual calendar'},
 {name:'National Career Service',category:'General',url:'https://ncs.gov.in/',description:'Government and other job listings; filter by organisation type'},
 {name:'Institute of Banking Personnel Selection',category:'Banking',url:'https://www.ibps.in/',description:'Banking recruitment notifications and calendars'},
 {name:'Railway Recruitment Boards',category:'Railways',url:'https://www.rrbcdg.gov.in/',description:'Railway recruitment notices and centralized employment notifications'},
]);
function plain(html){
 return String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi,' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi,' ')
  .replace(/<[^>]+>/g,' ')
  .replace(/&(?:nbsp|#160);/gi,' ')
  .replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
  .replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
  .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Math.min(Number(n),0x10ffff)))
  .replace(/\s+/g,' ').trim().slice(0,350);
}
function parseDate(value,us=false){
 const m=String(value).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
 if(!m)return null;
 const d=+(us?m[2]:m[1]),mo=+(us?m[1]:m[2]),y=+m[3];
 if(y<2020||y>2100||mo<1||mo>12||d<1||d>31)return null;
 const utc=new Date(Date.UTC(y,mo-1,d));
 if(utc.getUTCFullYear()!==y||utc.getUTCMonth()+1!==mo||utc.getUTCDate()!==d)return null;
 return utc.toISOString().slice(0,10);
}
function indiaToday(now=new Date()){
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'})
 .format(now).replace(/(\d{2})\/(\d{2})\/(\d{4})/,'$3-$1-$2');
}
function idOf(...data){return crypto.createHash('sha256').update(data.join('|').toLowerCase()).digest('hex').slice(0,18);}
function parseEmployment(html,now=new Date()){
 if(typeof html!=='string'||html.length>MAX_BYTES)return [];
 const today=indiaToday(now);
 const maxIssue=new Date(now.getTime()+86400000).toISOString().slice(0,10);
 const cutOff=new Date(now.getTime()-180*86400000).toISOString().slice(0,10);
 const rows=html.match(/<tr\b[^>]*>[\s\S]*?<\/tr\s*>/gi)||[];
 const results=new Map();
 for(const row of rows.slice(0,1500)){
  const cells=[...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td\s*>/gi)].map(m=>plain(m[1]));
  if(cells.length<5)continue;
  // Employment News: Issue MM/DD/YYYY, Organisation, Post, Appointment, Deadline DD/MM/YYYY.
  const issue=parseDate(cells[0],true),deadline=parseDate(cells[4]);
  const org=cells[1],position=cells[2],method=cells[3];
  if(!issue||!deadline||issue>maxIssue||issue<cutOff||deadline<today||deadline<'2020-01-01')continue;
  if(org.length<3||org.length>180||position.length<3||position.length>250||method.length>120)continue;
  if(/^(all jobs|method of appointment|organisation|organization|issued date|post)$/i.test(org))continue;
  const id=idOf(org,position,deadline);
  results.set(id,{id,title:position,organisation:org,category:'General',status:'open',
   applicationDeadline:deadline,noticeDate:issue,method,source:'Employment News',
   sourceUrl:EMPLOYMENT_URL,applicationUrl:null, // Do not invent direct apply URLs.
   notice:'Listed by Employment News. Read the official advertisement and verify eligibility before applying.'});
 }
 return [...results.values()].sort((a,b)=>a.applicationDeadline.localeCompare(b.applicationDeadline)).slice(0,150);
}
function parseUpcomingUpsc(html){
 if(typeof html!=='string'||html.length>MAX_BYTES)return [];
 const index=html.search(/Forthcoming Examinations/i);
 if(index<0)return [];
 // Constrain extraction to the clearly labelled forthcoming section, never other headings.
 const after=html.slice(index,index+24000);
 const terminator=after.search(/(?:Annual Calendar Documents|<h2[^>]*>\s*Annual Calendar|Archives)/i);
 const content=terminator>0?after.slice(0,terminator):after.slice(0,12000);
 const matches=[...content.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3\s*>/gi)];
 const list=new Map();
 for(const m of matches.slice(0,15)){
  const title=plain(m[1]);
  if(title.length<10||title.length>180||!/(examination|ldce|nda|cds|cisf|civil service)/i.test(title))continue;
  const id=idOf('upsc',title);
  list.set(id,{id,title,organisation:'Union Public Service Commission',category:'UPSC',
   status:'upcoming',applicationDeadline:null,noticeDate:null,method:'Examination',
   source:'UPSC',sourceUrl:UPSC_URL,applicationUrl:null,
   notice:'Listed as forthcoming. Notification and application dates are not confirmed here. Check UPSC before applying.'});
 }
 return [...list.values()].slice(0,12);
}
async function fetchText(url){
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),8000);
 try{
  const res=await fetch(url,{signal:controller.signal,headers:{Accept:'text/html','User-Agent':'ExamProJobsIndexer/1.0 (+https://quiz-app-virid-zeta-41.vercel.app/government-jobs)'},redirect:'follow'});
  const finalUrl=new URL(res.url);
  const originalHost=new URL(url).hostname;
  const allowedHosts=originalHost==='employmentnews.gov.in'
   ?['employmentnews.gov.in','www.employmentnews.gov.in']:[originalHost];
  if(!res.ok||finalUrl.protocol!=='https:'||!allowedHosts.includes(finalUrl.hostname))
   throw Error('Government source unavailable');
  if(Number(res.headers.get('content-length')||0)>MAX_BYTES)throw Error('Government response too large');
  const reader=res.body?.getReader();
  if(!reader)throw Error('Empty source body');
  const chunks=[];let size=0;
  while(true){
   const {done,value}=await reader.read();if(done)break;
   size+=value.length;
   if(size>MAX_BYTES){await reader.cancel();throw Error('Government response too large');}
   chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
 }finally{clearTimeout(timeout);}
}
async function refresh(source,now=new Date()){
 const previous=cache.get(source.id);
 if(previous && now.getTime()-previous.checkedAt<TTL_MS)return previous;
 if(pending.has(source.id))return pending.get(source.id);
 if((failureUntil.get(source.id)||0)>Date.now()){
  if(previous && Date.now()-previous.checkedAt<MAX_STALE_MS)return {...previous,health:'stale'};
  return {items:[],checkedAt:null,health:'unavailable'};
 }
 const task=(async()=>{
  try{
   const html=await fetchText(source.url);
   const items=source.id==='employment-news'?parseEmployment(html,now):parseUpcomingUpsc(html);
   // A parser mismatch is not a verified empty result; preserve last known data within bounded TTL.
   if(items.length===0)throw Error('No reliable records parsed from official source');
   const result={items,checkedAt:Date.now(),health:'ok'};
   failureUntil.delete(source.id);
   cache.set(source.id,result);return result;
  }catch{
   failureUntil.set(source.id,Date.now()+5*60*1000);
   if(previous && now.getTime()-previous.checkedAt<MAX_STALE_MS)
    return {...previous,health:'stale'};
   return {items:[],checkedAt:null,health:'unavailable'};
  }finally{pending.delete(source.id);}
 })();
 pending.set(source.id,task);return task;
}
async function list(now=new Date()){
 const [employment,upsc]=await Promise.all(SOURCES.map(s=>refresh(s,now)));
 const today=indiaToday(now);
 const jobs=[...employment.items,...upsc.items]
  .filter(x=>x.status==='upcoming'||(x.applicationDeadline&&x.applicationDeadline>=today))
  .sort((a,b)=>a.status===b.status
   ?(a.applicationDeadline||'9999').localeCompare(b.applicationDeadline||'9999')
   :(a.status==='open'?-1:1));
 return {jobs,portals:PORTALS,sources:SOURCES.map((s,i)=>({
  id:s.id,name:s.label,url:s.url,status:[employment,upsc][i].health,
  checkedAt:[employment,upsc][i].checkedAt?new Date([employment,upsc][i].checkedAt).toISOString():null,
 })),updatedAt:new Date().toISOString(),disclaimer:'ExamPro is not a government recruitment authority. Some official sources may be delayed or temporarily unavailable. Verify the complete notice, eligibility, deadlines and application link at the issuing authority.'};
}
module.exports={parseDate,indiaToday,parseEmployment,parseUpcomingUpsc,plain,list,PORTALS,SOURCES};
