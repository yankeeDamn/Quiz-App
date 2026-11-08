import { proxyPdf } from '@/lib/server/ebook-proxy';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export async function GET(_request:Request,{params}:{params:Promise<{slug:string}>}){const {slug}=await params;return proxyPdf(slug,'pdf');}
