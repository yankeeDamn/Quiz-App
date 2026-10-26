'use client';

import { MessageCircle } from 'lucide-react';
import { whatsappLink } from '@/lib/plans';

interface Props {
  text: string;
  label?: string;
  variant?: 'solid' | 'outline';
  className?: string;
  /** Another number (country code + digits) instead of the site number. */
  number?: string;
}

/** Opens WhatsApp with the message already written. */
export function WhatsAppButton({ text, label = 'Chat on WhatsApp', variant = 'solid', className = '', number }: Props) {
  const base =
    'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600';
  const look =
    variant === 'solid'
      ? 'bg-emerald-700 text-white hover:bg-emerald-800'
      : 'border border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40';
  return (
    <a
      href={whatsappLink(text, number)}
      target="_blank"
      rel="noopener noreferrer"
      className={`${base} ${look} ${className}`}
    >
      <MessageCircle className="h-4 w-4" aria-hidden="true" />
      {label}
    </a>
  );
}

/** Floating button shown on every page. */
export function FloatingWhatsApp() {
  return (
    <a
      href={whatsappLink('Hi, I have a question about Exam Practice Pro.')}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-4 right-4 z-40 inline-flex min-h-12 items-center gap-2 rounded-full bg-emerald-700 px-4 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
    >
      <MessageCircle className="h-5 w-5" aria-hidden="true" />
      <span className="hidden sm:inline">WhatsApp</span>
    </a>
  );
}
