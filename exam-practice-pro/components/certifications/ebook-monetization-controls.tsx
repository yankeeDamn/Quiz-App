"use client";

import { useState } from "react";
import { Check, Crown, FileText, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import type { EbookTrack } from "@/lib/ebooks";
import { ebookFieldClass } from "./ebook-admin-ui";

export type EbookAccessPatch = Partial<
  Pick<EbookTrack, "studyProOnly" | "accessLevel" | "freePreviewPages" | "allowFullPdfDownload">
>;

export function EbookMonetizationControls({
  book, owner, busy, onCommit, compact = false,
}: {
  book: EbookTrack;
  owner: boolean;
  busy: boolean;
  onCommit: (patch: EbookAccessPatch) => void;
  compact?: boolean;
}) {
  const [pages, setPages] = useState(book.freePreviewPages ?? 2);
  const scope = `${book.slug}:${book.revision}:${book.freePreviewPages}`;
  const [previousScope, setPreviousScope] = useState(scope);
  if (previousScope !== scope) {
    setPreviousScope(scope);
    setPages(book.freePreviewPages ?? 2);
  }

  const locked = busy || !owner;
  const bundled = book.isBundledPublicEdition === true;
  const commitPages = () => {
    const value = Math.max(1, Math.min(20, Math.round(Number(pages) || 2)));
    setPages(value);
    if (value !== (book.freePreviewPages ?? 2)) onCommit({ freePreviewPages: value });
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm dark:border-border dark:bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-gradient-to-r from-surface-1 via-white to-white px-5 py-4 dark:border-border dark:from-surface-1/50 dark:via-surface-2 dark:to-surface-2">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold tracking-tight">Monetization & PDF access</h3>
            <p className="text-xs text-muted-foreground">
              {book.revision ? "Changes to access settings save to the server immediately." : "Choose settings; create the ebook to persist them."}
            </p>
          </div>
        </div>
        <span aria-live="polite" className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${busy ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" : book.revision ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-surface-2 text-foreground dark:bg-surface-2 dark:text-foreground"}`}>
          {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin"/> : book.revision ? <Check className="h-3.5 w-3.5"/> : <FileText className="h-3.5 w-3.5"/>}
          {busy ? "Saving access…" : book.revision ? "Server-backed settings" : "Unsaved new ebook"}
        </span>
      </div>
      <div className={`grid gap-6 p-5 ${compact ? "xl:grid-cols-3" : "lg:grid-cols-3"}`}>
        <fieldset className="min-w-0 space-y-3" disabled={locked || bundled}>
          <legend className="mb-2 text-sm font-bold">Reader access</legend>
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={book.studyProOnly === true} disabled={locked || bundled || !!book.revision} onChange={event => onCommit({studyProOnly:event.target.checked, ...(event.target.checked ? {accessLevel:"pro" as const}: {})})}/>Study Plans: Pro subscribers only (choose before creating)</label>
          <div className="flex rounded-xl border border-border bg-surface-2 p-1 dark:border-border dark:bg-surface-2">
            {(["free", "pro"] as const).map((level) => (
              <button
                key={level}
                type="button"
                aria-pressed={book.accessLevel === level}
                disabled={locked || bundled || book.studyProOnly === true}
                onClick={() => level !== book.accessLevel && onCommit({ accessLevel: level })}
                className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 ${book.accessLevel === level ? "bg-card text-accent-ink shadow-md ring-1 ring-ring dark:bg-primary dark:text-primary-foreground dark:ring-ring" : "text-muted-foreground hover:-translate-y-0.5 hover:bg-white hover:text-foreground hover:shadow-sm dark:text-muted-foreground dark:hover:bg-surface-2 dark:hover:text-foreground"}`}
              >
                {level === "free" ? <FileText className="h-4 w-4"/> : <Crown className="h-4 w-4"/>}
                {level === "free" ? "Free" : "Pro"}
              </button>
            ))}
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            {bundled
              ? "Bundled public editions must remain Free."
              : book.accessLevel === "pro"
                ? "Full content requires a verified ebook pass or Pro subscription."
                : "Readers can access the complete ebook without payment."}
          </p>
        </fieldset>

        <div className={`space-y-3 ${book.accessLevel === "free" ? "opacity-60" : ""}`}>
          <label htmlFor="ebook-preview-pages" className="block text-sm font-bold">
            Free PDF preview
          </label>
          <div className="relative max-w-xs">
            <input
              id="ebook-preview-pages"
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              step={1}
              value={pages}
              disabled={locked || book.accessLevel === "free"}
              onChange={(event) => setPages(Number(event.target.value))}
              onBlur={commitPages}
              onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
              className={`${ebookFieldClass} pr-20 font-semibold`}
            />
            <span className="pointer-events-none absolute right-4 top-3 text-xs text-muted-foreground">pages</span>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            {book.accessLevel === "free"
              ? "Full ebook is accessible for free."
              : "Only these PDF pages are delivered to visitors without access. Changing this regenerates the protected preview."}
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-bold">Full PDF download</p>
          <button
            type="button"
            role="switch"
            aria-checked={book.allowFullPdfDownload}
            aria-label="Allow authorized readers to download the full PDF"
            disabled={locked}
            onClick={() => onCommit({ allowFullPdfDownload: !book.allowFullPdfDownload })}
            className="group inline-flex min-h-11 items-center gap-3 rounded-2xl border border-border bg-card px-4 font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:border-border hover:bg-accent-soft hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-border dark:bg-background dark:hover:bg-accent-soft/30"
          >
            <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${book.allowFullPdfDownload ? "bg-primary" : "bg-background dark:bg-background"}`}>
              <span className={`h-4.5 w-4.5 rounded-full bg-card shadow-sm transition-transform ${book.allowFullPdfDownload ? "translate-x-6" : "translate-x-1"}`} />
            </span>
            <span className="text-sm font-semibold">{book.allowFullPdfDownload ? "Allowed" : "Blocked"}</span>
            <LockKeyhole className="h-4 w-4 text-muted-foreground" />
          </button>
          <p className="text-xs leading-5 text-muted-foreground">
            This controls direct downloads. Reading still uses server-side entitlement checks.
          </p>
        </div>
      </div>
    </section>
  );
}
