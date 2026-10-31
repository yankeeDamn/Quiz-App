import type {MetadataRoute} from 'next';
const SITE=(process.env.NEXT_PUBLIC_SITE_URL||'https://quiz-app-virid-zeta-41.vercel.app').replace(/\/$/,'');
export default function sitemap():MetadataRoute.Sitemap{return ['/','/exampro','/india-mocks','/government-jobs','/certifications','/pricing','/privacy','/terms','/refunds','/contact'].map(path=>({url:SITE+path,changeFrequency:path==='/government-jobs'?'daily' as const:path==='/'?'weekly' as const:'monthly' as const,priority:path==='/'?1:0.6}));}
