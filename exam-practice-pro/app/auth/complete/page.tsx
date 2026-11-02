'use client';
import { Suspense, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { track } from '@/lib/track';
function Complete() {
  const { status } = useSession();
  const query = useSearchParams(),
    router = useRouter(),
    sent = useRef(false);
  const raw = query.get('next') || '/';
  const next =
    raw.startsWith('/') &&
    !raw.startsWith('//') &&
    !raw.includes('\\') &&
    !raw.startsWith('/auth/complete')
      ? raw
      : '/';
  useEffect(() => {
    if (status === 'authenticated' && !sent.current) {
      sent.current = true;
      track('sign_in');
      router.replace(next);
    } else if (status === 'unauthenticated')
      router.replace(`/auth/signin?callbackUrl=${encodeURIComponent(next)}`);
  }, [status, next, router]);
  return (
    <p role="status" className="p-8 text-center text-muted-foreground">
      Completing sign-in…
    </p>
  );
}
export default function SignInComplete() {
  return (
    <Suspense fallback={<p className="p-8">Completing sign-in…</p>}>
      <Complete />
    </Suspense>
  );
}
