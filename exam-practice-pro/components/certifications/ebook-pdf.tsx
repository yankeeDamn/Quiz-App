"use client";
import { useEffect, useRef, useState } from "react";
import { API_BASE_URL, getBackendToken } from "@/lib/api";
import { type EbookTrack } from "@/lib/ebooks";
import { HighlightedCode, LessonMarkdown } from "./lesson-content";
export async function pdfRequest(
  slug: string,
  options?: { file: File; revision: number },
) {
  const token = await getBackendToken();
  const url = options
    ? `${API_BASE_URL}/api/v1/admin/ebooks/${slug}/pdf?filename=${encodeURIComponent(options.file.name)}&revision=${options.revision}`
    : `${API_BASE_URL}/api/v1/ebooks/${slug}/pdf`;
  const response = await fetch(url, {
    method: options ? "POST" : "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options ? { "Content-Type": "application/pdf" } : {}),
    },
    body: options?.file,
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    const data = await response.json();
    throw Error(data.error?.message || "PDF request failed.");
  }
  return response;
}
export function AttachedPdf({ book }: { book: EbookTrack }) {
  return (
    <PdfViewer
      key={`${book.slug}:${book.revision}:${book.pdfUrl}`}
      book={book}
    />
  );
}
function PdfViewer({ book }: { book: EbookTrack }) {
  const [url, setUrl] = useState(
      book.pdfUrl?.startsWith("https://") ? book.pdfUrl : "",
    ),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true,
      objectUrl = "";
    if (!book.pdfUrl || book.pdfUrl.startsWith("https://")) return;
    void pdfRequest(book.slug)
      .then((response) => response.blob())
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((error) => {
        if (active) setError(error.message);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [book.slug, book.pdfUrl, book.revision]);
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">PDF Ebook Viewer</h2>
      {error && <p role="alert">{error}</p>}
      {url ? (
        <>
          <iframe
            title={`${book.title} PDF`}
            src={url}
            className="h-[75dvh] w-full rounded-xl border"
            referrerPolicy="no-referrer"
          />
          {book.allowPdfDownload !== false && (
            <a
              href={url}
              download={book.pdfFileName || `${book.slug}.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-xl border px-4 py-3 text-sm font-semibold"
            >
              Download attached PDF ↗
            </a>
          )}
          <p className="text-xs text-muted-foreground">
            If your browser cannot embed this PDF, use the download/open link. A
            readable PDF can still be saved by browser tools; the download
            setting is a UI preference, not DRM.
          </p>
        </>
      ) : (
        !error && <p role="status">Loading authorized PDF…</p>
      )}
    </section>
  );
}
export function EbookPrintView({
  book,
  cheatsheet = false,
  autoPrint = false,
}: {
  book: EbookTrack;
  cheatsheet?: boolean;
  autoPrint?: boolean;
}) {
  const printed = useRef(false);
  useEffect(() => {
    if (!autoPrint || printed.current) return;
    let active = true;
    void document.fonts.ready.then(() => {
      if (active && !printed.current) {
        printed.current = true;
        requestAnimationFrame(() => window.print());
      }
    });
    return () => {
      active = false;
    };
  }, [autoPrint]);
  const parts = cheatsheet
    ? [book.chapters.slice(0, 3), book.chapters.slice(3)]
    : [book.chapters];
  return (
    <div className={`ebook-print ${cheatsheet ? "ebook-cheatsheet" : ""}`}>
      <div className="ebook-print-tools mb-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white"
        >
          Print / Save as PDF
        </button>
        <a
          href={`/certifications/learn/${book.slug}`}
          className="rounded-xl border px-4 py-3 text-sm"
        >
          Back to interactive tutorial
        </a>
      </div>
      <header className="mb-8 border-b pb-6">
        <p className="text-xs font-bold uppercase tracking-widest">
          ExamPro · Build Your IT Career
        </p>
        <h1 className="mt-3 text-3xl font-bold">
          {book.title}
          {cheatsheet ? " — Quick Reference" : ""}
        </h1>
        <p className="mt-3 text-sm">{book.subtitle}</p>
        <p className="mt-2 text-xs">
          Version {book.version || "1.0"} ·{" "}
          {book.examBadgeCode || book.category} · Original study material
        </p>
      </header>
      {!cheatsheet && (
        <section className="mb-8">
          <h2 className="text-xl font-bold">Contents</h2>
          <ol className="mt-3 list-inside list-decimal">
            {book.chapters.map((c) => (
              <li key={c.id}>{c.title}</li>
            ))}
          </ol>
        </section>
      )}
      {parts.map((part, pi) => (
        <div key={pi} className={cheatsheet ? "cheat-page" : ""}>
          {part.map((chapter, index) => (
            <section key={chapter.id} className="print-chapter">
              <h2 className="mb-4 text-2xl font-bold">
                {cheatsheet ? "" : `${index + 1}. `}
                {chapter.title}
              </h2>
              {!cheatsheet && (
                <>
                  <LessonMarkdown content={chapter.contentMarkdown} />
                  {chapter.codeSnippet && (
                    <div className="my-5 rounded-xl border">
                      <HighlightedCode code={chapter.codeSnippet.code} />
                      <pre className="whitespace-pre-wrap border-t p-4 text-xs">
                        Expected output: {chapter.codeSnippet.expectedOutput}
                      </pre>
                    </div>
                  )}
                </>
              )}
              <table className="my-4 w-full border-collapse text-left text-sm">
                <thead>
                  <tr>
                    <th className="border p-2">
                      Key takeaway / interview reference
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {chapter.keyTakeaways.map((tip, i) => (
                    <tr key={i}>
                      <td className="border p-2">{tip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {cheatsheet &&
                chapter.contentMarkdown.includes(
                  "## Quick Reference Cheatcode Table",
                ) && (
                  <LessonMarkdown
                    content={
                      chapter.contentMarkdown
                        .split("## Quick Reference Cheatcode Table")[1]
                        .split("\n\n> ")[0]
                    }
                  />
                )}
              {cheatsheet &&
                !chapter.contentMarkdown.includes(
                  "## Quick Reference Cheatcode Table",
                ) &&
                chapter.codeSnippet && (
                  <pre className="whitespace-pre-wrap rounded border p-3 text-[9px]">
                    {chapter.codeSnippet.code}
                  </pre>
                )}
            </section>
          ))}
        </div>
      ))}
      <footer className="mt-8 border-t pt-4 text-xs">
        ExamPro original study material. Vendor names and trademarks belong to
        their respective owners. Not an official or accredited certification
        guide.
      </footer>
    </div>
  );
}
export function PdfSettings({
  book,
  onChange,
  onUploaded,
}: {
  book: EbookTrack;
  onChange: (patch: Partial<EbookTrack>) => void;
  onUploaded: (book: EbookTrack) => void;
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section className="space-y-5 rounded-2xl border p-5">
      <h3 className="text-xl font-bold">PDF & printable references</h3>
      <label className="grid gap-2 text-sm font-semibold">
        Edition version
        <input
          className="rounded-xl border bg-background p-3"
          maxLength={40}
          value={book.version || "1.0"}
          onChange={(e) => onChange({ version: e.target.value })}
        />
      </label>
      <label className="flex gap-3 text-sm">
        <input
          type="checkbox"
          checked={book.allowPdfDownload !== false}
          onChange={(e) => onChange({ allowPdfDownload: e.target.checked })}
        />
        Show learner PDF/print buttons
      </label>
      <label className="flex gap-3 text-sm">
        <input
          type="checkbox"
          checked={!!book.isCheatSheet}
          onChange={(e) => onChange({ isCheatSheet: e.target.checked })}
        />
        Enable compact cheat-sheet view
      </label>
      <label className="grid gap-2 text-sm font-semibold">
        Hosted public PDF URL
        <input
          type="url"
          disabled={book.visibility !== "public"}
          value={book.pdfUrl?.startsWith("https://") ? book.pdfUrl : ""}
          onChange={(e) => onChange({ pdfUrl: e.target.value })}
          placeholder="https://your-host.example/guide.pdf"
          className="rounded-xl border bg-background p-3"
        />
      </label>
      <p className="text-xs text-muted-foreground">
        Hosted links are for public books. For private/invite tracks, upload
        below so every retrieval checks access. Save URL and download
        preferences using Save ebook.
      </p>
      <label className="grid gap-2 text-sm font-semibold">
        Upload PDF (maximum 3 MiB; save the ebook first)
        <input
          type="file"
          accept="application/pdf,.pdf"
          disabled={!book.revision || busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file || !book.revision) return;
            if (file.size > 3 * 1024 * 1024) {
              setMessage("Maximum upload size is 3 MiB.");
              return;
            }
            setBusy(true);
            try {
              const response = await pdfRequest(book.slug, {
                file,
                revision: book.revision,
              });
              const data = await response.json();
              onUploaded(data.data.ebook);
              setMessage(
                "PDF stored securely. Other form edits are preserved; save the ebook to persist them.",
              );
            } catch (error) {
              setMessage(
                error instanceof Error ? error.message : "Upload failed.",
              );
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {book.pdfUrl && (
        <div className="flex flex-wrap items-center gap-4">
          <span className="break-all text-xs">
            Attached: {book.pdfFileName || book.pdfUrl}
          </span>
          <button
            type="button"
            className="min-h-10 rounded-lg border px-3 text-sm"
            onClick={() => onChange({ pdfUrl: "", pdfFileName: "" })}
          >
            Detach on next save
          </button>
        </div>
      )}
      <p role="status" className="text-sm">
        {busy ? "Uploading…" : message}
      </p>
      <p className="text-xs text-muted-foreground">
        Uploading replaces the saved attachment immediately and advances the
        ebook revision. Downloads cannot prevent readers from saving readable
        content.
      </p>
      {book.revision && (
        <a
          className="inline-block rounded-xl border px-4 py-3 text-sm font-semibold"
          href={`/certifications/learn/${book.slug}?view=pdf`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Preview printable ebook ↗
        </a>
      )}
    </section>
  );
}
