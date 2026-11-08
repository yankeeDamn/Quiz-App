import { proxyAdminJson } from '@/lib/server/ebook-proxy';
export const dynamic='force-dynamic';
export const runtime='nodejs';

export async function GET(){return proxyAdminJson('', 'GET');}
export async function POST(request:Request){
  let body:unknown;
  try{body=await request.json();}catch{return Response.json({success:false,error:{message:'Invalid JSON payload.'}},{status:400});}
  return proxyAdminJson('', 'POST', body);
}
