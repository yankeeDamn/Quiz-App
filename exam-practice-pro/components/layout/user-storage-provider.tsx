'use client';

import { createContext, useContext, useEffect, useState } from 'react';
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

export function UserStorageProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [prefix, setPrefix] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;

    let newPrefix = '';
    if (session?.user?.id) {
      // Use a hash of the user ID for shorter localStorage keys
      newPrefix = `u_${hashCode(session.user.id)}_`;
    } else if (session?.user?.email) {
      newPrefix = `u_${hashCode(session.user.email)}_`;
    }
    // If no session, prefix stays empty (anonymous/backward-compatible)

    setPrefix(newPrefix);
    // Set on window for synchronous access in storage.ts
    if (typeof window !== 'undefined') {
      window.__examPracticeStoragePrefix = newPrefix;
    }
    setReady(true);
  }, [session, status]);

  return (
    <UserStorageContext.Provider
      value={{ prefix, ready, userId: session?.user?.id || null }}
    >
      {children}
    </UserStorageContext.Provider>
  );
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
