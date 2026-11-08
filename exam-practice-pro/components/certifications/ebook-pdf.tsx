"use client";
import { useEffect, useRef, useState } from "react";
import { EbookUpgradeGate } from "./ebook-upgrade-gate";
import { useSession } from "next-auth/react";
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
  const {data:session} = useSession();
  const [url,setUrl]=useState("");
  const [preview,setPreview]=useState(false);
  const [error,setError]=useState("");
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    let active=true, objectUrl="", busy=false;
    let currentPreview: boolean | null=null;
    const controller=new AbortController();
    const load=async(poll=false)=>{
      if(busy || document.visibilityState==='hidden')return;
      busy=true;
      try {
        // External links are permitted only for unprotected public books.
        if(book.pdfUrl?.startsWith('https://')) {setUrl(book.pdfUrl);return;}
        const response=await fetch(`/api/ebooks/${book.slug}/pdf`,{cache:'no-store',signal:controller.signal});
        if(!response.ok)throw Error('Unable to load PDF. Check your access or retry.');
        const nextPreview=response.headers.get('X-Ebook-Preview')==='true';
        if(poll && objectUrl && currentPreview===nextPreview){await response.body?.cancel();return;}
        const blob=await response.blob();
        if(!active)return;
        const next=URL.createObjectURL(blob);
        if(objectUrl)URL.revokeObjectURL(objectUrl);
        objectUrl=next;currentPreview=nextPreview;setUrl(next);setPreview(nextPreview);setError('');
      } catch(e) {if(active){setUrl('');setError(e instanceof Error?e.message:'PDF unavailable');}}
      finally {busy=false;}
    };
    void load();
    const focus=()=>void load();
    window.addEventListener('focus',focus);
    document.addEventListener('visibilitychange',focus);
    // Recheck server entitlement while a preview is open, including delayed webhooks.
    const timer=window.setInterval(()=>{if(preview)void load(true);},15000);
    return ()=>{active=false;controller.abort();clearInterval(timer);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[book.slug,book.pdfUrl,book.revision,session?.user?.email,refresh,preview]);
  return <section className="space-y-4">
    <h2 className="text-xl font-bold">{preview?'Free PDF preview':'PDF Ebook Viewer'}</h2>
    {error&&<p role="alert">{error}</p>}
    {url?<>
      <iframe title={`${book.title} PDF`} src={url} className="h-[75dvh] w-full rounded-xl border" referrerPolicy="no-referrer"/>
      {preview&&<>
        <EbookUpgradeGate previewPages={book.freePreviewPages ?? 2}/>
        <button className="block w-full text-sm underline" onClick={()=>setRefresh(n=>n+1)}>Already paid? Check access</button>
      </>}
      {book.allowFullPdfDownload&& !preview && <a className="inline-block rounded-xl border px-4 py-3" href={book.pdfUrl?.startsWith('https://')?book.pdfUrl:`/api/ebooks/${book.slug}/download`}>Download PDF</a>}
    </>:!error&&<p role="status">Loading authorized PDF…</p>}
  </section>;
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
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file?: File) => {
    if (!file || !book.revision || busy) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setMessage("Choose a PDF file.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setMessage("Maximum upload size is 3 MiB.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/admin/ebooks/${encodeURIComponent(book.slug)}/upload-pdf`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/pdf",
            "X-Ebook-Filename": file.name,
            "X-Ebook-Revision": String(book.revision),
          },
          body: file,
          cache: "no-store",
          signal: AbortSignal.timeout(30000),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          payload?.error?.message || "PDF upload failed.",
        );
      }
      const saved = payload?.data?.ebook as EbookTrack | undefined;
      if (!saved) throw new Error("PDF service returned an invalid response.");
      onUploaded(saved);
      setMessage(
        `PDF stored privately. A separate ${saved.freePreviewPages ?? 2}-page preview was generated on the server.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "PDF upload failed.");
    } finally {
      setBusy(false);
      setDragging(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <section className="space-y-5 rounded-2xl border p-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-300">
          Protected document storage
        </p>
        <h3 className="mt-1 text-xl font-bold">PDF Manager</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Full PDFs are stored only in protected backend storage. Pro readers without an entitlement receive a physically separate preview file, never the full PDF hidden in the browser.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <label className="grid gap-2 text-sm font-semibold">
          Access level
          <select
            className="rounded-xl border bg-background p-3"
            value={book.accessLevel}
            disabled={book.isBundledPublicEdition}
            onChange={(event) =>
              onChange({ accessLevel: event.target.value as "free" | "pro" })
            }
          >
            <option value="free">Free</option>
            <option value="pro">Pro</option>
          </select>
        </label>

        <label className={`grid gap-2 text-sm font-semibold ${book.accessLevel === "free" ? "opacity-55" : ""}`}>
          Free preview pages
          <input
            className="rounded-xl border bg-background p-3"
            type="number"
            min={1}
            max={20}
            disabled={book.accessLevel === "free"}
            value={book.freePreviewPages ?? 2}
            onChange={(event) =>
              onChange({
                freePreviewPages: Math.min(
                  20,
                  Math.max(1, Number(event.target.value) || 2),
                ),
              })
            }
          />
          <span className="text-xs font-normal text-muted-foreground">
            {book.accessLevel === "free"
              ? "Full ebook is accessible for free."
              : "Changing this value regenerates the protected preview on Save ebook."}
          </span>
        </label>

        <div>
          <p className="mb-2 text-sm font-semibold">Allow Full PDF Download</p>
          <button
            type="button"
            role="switch"
            aria-checked={book.allowFullPdfDownload}
            onClick={() =>
              onChange({
                allowFullPdfDownload: !book.allowFullPdfDownload,
                allowPdfDownload: !book.allowFullPdfDownload,
              })
            }
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${book.allowFullPdfDownload ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-700"}`}
          >
            <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${book.allowFullPdfDownload ? "translate-x-6" : "translate-x-1"}`} />
            <span className="sr-only">
              {book.allowFullPdfDownload ? "Disable" : "Enable"} full PDF download
            </span>
          </button>
        </div>
      </div>

      {book.isBundledPublicEdition && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
          This is a bundled public edition. Its access level is explicitly Free and cannot be converted to Pro.
        </p>
      )}

      <label className="grid gap-2 text-sm font-semibold">
        Edition version
        <input
          className="rounded-xl border bg-background p-3"
          maxLength={40}
          value={book.version || "1.0"}
          onChange={(event) => onChange({ version: event.target.value })}
        />
      </label>

      <label className="flex gap-3 text-sm">
        <input
          type="checkbox"
          checked={!!book.isCheatSheet}
          onChange={(event) => onChange({ isCheatSheet: event.target.checked })}
        />
        Enable compact cheat-sheet view
      </label>

      {book.accessLevel === "free" && book.visibility === "public" && (
        <label className="grid gap-2 text-sm font-semibold">
          Optional public hosted PDF URL
          <input
            type="url"
            value={book.pdfUrl?.startsWith("https://") ? book.pdfUrl : ""}
            onChange={(event) => onChange({ pdfUrl: event.target.value })}
            placeholder="https://your-host.example/guide.pdf"
            className="rounded-xl border bg-background p-3"
          />
          <span className="text-xs font-normal text-muted-foreground">
            External URLs are allowed only for fully free public ebooks. Pro or restricted ebooks must use protected upload.
          </span>
        </label>
      )}

      <div
        role="button"
        tabIndex={book.revision && !busy ? 0 : -1}
        aria-disabled={!book.revision || busy}
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${dragging ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30" : "border-slate-300 dark:border-slate-700"} ${!book.revision || busy ? "cursor-not-allowed opacity-55" : "cursor-pointer hover:border-indigo-400"}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (book.revision && !busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void upload(event.dataTransfer.files?.[0]);
        }}
        onClick={() => book.revision && !busy && fileRef.current?.click()}
        onKeyDown={(event) => {
          if ((event.key === "Enter" || event.key === " ") && book.revision && !busy) {
            event.preventDefault();
            fileRef.current?.click();
          }
        }}
      >
        <p className="font-semibold">
          {busy ? "Uploading and generating preview…" : "Drag & drop a PDF here, or click to choose"}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Maximum 3 MiB. Save the ebook first. Uploading replaces the protected full PDF and preview atomically.
        </p>
        <input
          ref={fileRef}
          className="sr-only"
          type="file"
          accept="application/pdf,.pdf"
          disabled={!book.revision || busy}
          onChange={(event) => void upload(event.target.files?.[0])}
        />
      </div>

      {book.pdfUrl && (
        <div className="rounded-xl border bg-muted/20 p-4">
          <p className="text-sm font-semibold">Attached protected PDF</p>
          <p className="mt-1 break-all text-xs text-muted-foreground">
            {book.pdfFileName || "ebook.pdf"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Full storage key: {book.fullPdfStorageKey ? "protected backend asset" : "not persisted yet"} · Preview: {book.previewPdfStorageKey ? "generated" : "pending"}
          </p>
          <button
            type="button"
            className="mt-3 min-h-10 rounded-lg border px-3 text-sm"
            onClick={() =>
              onChange({
                pdfUrl: "",
                pdfFileName: "",
                fullPdfStorageKey: null,
                previewPdfStorageKey: null,
              })
            }
          >
            Detach on next save
          </button>
        </div>
      )}

      <p role="status" className="text-sm">{message}</p>

      {book.revision && (
        <a
          className="inline-block rounded-xl border px-4 py-3 text-sm font-semibold"
          href={`/certifications/learn/${book.slug}?view=pdf`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Preview authorized reader view ↗
        </a>
      )}
    </section>
  );
}
