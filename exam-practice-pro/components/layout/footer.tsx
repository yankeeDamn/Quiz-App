import { Newspaper } from 'lucide-react';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-[#2a2a2a] bg-[#0a0a0a]">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          {/* Logo and Tagline */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#D4AF37] to-[#B8941E] text-black">
              <Newspaper className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-[#D4AF37]">NewsHub</span>
              <span className="text-xs text-[#a0a0a0]">
                Fresh news from around the world
              </span>
            </div>
          </div>

          {/* Links */}
          <nav className="flex items-center gap-6 text-sm text-[#a0a0a0]">
            <Link
              href="/"
              className="transition-colors hover:text-[#D4AF37]"
            >
              Latest
            </Link>
            <Link
              href="/?region=IN"
              className="transition-colors hover:text-[#D4AF37]"
            >
              India
            </Link>
            <Link
              href="/sokal-bela"
              className="transition-colors hover:text-[#D4AF37]"
            >
              Sokal Bela
            </Link>
          </nav>

          {/* Copyright */}
          <p className="text-sm text-[#a0a0a0]">
            © {new Date().getFullYear()} NewsHub
          </p>
        </div>
      </div>
    </footer>
  );
}
