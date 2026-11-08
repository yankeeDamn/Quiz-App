"use client";

import Link from "next/link";
import { CheckoutButton } from "@/components/payments/micro-passes";

export function EbookUpgradeGate({
  previewPages = 2,
  compact = false,
}: {
  previewPages?: number;
  compact?: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border border-indigo-300 bg-gradient-to-br from-indigo-50 to-white p-5 text-slate-900 shadow-sm dark:border-indigo-800 dark:from-indigo-950/50 dark:to-slate-950 dark:text-white ${compact ? "my-4" : "my-6"}`}
      role="region"
      aria-label="Unlock full ebook"
    >
      <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-300">
        Free preview complete
      </p>
      <h2 className="mt-2 text-xl font-bold">
        Continue reading with the IT ebook pass or Pro.
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        You can read the first {previewPages} PDF {previewPages === 1 ? "page" : "pages"} free.
        Full chapters, the complete PDF and the assessment unlock after server-verified access.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <CheckoutButton code="IT_EBOOK_PACK_99" />
        <Link
          href="/pricing"
          className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold"
        >
          Compare Pro plans
        </Link>
      </div>
    </section>
  );
}
