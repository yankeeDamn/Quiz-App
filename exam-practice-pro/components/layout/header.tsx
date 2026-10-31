'use client';

import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useSession, signOut } from 'next-auth/react';
import { GraduationCap, Moon, Sun, LayoutDashboard, Menu, LogIn, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useState } from 'react';
import { clearTokenCache } from '@/lib/api';
import { LanguageSwitcher, useExamLanguage } from '@/components/exampro/exam-language';

export function Header() {
  const { setTheme, theme } = useTheme();
  const { data: session, status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { language, t } = useExamLanguage();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/70 bg-background/90 shadow-sm shadow-slate-900/[0.025] backdrop-blur-xl supports-[backdrop-filter]:bg-background/75 dark:border-slate-800/70">
      <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-4">
        {/* Logo */}
        <Link href="/" className="ep-link-motion flex shrink-0 items-center gap-2 rounded-lg transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-500">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-teal-500 text-white shadow-md shadow-indigo-500/20">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="hidden text-xl font-extrabold tracking-tight sm:inline-block">
            ExamPro
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav lang={language} aria-label="Primary navigation" className="hidden 2xl:flex items-center gap-4">
          <Link
            href="/"
            className="rounded-lg px-1 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:hover:text-indigo-300"
          lang={language}>
            {t('quizzes')}
          </Link>
          <Link href="/government-jobs" className="rounded-lg px-1 py-2 text-sm font-semibold text-indigo-700 transition-colors hover:text-indigo-900 dark:text-indigo-300">Govt Jobs</Link>
          <Link href="/certifications" className="rounded-lg px-1 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:hover:text-indigo-300"> {t('certifications')}</Link>
          <Link
            href="/india-mocks"
            className="rounded-lg px-1 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:hover:text-indigo-300"
          >
            {t('indiaMocks')}
          </Link>
          <Link href="/exampro" className="rounded-lg px-1 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:hover:text-indigo-300">{t('examHall')}</Link>
          <Link
            href="/dashboard"
            className="rounded-lg px-1 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:hover:text-indigo-300"
          >
            {t('dashboard')}
          </Link>
          <Link
            href="/institutes" className="rounded-lg px-1 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:hover:text-indigo-300">{t('institutes')}</Link>
          <Link
            href="/bookmarks"
            className="rounded-lg px-1 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:hover:text-indigo-300"
          >
            {t('bookmarks')}
          </Link>

          <Link
            href="/pricing"
            className="rounded-lg px-1 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:hover:text-indigo-300"
          >
            {t('pricing')}
          </Link>
        </nav>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2">
          {/* Dashboard Button (Desktop) */}
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="hidden 2xl:flex"
          >
            <Link href="/dashboard">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              {t('dashboard')}
            </Link>
          </Button>

          {/* Language selection persists across ExamPro and the exam hall. */}
          <LanguageSwitcher small />

          {/* Theme Toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">{t('toggleTheme')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme('light')}>
                {t('light')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                {t('dark')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                {t('system')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Auth */}
          {status !== 'loading' && (
            <>
              {session?.user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="hidden 2xl:flex gap-2">
                      {session.user.image ? (
                        <img
                          src={session.user.image}
                          alt=""
                          className="h-6 w-6 rounded-full"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <User className="h-4 w-4" />
                      )}
                      <span className="max-w-[100px] truncate text-sm">
                        {session.user.name || 'User'}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                      {session.user.email || t('guest')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { clearTokenCache(); signOut({ callbackUrl: '/' }); }}>
                      <LogOut className="mr-2 h-4 w-4" />
                      {t('signOut')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button variant="ghost" size="sm" asChild className="hidden 2xl:flex">
                  <Link href="/auth/signin">
                    <LogIn className="mr-2 h-4 w-4" />
                    {t('signIn')}
                  </Link>
                </Button>
              )}
            </>
          )}

          {/* Mobile Menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="2xl:hidden">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="h-5 w-5" />
                <span className="sr-only">{t('openMenu')}</span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[min(88vw,22rem)] max-w-none gap-0 overflow-y-auto border-l border-border bg-background px-0 pb-6 pt-14 text-foreground shadow-2xl"
            >
              <div className="border-b border-border/70 px-5 pb-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-300">{t('explore')}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t('learningSpace')}</p>
              </div>
              <nav lang={language} aria-label="Mobile navigation" className="grid gap-1 px-3 py-3">
                {([
                  ['/', 'quizzes'],
                  ['/exampro', 'examHall'],
                  ['/certifications', 'certifications'],
                  ['/government-jobs', 'govtJobs'] as const,
                  ['/india-mocks', 'indiaMocks'],
                  ['/dashboard', 'dashboard'],
                  ['/institutes', 'institutes'],
                  ['/bookmarks', 'bookmarks'],
                  ['/pricing', 'pricing'],
                ] as const).map(([href, label]) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium leading-5 text-foreground transition-colors hover:bg-muted hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 dark:hover:text-indigo-300 sm:text-base"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {label==='govtJobs'?'Govt Jobs':t(label)}
                  </Link>
                ))}
              </nav>
              <div className="border-t border-border/70 px-5 pt-4">
                {status === 'loading' ? (
                  <p className="text-sm text-muted-foreground" role="status">{t('checking')}</p>
                ) : session?.user ? (
                  <div className="grid gap-3">
                    <div className="flex min-w-0 items-center gap-3 rounded-lg bg-muted/40 p-2">
                      {session.user.image ? (
                        <img
                          src={session.user.image}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-full"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950">
                          <User className="h-4 w-4" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{session.user.name || t('signedIn')}</p>
                        <p className="truncate text-xs text-muted-foreground">{session.user.email || t('guest')}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        clearTokenCache();
                        void signOut({ callbackUrl: '/' });
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                      {t('signOut')}
                    </button>
                  </div>
                ) : (
                  <Link
                    href="/auth/signin"
                    className="inline-flex min-h-11 w-full items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <LogIn className="h-4 w-4" />
                    {t('signIn')}
                  </Link>
                )}
              </div>
              {/* Owner administration stays at /admin and is protected by Render.
                  Do not display a public admin link without a verified owner role. */}
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
