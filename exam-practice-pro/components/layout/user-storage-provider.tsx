'use client';

import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import { useSession } from 'next-auth/react';

interface UserStorageContextType {
  /** Current storage key prefix for the user. Empty string for anonymous. */
  prefix: string;
  /** Whether the user storage context is ready */
  ready: boolean;
  /** User ID if signed in */
  userId: string | null;
}

const UserStorageContext = createContext<UserStorageContextType>({
  prefix: '',
  ready: false,
  userId: null,
});

export function useUserStorage() {
  return useContext(UserStorageContext);
}

/** Returns the current storage prefix from localStorage (set by provider) */
export function getStoragePrefix(): string {
  if (typeof window === 'undefined') return '';
  return window.__examPracticeStoragePrefix || '';
}

// Extend Window interface
declare global {
  interface Window {
    __examPracticeStoragePrefix: string;
  }
}

function subscribePrefix(listener:()=>void){
  window.addEventListener('exampro-storage-scope',listener);
  return()=>window.removeEventListener('exampro-storage-scope',listener);
}
export function UserStorageProvider({ children }: { children: React.ReactNode }) {
  const {data:session,status}=useSession();
  const identity=session?.user?.id||session?.user?.email;
  const prefix=identity?`u_${hashCode(identity)}_`:'';
  const storedPrefix=useSyncExternalStore(subscribePrefix,getStoragePrefix,()=>null);
  useEffect(()=>{
    if(status==='loading')return;
    window.__examPracticeStoragePrefix=prefix;
    window.dispatchEvent(new Event('exampro-storage-scope'));
  },[status,prefix]);
  const ready=status!=='loading'&&storedPrefix===prefix;
  return <UserStorageContext.Provider value={{prefix,ready,userId:session?.user?.id||null}}>{children}</UserStorageContext.Provider>;
}

function hashCode(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}
