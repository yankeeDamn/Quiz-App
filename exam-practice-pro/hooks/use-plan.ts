'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { fetchPlanState, type PlanState } from '@/lib/mocks';

const GUEST: PlanState = { signedIn: false, active: false, plan: 'free', expiresAt: null, loaded: true };
const LOADING: PlanState = { ...GUEST, loaded: false };

/** The signed-in user's plan, read from the API. Guests get the free plan. */
export function usePlan(): PlanState {
  const { data: session, status } = useSession();
  const [fetched, setFetched] = useState<PlanState | null>(null);
  const userKey = session?.user ? (session.user.id ?? session.user.email ?? 'user') : null;

  useEffect(() => {
    if (!userKey) return;
    let cancelled = false;
    fetchPlanState().then((s) => {
      if (!cancelled) setFetched(s);
    });
    return () => {
      cancelled = true;
    };
  }, [userKey]);

  if (status === 'loading') return LOADING;
  if (!userKey) return GUEST;
  return fetched ?? LOADING;
}
