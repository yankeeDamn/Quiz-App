'use client';
import { useSyncExternalStore } from 'react';
const subscribe = () => () => {};
/** Stable SSR snapshot; browser-only state initializes after hydration. */
export function useClientReady() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
