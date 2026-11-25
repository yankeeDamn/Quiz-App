'use client';

import { useEffect, useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { INSTALL_AVAILABLE_EVENT } from '@/components/pwa/pwa-register';

type InstallPromptEvent = NonNullable<Window['__examproInstallPrompt']>;

export function PwaInstallBanner() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const check = () => setStandalone(window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    check();
    // PwaRegister captures beforeinstallprompt globally; read it on mount and on later changes.
    const sync = () => setPromptEvent(window.__examproInstallPrompt ?? null);
    const onInstalled = () => { setStandalone(true); setPromptEvent(null); };
    sync();
    window.addEventListener(INSTALL_AVAILABLE_EVENT, sync);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener(INSTALL_AVAILABLE_EVENT, sync);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (standalone) return <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">⚡ App Mode Active</span>;
  if (dismissed) return null;

  const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent) && !('MSStream' in window);
  const install = async () => {
    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') setPromptEvent(null);
    } else if (isIos) setIosHelp((value) => !value);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={install} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-semibold text-indigo-700 shadow-sm hover:bg-indigo-50 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-300">
        {isIos ? <Smartphone className="h-4 w-4" /> : <Download className="h-4 w-4" />} Install App
      </button>
      <button type="button" aria-label="Dismiss install suggestion" onClick={() => setDismissed(true)} className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
      {iosHelp && <p className="basis-full text-xs text-muted-foreground">In Safari, tap Share, then choose “Add to Home Screen”.</p>}
    </div>
  );
}
