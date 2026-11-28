 'use client';
import {useEffect,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import {useSession} from 'next-auth/react';
import {usePlan} from '@/hooks/use-plan';
import {monetization,monetizationEnabled,cacheRead,cacheWrite,safeDestination,telemetry,type Ad,type Slot} from '@/lib/monetization';
export function useAdPermission(userPlan?:string,completed=false){
 const path=usePathname(),plan=usePlan(),{data:session,status}=useSession();const email=session?.user?.email||'';
 const [access,setAccess]=useState<{email:string;adFree:boolean}|null>(null);
 useEffect(()=>{if(!email||!monetizationEnabled)return;let active=true;void monetization<{adFree:boolean}>('/monetization/me').then(r=>{if(active&&r.success&&r.data)setAccess({email,adFree:r.data.adFree});});return()=>{active=false;};},[email]);
 // Block every runner route, even before its timer or entitlement loads.
 return !/^\/institute(?:\/|$)/.test(path) && monetizationEnabled && status!=='loading' && plan.loaded && !plan.active && !['pro','institute'].includes(userPlan||'') && (!email||(access?.email===email&&!access.adFree)) && (completed || !/^\/(india-mocks\/|quiz\/|exampro|certifications\/exam|practice\/)/.test(path));
}
type SlotProps={slot:Slot;category?:string;userPlan?:string;completed?:boolean};
export function SponsoredSlot(props:SlotProps){
 const allowed=useAdPermission(props.userPlan,props.completed);
 return allowed?<PermittedSlot {...props}/>:null;
}
function PermittedSlot({slot,category='ALL'}:SlotProps){
 const allowed=true,ref=useRef<HTMLElement>(null);
 const [ads,setAds]=useState<Ad[]>(()=>cacheRead<Ad[]>('ep:public-ads')||[]);
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{let active=true;void monetization<{ads:Ad[]}>('/ads',{public:true}).then(r=>{if(active&&r.data){setAds(r.data.ads);setNow(Date.now());cacheWrite('ep:public-ads',r.data.ads);}});const timer=setInterval(()=>setNow(Date.now()),1000);return()=>{active=false;clearInterval(timer);};},[]);
 const ad=ads.find(a=>a.slotType===slot&&Date.parse(a.expiresAt)>now&&(a.targetCategory==='ALL'||a.targetCategory.toLowerCase()===category.toLowerCase()));
 useEffect(()=>{if(!allowed||!ad||!ref.current)return;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){telemetry('/ads/'+ad.id+'/track','impression');observer.disconnect();}},{threshold:0.5});observer.observe(ref.current);return()=>observer.disconnect();},[allowed,ad]);
 if(!allowed||!ad||!safeDestination(ad.destinationUrl))return null;
 return <aside ref={ref} className="my-6 rounded-2xl border border-border bg-accent-soft/50 p-5 dark:border-border dark:bg-accent-soft/20" aria-label="Sponsored placement"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sponsored · {ad.badgeText}</p><h3 className="mt-2 text-xl font-bold">{ad.headline}</h3><p className="my-2 text-sm">{ad.subtext}</p><a href={safeDestination(ad.destinationUrl)} target="_blank" rel="sponsored noopener noreferrer" onClick={()=>telemetry('/ads/'+ad.id+'/track','click')} className="inline-block py-2 font-semibold text-accent-ink dark:text-accent-ink">{ad.ctaLabel} ↗</a></aside>;
}
