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
 return monetizationEnabled && status!=='loading' && plan.loaded && !plan.active && !['pro','institute'].includes(userPlan||'') && (!email||(access?.email===email&&!access.adFree)) && (completed || !/^\/(india-mocks\/|quiz\/|exampro|certifications\/exam|practice\/)/.test(path));
}
export function SponsoredSlot({slot,category='ALL',userPlan,completed=false}:{slot:Slot;category?:string;userPlan?:string;completed?:boolean}){
 const allowed=useAdPermission(userPlan,completed),[ads,setAds]=useState<Ad[]>([]),ref=useRef<HTMLElement>(null);
 useEffect(()=>{if(!allowed)return;let active=true;setAds(cacheRead<Ad[]>('ep:public-ads')||[]);void monetization<{ads:Ad[]}>('/ads',{public:true}).then(r=>{if(active&&r.data){setAds(r.data.ads);cacheWrite('ep:public-ads',r.data.ads);}});return()=>{active=false;};},[allowed]);
 const ad=ads.find(a=>a.slotType===slot&&Date.parse(a.expiresAt)>Date.now()&&(a.targetCategory==='ALL'||a.targetCategory.toLowerCase()===category.toLowerCase()));
 useEffect(()=>{if(!allowed||!ad||!ref.current)return;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){telemetry('/ads/'+ad.id+'/track','impression');observer.disconnect();}},{threshold:0.5});observer.observe(ref.current);return()=>observer.disconnect();},[allowed,ad]);
 if(!allowed||!ad||!safeDestination(ad.destinationUrl))return null;
 return <aside ref={ref} className="my-6 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5 dark:border-indigo-900 dark:bg-indigo-950/20" aria-label="Sponsored placement"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sponsored · {ad.badgeText}</p><h3 className="mt-2 text-xl font-bold">{ad.headline}</h3><p className="my-2 text-sm">{ad.subtext}</p><a href={safeDestination(ad.destinationUrl)} target="_blank" rel="sponsored noopener noreferrer" onClick={()=>telemetry('/ads/'+ad.id+'/track','click')} className="inline-block py-2 font-semibold text-indigo-700 dark:text-indigo-300">{ad.ctaLabel} ↗</a></aside>;
}
