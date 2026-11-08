"use client";
import { useEffect, useRef, useState } from "react";
import { EbookUpgradeGate } from "./ebook-upgrade-gate";
import { EbookMonetizationControls, type EbookAccessPatch } from "./ebook-monetization-controls";
import { CheckCircle2, CloudUpload, FileLock2, FileText, LoaderCircle, RefreshCw } from "lucide-react";
import { ebookFieldClass } from "./ebook-admin-ui";
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
        <button className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-indigo-700 shadow-sm hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-950 dark:text-indigo-300" onClick={()=>setRefresh(n=>n+1)}><RefreshCw className="h-4 w-4"/> Already paid? Check access</button>
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
          className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 hover:-translate-y-0.5 hover:from-indigo-700 hover:to-violet-700"
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
  onAccessCommit,
  accessBusy,
  owner,
  onUploaded,
}: {
  book: EbookTrack;
  onChange: (patch: Partial<EbookTrack>) => void;
  onAccessCommit: (patch: EbookAccessPatch) => void;
  accessBusy: boolean;
  owner: boolean;
  onUploaded: (book: EbookTrack) => void;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file?: File) => {
    if (!file || !book.revision || busy || accessBusy) return;
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 text-white shadow-lg sm:p-7">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-indigo-200">
            <FileLock2 className="h-4 w-4" /> Secure publishing
          </p>
          <h3 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">PDF Manager</h3>
          <p className="mt-2 text-sm leading-6 text-indigo-100/90">
            Upload a protected edition and deliver only permitted preview pages.
            Reader access is verified on the server for every file request.
          </p>
        </div>
        <div className="grid min-w-[160px] gap-2 rounded-xl border border-white/15 bg-white/10 p-4 text-sm">
          <span className="text-indigo-100">Edition status</span>
          <strong className="flex items-center gap-2">
            {book.fullPdfStorageKey ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <FileText className="h-4 w-4" />}
            {book.fullPdfStorageKey ? "Protected PDF ready" : "No private PDF"}
          </strong>
          <span className="text-xs text-indigo-200">
            {book.fullPdfStorageKey ? "Preview generated" : "Upload an edition below"}
          </span>
        </div>
      </div>

      <EbookMonetizationControls
        book={book}
        owner={owner}
        busy={accessBusy || busy}
        onCommit={onAccessCommit}
      />

      <section className="grid gap-6 rounded-2xl border border-slate-200 bg-card p-5 shadow-sm lg:grid-cols-[minmax(0,1fr)_280px] sm:p-6">
        <div className="space-y-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Edition details</p>
            <h4 className="mt-1 text-lg font-bold">Printable reference</h4>
            <p className="mt-1 text-sm text-muted-foreground">Changes to these details are saved with the Save changes action.</p>
          </div>
      <label className="grid gap-2 text-sm font-semibold">
        Edition version
        <input
          className={ebookFieldClass}
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
            className={ebookFieldClass}
          />
          <span className="text-xs font-normal text-muted-foreground">
            External URLs are allowed only for fully free public ebooks. Pro or restricted ebooks must use protected upload.
          </span>
        </label>
      )}

      <div
        role="button"
        tabIndex={book.revision && !busy && !accessBusy ? 0 : -1}
        aria-disabled={!book.revision || busy || accessBusy}
        className={`rounded-3xl border-2 border-dashed p-10 text-center shadow-inner transition-all ${dragging ? "scale-[1.01] border-indigo-500 bg-indigo-50 shadow-indigo-500/10 dark:bg-indigo-950/30" : "border-slate-300 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-900/50"} ${!book.revision || busy || accessBusy ? "cursor-not-allowed opacity-55" : "cursor-pointer hover:-translate-y-0.5 hover:border-indigo-400 hover:bg-indigo-50/60 hover:shadow-lg dark:hover:bg-indigo-950/20"}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (book.revision && !busy && !accessBusy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void upload(event.dataTransfer.files?.[0]);
        }}
        onClick={() => book.revision && !busy && !accessBusy && fileRef.current?.click()}
        onKeyDown={(event) => {
          if ((event.key === "Enter" || event.key === " ") && book.revision && !busy && !accessBusy) {
            event.preventDefault();
            fileRef.current?.click();
          }
        }}
      >
        <CloudUpload className="mx-auto mb-3 h-10 w-10 text-indigo-600" />
        <p className="font-semibold">
          {busy ? <span className="inline-flex items-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" />Uploading and generating preview…</span> : "Drop a PDF here or click to browse"}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Maximum 3 MiB. Save the ebook first. Uploading replaces the protected full PDF and preview atomically.
        </p>
        <input
          ref={fileRef}
          className="sr-only"
          type="file"
          accept="application/pdf,.pdf"
          disabled={!book.revision || busy || accessBusy}
          onChange={(event) => void upload(event.target.files?.[0])}
        />
      </div>

      {book.pdfUrl && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
          <p className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Attached protected PDF</p>
          <p className="mt-1 break-all text-xs text-muted-foreground">
            {book.pdfFileName || "ebook.pdf"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Full storage key: {book.fullPdfStorageKey ? "protected backend asset" : "not persisted yet"} · Preview: {book.previewPdfStorageKey ? "generated" : "pending"}
          </p>
          <button
            type="button"
            className="mt-3 min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm hover:-translate-y-0.5 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
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

      {message && <p role="status" className="rounded-xl border bg-muted/20 p-3 text-sm">{message}</p>}

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
        </div>
        <aside className="flex flex-col gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-5 text-sm dark:border-indigo-900 dark:bg-indigo-950/20">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-700 dark:text-indigo-300">How publishing works</p>
          <div className="space-y-4">
            <p><strong className="block">1. Save an ebook</strong><span className="text-muted-foreground">Create the ebook record before uploading a PDF.</span></p>
            <p><strong className="block">2. Set access</strong><span className="text-muted-foreground">Free/Pro and download controls save immediately for existing ebooks.</span></p>
            <p><strong className="block">3. Upload privately</strong><span className="text-muted-foreground">The backend creates a separate PDF preview using only the allowed pages.</span></p>
            <p><strong className="block">4. Verify readers</strong><span className="text-muted-foreground">Check free and entitled sessions before publishing.</span></p>
          </div>
        </aside>
      </section>
    </div>
  );
}