import { proxyAdminJson, backendToken } from '@/lib/server/ebook-proxy';
import { API_BASE_URL } from '@/lib/api';
export const dynamic='force-dynamic';
export const runtime='nodejs';

const valid=(slug:string)=>/^[a-z0-9][a-z0-9-]{1,59}$/.test(slug);
export async function GET(_request:Request,{params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;if(!valid(slug))return Response.json({success:false,error:{message:'Not found'}},{status:404});
  const auth=await backendToken();if(auth.error)return auth.error;
  try{
    const response=await fetch(`${API_BASE_URL}/api/v1/ebooks/${encodeURIComponent(slug)}`,{headers:{Authorization:`Bearer ${auth.token}`},cache:'no-store',signal:AbortSignal.timeout(30000)});
    return new Response(response.body,{status:response.status,headers:{'Content-Type':response.headers.get('Content-Type')||'application/json','Cache-Control':'private, no-store'}});
  }catch{return Response.json({success:false,error:{message:'Ebook service unavailable.'}},{status:503});}
}
export async function PUT(request:Request,{params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;if(!valid(slug))return Response.json({success:false,error:{message:'Not found'}},{status:404});
  let body:unknown;try{body=await request.json();}catch{return Response.json({success:false,error:{message:'Invalid JSON payload.'}},{status:400});}
  return proxyAdminJson('/'+encodeURIComponent(slug),'PUT',body);
}
export async function DELETE(_request:Request,{params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;if(!valid(slug))return Response.json({success:false,error:{message:'Not found'}},{status:404});
  return proxyAdminJson('/'+encodeURIComponent(slug),'DELETE');
}
