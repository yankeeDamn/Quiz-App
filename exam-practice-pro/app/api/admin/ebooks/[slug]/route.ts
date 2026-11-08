import { proxyAdminJson } from '@/lib/server/ebook-proxy';
export const dynamic='force-dynamic';
export const runtime='nodejs';

const valid=(slug:string)=>/^[a-z0-9][a-z0-9-]{1,59}$/.test(slug);
export async function GET(_request:Request,{params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  if(!valid(slug))return Response.json({success:false,error:{message:'Not found'}},{status:404});
  return proxyAdminJson('/'+encodeURIComponent(slug),'GET');
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
