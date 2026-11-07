import { api } from './api';
export const PRODUCTS={SSC_PACK_49:{title:'SSC CGL mock pass',amount:49,days:30},IT_EBOOK_PACK_99:{title:'IT ebook & assessment pass',amount:99,days:60},PRO_MONTHLY:{title:'Pro monthly',amount:199,days:30},PRO_ANNUAL:{title:'Pro annual',amount:999,days:365},SINGLE_SOLUTION_29:{title:'Live solutions & percentile',amount:29,days:3650},LIVE_ENTRY_19:{title:'Live mock entry',amount:19,days:30}} as const;
export type ProductCode=keyof typeof PRODUCTS;
export const SLOTS={HOME_TOP_BANNER:999,CATEGORY_NATIVE_CARD:499,EBOOK_RAIL_SPONSOR:799,RESULT_SCREEN_OFFER:699} as const;
export type Slot=keyof typeof SLOTS;
export interface Ad {id:string;paymentReference?:string;amountInr?:number;advertiserName?:string;whatsappNumber?:string;slotType:Slot;targetCategory:string;headline:string;subtext:string;ctaLabel:string;destinationUrl:string;badgeText:string;expiresAt:string;status?:string;impressions?:number;clicks?:number}
export const monetizationEnabled=process.env.NEXT_PUBLIC_MONETIZATION_ENABLED==='true';
export function monetization<T>(path:string,options:{method?:string;body?:unknown;public?:boolean}={}){return api<T>('/api/v1'+path,{...options,signal:AbortSignal.timeout(12000)});}
export function sessionId(){try{let id=sessionStorage.getItem('ep:ad-session');if(!id){id=crypto.randomUUID();sessionStorage.setItem('ep:ad-session',id);}return id;}catch{return crypto.randomUUID();}}
export function telemetry(path:string,event:'impression'|'click'){void monetization(path,{method:'POST',public:true,body:{event,sessionId:sessionId()}});}
export function safeDestination(raw:string){try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password?u.href:undefined;}catch{return undefined;}}
export function cacheRead<T>(key:string):T|null{try{const r=JSON.parse(localStorage.getItem(key)||'null');return r&&Date.now()-r.savedAt<300000?r.data:null;}catch{return null;}}
export function cacheWrite(key:string,data:unknown){try{localStorage.setItem(key,JSON.stringify({savedAt:Date.now(),data}));}catch{/* Private browsing: the API remains authoritative. */}}
