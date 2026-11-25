'use client';

import { useEffect } from 'react';

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }> };
declare global {
  interface Window { __examproInstallPrompt?: InstallPromptEvent | null }
}

export const INSTALL_AVAILABLE_EVENT = 'exampro-install-available';

export function PwaRegister() {
  useEffect(() => {
    // The browser fires beforeinstallprompt once, early. Keep it globally so an install
    // control that mounts later (for example inside the mobile menu) can still use it.
    const onPrompt = (event: Event) => {
      event.preventDefault();
      window.__examproInstallPrompt = event as InstallPromptEvent;
      window.dispatchEvent(new Event(INSTALL_AVAILABLE_EVENT));
    };
    const onInstalled = () => { window.__examproInstallPrompt = null; window.dispatchEvent(new Event(INSTALL_AVAILABLE_EVENT)); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // PWA enhancement must never prevent the learning app from working.
      });
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  return null;
}
