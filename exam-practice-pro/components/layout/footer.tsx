import { GraduationCap } from 'lucide-react';
import Link from 'next/link';
import { formatWhatsappNumber, whatsappLink } from '@/lib/plans';

export function Footer() {
  return (
    <footer className="border-t border-slate-200/70 bg-gradient-to-b from-muted/20 to-indigo-50/40 dark:border-slate-800 dark:to-slate-900/40">
      <div className="container mx-auto px-4 py-10">
        <div className="flex flex-col items-center justify-between gap-6 text-center lg:flex-row lg:text-left">
          {/* Logo and Tagline */}
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-teal-500 text-white shadow-sm">
              <GraduationCap className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold">ExamPro</span>
              <span className="text-xs text-muted-foreground">
                Practice smarter. Score higher.
              </span>
            </div>
          </div>

          {/* Links */}
          <nav className="flex max-w-3xl flex-wrap items-center justify-center gap-x-5 gap-y-3 text-sm text-muted-foreground">
            <Link
              href="/"
              className="transition-colors hover:text-foreground"
            >
              Quizzes
            </Link>
            <Link href="/certifications" className="transition-colors hover:text-foreground">Certifications</Link>
            
            <Link
              href="/dashboard"
              className="transition-colors hover:text-foreground"
            >
              Dashboard
            </Link>
            <Link
              href="/india-mocks"
              className="transition-colors hover:text-foreground"
            >
              India Mocks
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="transition-colors hover:text-foreground">Terms</Link>
            <Link href="/refunds" className="transition-colors hover:text-foreground">Refunds</Link>
            <Link href="/contact" className="transition-colors hover:text-foreground">Contact</Link>
            <Link
              href="/pricing"
              className="transition-colors hover:text-foreground"
            >
              Pricing
            </Link>
            <a
              href={whatsappLink('Hi, I have a question about ExamPro.')}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              WhatsApp {formatWhatsappNumber()}
            </a>
          </nav>

          {/* Copyright */}
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} ExamPro
          </p>
        </div>
      </div>
    </footer>
  );
}
