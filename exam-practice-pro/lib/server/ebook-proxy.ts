import 'server-only';
import { POST as sessionToken } from '@/app/api/auth/backend-token/route';
import { API_BASE_URL } from '@/lib/api';

const privateHeaders = () => new Headers({
  'Cache-Control':'private, no-store',
  'Vary':'Cookie',
  'X-Content-Type-Options':'nosniff',
});

export async function backendToken(): Promise<{token?:string; error?:Response}> {
  const identity = await sessionToken();
  if (!identity.ok) {
    return {error:new Response('Authentication required',{status:identity.status,headers:privateHeaders()})};
  }
  const data = await identity.json() as {token?:string};
  if (!data.token) return {error:new Response('Authentication required',{status:401,headers:privateHeaders()})};
  return {token:data.token};
}

export async function proxyAdminJson(
  path:string,
  method:string,
  body?:unknown,
): Promise<Response> {
  const auth=await backendToken();
  if(auth.error)return auth.error;
  try {
    const response=await fetch(`${API_BASE_URL}/api/v1/admin/ebooks${path}`,{
      method,
      headers:{
        Authorization:`Bearer ${auth.token}`,
        ...(body===undefined?{}:{'Content-Type':'application/json'}),
      },
      body:body===undefined?undefined:JSON.stringify(body),
      cache:'no-store',
      redirect:'error',
      signal:AbortSignal.timeout(30000),
    });
    const headers=privateHeaders();
    headers.set('Content-Type',response.headers.get('Content-Type')||'application/json; charset=utf-8');
    return new Response(response.body,{status:response.status,headers});
  } catch {
    return new Response(JSON.stringify({success:false,error:{message:'Ebook service unavailable.'}}),{
      status:503,
      headers:{...Object.fromEntries(privateHeaders()),'Content-Type':'application/json; charset=utf-8'},
    });
  }
}

export async function proxyPdf(
  slug:string,
  action:'pdf'|'read'|'download',
):Promise<Response>{
  if(!/^[a-z0-9][a-z0-9-]{1,59}$/.test(slug))return new Response('Not found',{status:404,headers:privateHeaders()});
  const identity=await sessionToken();
  if(!identity.ok && identity.status!==401)return new Response('Unable to verify session',{status:identity.status,headers:privateHeaders()});
  const token=identity.ok?((await identity.json()) as {token?:string}).token:undefined;
  try{
    const response=await fetch(`${API_BASE_URL}/api/v1/ebooks/${encodeURIComponent(slug)}/${action}`,{
      headers:token?{Authorization:`Bearer ${token}`}:{},
      cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000),
    });
    const headers=privateHeaders();
    for(const key of ['Content-Type','Content-Disposition','X-Ebook-Preview','X-Ebook-Preview-Pages']){
      const value=response.headers.get(key);if(value)headers.set(key,value);
    }
    return new Response(response.body,{status:response.status,headers});
  }catch{return new Response('PDF service unavailable',{status:503,headers:privateHeaders()});}
}
