'use client';

import { useEffect, useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { INSTALL_AVAILABLE_EVENT } from '@/components/pwa/pwa-register';

type InstallPromptEvent = NonNullable<Window['__examproInstallPrompt']>;

export function PwaInstallBanner() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  // Browser-only facts are read after mount so the first client render matches the server HTML
  // (reading navigator.userAgent while rendering caused React hydration error #418 on iPhone).
  const [isIos, setIsIos] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const check = () => setStandalone(window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    check();
    const detectIos = () => setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent) && !('MSStream' in window));
    detectIos();
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

  const install = async () => {
    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') setPromptEvent(null);
    } else if (isIos) setIosHelp((value) => !value);
  };

  return (
    <div className="relative flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-border bg-card/80 p-1">
      <button type="button" onClick={install} className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-accent-ink shadow-sm hover:bg-accent-soft dark:bg-surface-2">
        {isIos ? <Smartphone className="h-4 w-4" /> : <Download className="h-4 w-4" />} Install App
      </button>
      <button type="button" aria-label="Dismiss install suggestion" onClick={() => setDismissed(true)} className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
      {iosHelp && <p className="basis-full text-xs text-muted-foreground">In Safari, tap Share, then choose “Add to Home Screen”.</p>}
    </div>
  );
}
