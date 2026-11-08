"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const ebookFieldClass =
  "min-h-12 w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-950 shadow-sm outline-none transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 disabled:opacity-70 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:border-slate-600 dark:disabled:bg-slate-900";

export const ebookSelectClass =
  ebookFieldClass +
  " appearance-none bg-[linear-gradient(45deg,transparent_50%,#64748b_50%),linear-gradient(135deg,#64748b_50%,transparent_50%)] bg-[length:5px_5px,5px_5px] bg-[position:calc(100%-20px)_calc(50%-2px),calc(100%-15px)_calc(50%-2px)] bg-no-repeat pr-12";

export const ebookTextareaClass =
  "w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium leading-6 text-slate-950 shadow-sm outline-none transition-all placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:border-slate-600";

export const ebookCardClass =
  "rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.04] dark:border-slate-800 dark:bg-slate-950";

export const ebookSubtleCardClass =
  "rounded-2xl border border-slate-200 bg-slate-50/70 shadow-sm dark:border-slate-800 dark:bg-slate-900/60";

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
      <span className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
        {label}
        {required && (
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            Required
          </span>
        )}
      </span>
      {children}
      {hint && (
        <span className="text-xs leading-5 text-slate-500 dark:text-slate-400">
          {hint}
        </span>
      )}
    </label>
  );
}

type ActionVariant = "primary" | "secondary" | "soft" | "danger" | "ghost";

const actionStyles: Record<ActionVariant, string> = {
  primary:
    "border border-indigo-600 bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/20 hover:-translate-y-0.5 hover:from-indigo-700 hover:to-violet-700 hover:shadow-xl hover:shadow-indigo-600/25",
  secondary:
    "border border-slate-200 bg-white text-slate-800 shadow-sm hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-200",
  soft:
    "border border-indigo-100 bg-indigo-50 text-indigo-700 shadow-sm hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-100 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:bg-indigo-950/70",
  danger:
    "border border-rose-600 bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-lg shadow-rose-600/15 hover:-translate-y-0.5 hover:from-rose-700 hover:to-red-700",
  ghost:
    "border border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
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
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-50",
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
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
    warning:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
    pro:
      "border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-200",
    info:
      "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-200",
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
