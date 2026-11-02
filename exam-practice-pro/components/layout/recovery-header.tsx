'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GraduationCap, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  LanguageSwitcher,
  useExamLanguage,
} from '@/components/exampro/exam-language';
/** Also works when the root layout's auth/theme providers have failed. */
export function RecoveryHeader() {
  const { t } = useExamLanguage();
  const [dark, setDark] = useState(false);
  useEffect(() => {
    let preference = 'system';
    try {
      preference = localStorage.getItem('theme') || 'system';
    } catch {
      /* browser storage disabled */
    }
    const next =
      preference === 'dark' ||
      (preference === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', next);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recover the persisted theme without a provider
    setDark(next);
  }, []);
  return (
    <header className="border-b border-border bg-background/90">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex items-center gap-2 font-extrabold">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-teal-500 text-white">
            <GraduationCap className="h-5 w-5" />
          </span>
          ExamPro
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher small />
          <Button
            size="icon"
            variant="ghost"
            aria-label={t('toggleTheme')}
            onClick={() => {
              const next = !dark;
              setDark(next);
              document.documentElement.classList.toggle('dark', next);
              try {
                localStorage.setItem('theme', next ? 'dark' : 'light');
              } catch {
                /* optional preference */
              }
            }}
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
