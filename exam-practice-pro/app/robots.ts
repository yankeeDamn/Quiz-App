import type {MetadataRoute} from 'next';
const SITE=(process.env.NEXT_PUBLIC_SITE_URL||'https://quiz-app-virid-zeta-41.vercel.app').replace(/\/$/,'');
export default function robots():MetadataRoute.Robots{return {rules:{userAgent:'*',allow:'/',disallow:['/admin','/institute-admin','/dashboard','/bookmarks','/auth','/api','/quiz']},sitemap:`${SITE}/sitemap.xml`};}
