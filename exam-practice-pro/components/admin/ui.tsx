'use client';

import type { ReactNode } from 'react';

export const input = 'min-h-10 w-full rounded-lg border bg-background px-3 py-2 text-sm';
export const card = 'rounded-xl border bg-card p-5';

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="grid gap-1 text-sm font-medium">
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
