import { backendToken } from '@/lib/server/ebook-proxy';
import { API_BASE_URL } from '@/lib/api';
export const dynamic='force-dynamic';
export const runtime='nodejs';

export async function POST(request:Request,{params}:{params:Promise<{slug:string}>}){
  const {slug}=await params;
  if(!/^[a-z0-9][a-z0-9-]{1,59}$/.test(slug))return Response.json({success:false,error:{message:'Not found'}},{status:404});
  const auth=await backendToken();if(auth.error)return auth.error;
  const filename=(request.headers.get('x-ebook-filename')||'ebook.pdf').slice(0,180);
  const revision=request.headers.get('x-ebook-revision')||'';
  const bytes=await request.arrayBuffer();
  if(bytes.byteLength>3*1024*1024)return Response.json({success:false,error:{message:'Maximum upload size is 3 MiB.'}},{status:413});
  try{
    const response=await fetch(`${API_BASE_URL}/api/v1/admin/ebooks/${encodeURIComponent(slug)}/pdf?filename=${encodeURIComponent(filename)}&revision=${encodeURIComponent(revision)}`,{
      method:'POST',
      headers:{Authorization:`Bearer ${auth.token}`,'Content-Type':'application/pdf'},
      body:bytes,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000),
    });
    return new Response(response.body,{status:response.status,headers:{'Content-Type':response.headers.get('Content-Type')||'application/json','Cache-Control':'private, no-store'}});
  }catch{return Response.json({success:false,error:{message:'PDF service unavailable.'}},{status:503});}
}
