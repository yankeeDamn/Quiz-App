'use client';

import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useSession, signOut } from 'next-auth/react';
import { Newspaper, Moon, Sun, Menu, LogIn, LogOut, User, Globe, IndianRupee } from 'lucide-react';
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

export function Header() {
  const { setTheme, theme } = useTheme();
  const { data: session, status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#2a2a2a] bg-[#0a0a0a]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0a0a0a]/80">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#B8941E] text-black">
            <Newspaper className="h-5 w-5" />
          </div>
          <span className="hidden font-bold text-xl sm:inline-block text-[#D4AF37]">
            NewsHub
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <Link
            href="/"
            className="text-sm font-medium text-[#a0a0a0] transition-colors hover:text-[#D4AF37]"
          >
            <Globe className="inline h-4 w-4 mr-1" />
            Latest News
          </Link>
          <Link
            href="/?region=IN"
            className="text-sm font-medium text-[#a0a0a0] transition-colors hover:text-[#D4AF37]"
          >
            <IndianRupee className="inline h-4 w-4 mr-1" />
            India
          </Link>
          <Link
            href="/?category=technology"
            className="text-sm font-medium text-[#a0a0a0] transition-colors hover:text-[#D4AF37]"
          >
            Technology
          </Link>
          <Link
            href="/sokal-bela"
            className="text-sm font-medium text-[#a0a0a0] transition-colors hover:text-[#D4AF37]"
          >
            Sokal Bela
          </Link>
        </nav>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-[#a0a0a0] hover:text-[#D4AF37] hover:bg-[#1a1a1a]">
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#141414] border-[#2a2a2a]">
              <DropdownMenuItem onClick={() => setTheme('light')} className="hover:bg-[#1a1a1a] focus:bg-[#1a1a1a]">
                Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')} className="hover:bg-[#1a1a1a] focus:bg-[#1a1a1a]">
                Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')} className="hover:bg-[#1a1a1a] focus:bg-[#1a1a1a]">
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
                    <Button variant="ghost" size="sm" className="hidden md:flex gap-2 text-[#a0a0a0] hover:text-[#D4AF37] hover:bg-[#1a1a1a]">
                      {session.user.image ? (
                        <img
                          src={session.user.image}
                          alt=""
                          className="h-6 w-6 rounded-full ring-1 ring-[#D4AF37]"
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
                  <DropdownMenuContent align="end" className="bg-[#141414] border-[#2a2a2a]">
                    <DropdownMenuItem disabled className="text-xs text-[#a0a0a0]">
                      {session.user.email || 'Guest account'}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => { clearTokenCache(); signOut({ callbackUrl: '/' }); }}
                      className="text-red-400 hover:bg-[#1a1a1a] focus:bg-[#1a1a1a]"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button variant="ghost" size="sm" asChild className="hidden md:flex text-[#D4AF37] hover:bg-[#1a1a1a]">
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
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="h-9 w-9 text-[#a0a0a0] hover:text-[#D4AF37]">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] sm:w-[350px] bg-[#0f0f0f] border-[#2a2a2a]">
              <nav className="flex flex-col gap-4 mt-8">
                <Link
                  href="/"
                  className="text-lg font-medium text-[#f5f5f0] transition-colors hover:text-[#D4AF37]"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Latest News
                </Link>
                <Link
                  href="/?region=IN"
                  className="text-lg font-medium text-[#f5f5f0] transition-colors hover:text-[#D4AF37]"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  India News
                </Link>
                <Link
                  href="/?category=technology"
                  className="text-lg font-medium text-[#f5f5f0] transition-colors hover:text-[#D4AF37]"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Technology
                </Link>
                <Link
                  href="/sokal-bela"
                  className="text-lg font-medium text-[#f5f5f0] transition-colors hover:text-[#D4AF37]"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sokal Bela
                </Link>
                <Separator className="my-2 bg-[#2a2a2a]" />
                {session?.user ? (
                  <>
                    <div className="flex items-center gap-3 py-2">
                      {session.user.image ? (
                        <img
                          src={session.user.image}
                          alt=""
                          className="h-8 w-8 rounded-full ring-1 ring-[#D4AF37]"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a1a1a] ring-1 ring-[#D4AF37]">
                          <User className="h-4 w-4 text-[#D4AF37]" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate text-[#f5f5f0]">{session.user.name}</p>
                        <p className="text-xs text-[#a0a0a0] truncate">
                          {session.user.email || 'Guest'}
                        </p>
                      </div>
                    </div>
                    <button
                      className="flex items-center gap-2 text-lg font-medium text-red-400 transition-colors hover:text-red-300"
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
                    className="flex items-center gap-2 text-lg font-medium text-[#D4AF37] transition-colors hover:text-[#F0D060]"
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
