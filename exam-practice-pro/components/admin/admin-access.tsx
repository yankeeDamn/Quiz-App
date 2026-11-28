'use client';
import { useEffect, useState, Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { admin, type Call } from '@/lib/admin';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/content-primitives';

/** Uses the same backend permission check as /admin; stale account checks never grant access. */
export function AdminAccess({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const account = session?.user?.email;
  const [check, setCheck] = useState<{ account: string; result: Call<unknown> } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (status !== 'authenticated' || !account) return;
    let cancelled = false;
    void admin('/me').then(result => { if (!cancelled) setCheck({ account, result }); });
    return () => { cancelled = true; };
  }, [account, status, retry]);
  if (status === 'unauthenticated') return <section className="mx-auto max-w-xl space-y-4 rounded-xl border bg-card p-8"><h1 className="text-2xl">Owner administration</h1><p className="text-muted-foreground">Sign in with an authorized administrator account to view this workspace.</p><Button asChild><Link href="/auth/signin?callbackUrl=/admin">Sign in</Link></Button></section>;
  if (status === 'loading' || !account || check?.account !== account) return <div role="status" className="mx-auto max-w-xl space-y-4"><span className="sr-only">Checking admin access</span><Skeleton className="h-10 w-2/3" /><Skeleton className="h-36 w-full" /></div>;
  if (!check.result.ok) return <div role="alert" className="mx-auto max-w-xl space-y-4 rounded-xl border bg-card p-8"><h1 className="text-xl">Workspace unavailable</h1><p>{check.result.message}</p><Button variant="outline" onClick={() => { setCheck(null); setRetry(value => value + 1); }}>Try again</Button></div>;
  return <Fragment key={account}>{children}</Fragment>;
}
