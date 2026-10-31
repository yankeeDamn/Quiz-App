'use client';

import type { ReactNode } from 'react';

export const input = 'min-h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50';
export const card = 'min-w-0 rounded-2xl border border-border/80 bg-card p-5 shadow-sm shadow-slate-900/[0.03] sm:p-6';

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="grid min-w-0 gap-1.5 text-sm font-medium">
      {label}
      {children}
      {hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function Notice({ kind, children }: { kind: 'ok' | 'error'; children: ReactNode }) {
  return (
    <p
      role={kind === 'error' ? 'alert' : 'status'}
      className={`rounded-lg border px-3 py-2 text-sm ${kind === 'ok' ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' : 'border-red-600 bg-red-50 dark:bg-red-950/40'}`}
    >
      {children}
    </p>
  );
}

export const LETTERS = ['A', 'B', 'C', 'D'];
