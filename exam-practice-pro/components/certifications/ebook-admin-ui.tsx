"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const ebookFieldClass =
  "min-h-12 w-full min-w-0 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-sm outline-none transition-all placeholder:text-muted-foreground hover:border-border focus:border-accent-ink focus:ring-4 focus:ring-ring/10 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted-foreground disabled:opacity-70 dark:border-border dark:bg-background dark:text-foreground dark:hover:border-border dark:disabled:bg-surface-2";

export const ebookSelectClass =
  ebookFieldClass +
  " appearance-none bg-[linear-gradient(45deg,transparent_50%,#64748b_50%),linear-gradient(135deg,#64748b_50%,transparent_50%)] bg-[length:5px_5px,5px_5px] bg-[position:calc(100%-20px)_calc(50%-2px),calc(100%-15px)_calc(50%-2px)] bg-no-repeat pr-12";

export const ebookTextareaClass =
  "w-full min-w-0 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium leading-6 text-foreground shadow-sm outline-none transition-all placeholder:text-muted-foreground hover:border-border focus:border-accent-ink focus:ring-4 focus:ring-ring/10 disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-70 dark:border-border dark:bg-background dark:text-foreground dark:hover:border-border";

export const ebookCardClass =
  "rounded-3xl border border-border bg-card shadow-sm shadow-transparent/[0.04] dark:border-border dark:bg-background";

export const ebookSubtleCardClass =
  "rounded-2xl border border-border bg-background/70 shadow-sm dark:border-border dark:bg-surface-2/60";

export function EbookField({
  label,
  hint,
  children,
  required = false,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="grid min-w-0 gap-2">
      <span className="flex items-center gap-2 text-sm font-bold text-foreground dark:text-foreground">
        {label}
        {required && (
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            Required
          </span>
        )}
      </span>
      {children}
      {hint && (
        <span className="text-xs leading-5 text-muted-foreground dark:text-muted-foreground">
          {hint}
        </span>
      )}
    </label>
  );
}

type ActionVariant = "primary" | "secondary" | "soft" | "danger" | "ghost";

const actionStyles: Record<ActionVariant, string> = {
  primary:
    "border border-accent-ink bg-gradient-to-r from-surface-1 to-surface-2 text-foreground shadow-lg shadow-transparent/20 hover:-translate-y-0.5 hover:from-surface-1 hover:to-surface-2 hover:shadow-xl hover:shadow-transparent/25",
  secondary:
    "border border-border bg-card text-foreground shadow-sm hover:-translate-y-0.5 hover:border-border hover:bg-accent-soft hover:text-accent-ink dark:border-border dark:bg-background dark:text-foreground dark:hover:border-border dark:hover:bg-accent-soft/40 dark:hover:text-accent-ink",
  soft:
    "border border-border bg-accent-soft text-accent-ink shadow-sm hover:-translate-y-0.5 hover:border-border hover:bg-accent-soft dark:border-border dark:bg-accent-soft/40 dark:text-accent-ink dark:hover:bg-accent-soft/70",
  danger:
    "border border-rose-600 bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-lg shadow-rose-600/15 hover:-translate-y-0.5 hover:from-rose-700 hover:to-red-700",
  ghost:
    "border border-transparent bg-transparent text-muted-foreground hover:bg-surface-2 hover:text-foreground dark:text-muted-foreground dark:hover:bg-surface-2 dark:hover:text-foreground",
};

export function EbookActionButton({
  variant = "secondary",
  busy = false,
  icon,
  children,
  className,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ActionVariant;
  busy?: boolean;
  icon?: ReactNode;
}) {
  return (
    <button
      type={props.type || "button"}
      disabled={disabled || busy}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20 disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-50",
        actionStyles[variant],
        className,
      )}
      {...props}
    >
      {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function EbookStatusChip({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "warning" | "pro" | "info";
  children: ReactNode;
}) {
  const tones = {
    neutral:
      "border-border bg-surface-2 text-foreground dark:border-border dark:bg-surface-2 dark:text-foreground",
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
    warning:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
    pro:
      "border-border bg-accent-soft text-accent-ink dark:border-border dark:bg-accent-soft/50 dark:text-accent-ink",
    info:
      "border-border bg-accent-soft text-accent-ink dark:border-border dark:bg-accent-soft/50 dark:text-accent-ink",
  };
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
