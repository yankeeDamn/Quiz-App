import { POST as sessionToken } from '@/app/api/auth/backend-token/route';
import { API_BASE_URL } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Browser cookies are resolved by Auth.js. Never accept entitlement claims or
// upstream URLs supplied by the caller. Express rechecks the database grants.
export async function GET(_request: Request, {params}: {params: Promise<{slug:string;action:string}>}) {
  const {slug, action} = await params;
  const headers = new Headers({'Cache-Control':'private, no-store', 'Vary':'Cookie', 'X-Content-Type-Options':'nosniff'});
  if (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(slug) || !['read','download'].includes(action))
    return new Response('Not found', {status:404,headers});
  const identity = await sessionToken();
  if (!identity.ok && identity.status !== 401) return new Response('Unable to verify session', {status:identity.status,headers});
  const token = identity.ok ? (await identity.json()).token as string : undefined;
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/ebooks/${slug}/${action}`, {
      headers: token ? {Authorization:`Bearer ${token}`} : {}, cache:'no-store',
      signal:AbortSignal.timeout(30000), redirect:'error',
    });
    for (const key of ['Content-Type','Content-Disposition','X-Ebook-Preview','X-Ebook-Preview-Pages']) {
      const value=response.headers.get(key); if(value)headers.set(key,value);
    }
    return new Response(response.body, {status:response.status,headers});
  } catch { return new Response('PDF service unavailable', {status:503,headers}); }
}
