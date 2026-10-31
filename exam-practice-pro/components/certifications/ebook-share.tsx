"use client";
import { useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { ebookLink, type EbookTrack } from "@/lib/ebooks";
export function EbookShare({
  book,
  chapter,
}: {
  book: Pick<EbookTrack, "slug" | "title" | "visibility">;
  chapter?: string;
}) {
  const [open, setOpen] = useState(false),
    [message, setMessage] = useState("");
  const [url, setUrl] = useState("");
  const text =
    book.visibility === "public"
      ? `Learn with ExamPro: ${book.title}`
      : "Request access to this ExamPro learning track";
  return (
    <div>
      <button
        type="button"
        disabled={book.visibility === "admin_only"}
        onClick={() => {
          setUrl(ebookLink(book.slug, chapter));
          setOpen(!open);
        }}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"
      >
        <Share2 className="h-4 w-4" />
        {chapter ? "Share chapter" : "Share Ebook"}
      </button>
      {open && (
        <div className="mt-2 space-y-2 rounded-xl border bg-background p-3">
          <p className="text-xs text-muted-foreground">
            {book.visibility === "public"
              ? "Share this learning link."
              : "Recipients must receive admin approval before reading."}
          </p>
          <button
            type="button"
            className="flex min-h-10 items-center gap-2 text-sm font-semibold"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setMessage("Link copied");
              } catch {
                setMessage("Copy the link below.");
              }
            }}
          >
            <Copy className="h-4 w-4" />
            Copy link
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(text + " " + url)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300"
          >
            Share on WhatsApp ↗
          </a>
          <input
            aria-label="Ebook sharing link"
            readOnly
            value={url}
            className="w-full rounded border bg-muted p-2 text-xs"
          />
          <p role="status" className="text-xs">
            {message}
          </p>
        </div>
      )}
    </div>
  );
}
