'use client';

import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useSession, signOut } from 'next-auth/react';
import { GraduationCap, Moon, Sun, LayoutDashboard, Menu, BookmarkCheck, LogIn, LogOut, User } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { useState } from 'react';
import { clearTokenCache } from '@/lib/api';
import { useExamLanguage } from '@/lib/exampro-language';

export function Header() {
  const { setTheme, theme } = useTheme();
  const { data: session, status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const {lang,setLang}=useExamLanguage();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/70 bg-background/90 shadow-sm shadow-slate-900/[0.025] backdrop-blur-xl supports-[backdrop-filter]:bg-background/75 dark:border-slate-800/70">
      <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-4">
        {/* Logo */}
        <Link href="/" className="ep-link-motion flex shrink-0 items-center gap-2 rounded-lg transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-500">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-teal-500 text-white shadow-md shadow-indigo-500/20">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="inline-block text-lg font-extrabold tracking-tight sm:text-xl">
            ExamPro
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden 2xl:flex items-center gap-4">
          <Link
            href="/"
            className="rounded-lg px-1 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:hover:text-indigo-300"
          >
            Quizzes
          </Link>
          <Link href="/certifications" className="rounded-lg px-1 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:hover:text-indigo-300">Certifications</Link>
          <Link
            href="/india-mocks"
            className="rounded-lg px-1 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:hover:text-indigo-300"
          >
            India Mocks
          </Link>
          <Link href="/exampro" className="rounded-lg px-1 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:hover:text-indigo-300">ExamPro Studio</Link>
          <Link
            href="/dashboard"
            className="rounded-lg px-1 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:hover:text-indigo-300"
          >
            Dashboard
          </Link>
          <Link
            href="/institutes" className="rounded-lg px-1 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:hover:text-indigo-300">Institutes</Link>
          <Link
            href="/bookmarks"
            className="rounded-lg px-1 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:hover:text-indigo-300"
          >
            Bookmarks
          </Link>
          <Link href="/admin" className="rounded-lg px-1 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:hover:text-indigo-300">Owner admin</Link>
          <Link
            href="/pricing"
            className="rounded-lg px-1 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:hover:text-indigo-300"
          >
            Pricing
          </Link>
        </nav>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="global-exam-language">Exam language</label>
          <select id="global-exam-language" aria-label="Exam language" value={lang}
            onChange={e=>setLang(e.target.value as 'en'|'hi'|'bn')}
            className="h-9 min-w-14 max-w-[72px] rounded-lg border border-border bg-background px-1 text-xs font-semibold">
            <option value="en">EN</option><option value="hi">हिं</option><option value="bn">বাং</option>
          </select>
          {/* Dashboard Button (Desktop) */}
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="hidden 2xl:flex"
          >
            <Link href="/dashboard">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </Button>

          {/* Theme Toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme('light')}>
                Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                System
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
                      {session.user.email || 'Guest account'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { clearTokenCache(); signOut({ callbackUrl: '/' }); }}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button variant="ghost" size="sm" asChild className="hidden 2xl:flex">
                  <Link href="/auth/signin">
                    <LogIn className="mr-2 h-4 w-4" />
                    Sign In
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
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(90vw,350px)] overflow-y-auto">
              <nav className="flex flex-col gap-4 mt-8">
                <Link
                  href="/"
                  className="text-lg font-medium transition-colors hover:text-indigo-600"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Quizzes
                </Link>
                <Link href="/exampro" className="text-lg font-medium transition-colors hover:text-indigo-600" onClick={() => setMobileMenuOpen(false)}>ExamPro Studio</Link>
                <Link href="/certifications" className="text-lg font-medium transition-colors hover:text-indigo-600" onClick={() => setMobileMenuOpen(false)}>Certifications</Link>
                <Link
                  href="/india-mocks"
                  className="text-lg font-medium transition-colors hover:text-indigo-600"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  India Mocks
                </Link>
                <Link
                  href="/dashboard"
                  className="text-lg font-medium transition-colors hover:text-indigo-600"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Dashboard
                </Link>
                <Link href="/institutes" className="text-lg font-medium transition-colors hover:text-indigo-600" onClick={() => setMobileMenuOpen(false)}>Institutes</Link>
                <Link
                  href="/bookmarks"
                  className="text-lg font-medium transition-colors hover:text-indigo-600"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Bookmarks
                </Link>
                <Link href="/admin" className="text-lg font-medium transition-colors hover:text-indigo-600" onClick={() => setMobileMenuOpen(false)}>Owner admin</Link>
                <Link
                  href="/pricing"
                  className="text-lg font-medium transition-colors hover:text-indigo-600"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Pricing
                </Link>
                <Separator className="my-2" />
                {session?.user ? (
                  <>
                    <div className="flex items-center gap-3 py-2">
                      {session.user.image ? (
                        <img
                          src={session.user.image}
                          alt=""
                          className="h-8 w-8 rounded-full"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900">
                          <User className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate">{session.user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {session.user.email || 'Guest'}
                        </p>
                      </div>
                    </div>
                    <button
                      className="flex items-center gap-2 text-lg font-medium text-red-600 transition-colors hover:text-red-700"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        clearTokenCache();
                        signOut({ callbackUrl: '/' });
                      }}
                    >
                      <LogOut className="h-5 w-5" />
                      Sign Out
                    </button>
                  </>
                ) : (
                  <Link
                    href="/auth/signin"
                    className="flex items-center gap-2 text-lg font-medium transition-colors hover:text-indigo-600"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <LogIn className="h-5 w-5" />
                    Sign In
                  </Link>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
