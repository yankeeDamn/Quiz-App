/* eslint-disable react-hooks/set-state-in-effect -- initialize account-scoped browser storage and refresh externally loaded data */
"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, BookOpen, Check, ChevronDown, ClipboardList, FileText, LayoutDashboard, LibraryBig, LoaderCircle, Plus, Save, ShieldCheck, Trash2, Users, X } from "lucide-react";
import { parseBulk } from "@/lib/admin";
import {
  EBOOK_CATEGORIES,
  ebookApi,
  ebookAdminApi,
  loadDraft,
  saveDraft,
  type EbookTrack,
  type EbookSummary,
  type EbookChapter,
  type EbookAccessRequest,
} from "@/lib/ebooks";
import {
  EbookInventory,
  EbookExamSettings,
  EbookBackup,
} from "./ebook-command-panels";
import { PdfSettings } from "./ebook-pdf";
import { EbookMonetizationControls, type EbookAccessPatch } from "./ebook-monetization-controls";
import { LessonMarkdown, CodeExample } from "./lesson-content";
import { Field, input } from "@/components/admin/ui";
const emptyQuestion = () => ({
  question: "",
  options: ["", "", "", ""],
  answer: 0,
  explanation: "",
});
const emptyChapter = (): EbookChapter => ({
  id: `chapter-${crypto.randomUUID().slice(0, 8)}`,
  order: 0,
  title: "New chapter",
  summary: "",
  durationMinutes: 20,
  contentMarkdown: "## Learning goals\n\nWrite your lesson here.",
  keyTakeaways: ["Add the main takeaway"],
  conceptChecks: [emptyQuestion(), emptyQuestion()],
});
const newBook = (): EbookTrack => ({
  id: null,
  slug: "",
  title: "",
  subtitle: "",
  category: "Python",
  level: "Beginner to Pro",
  visibility: "admin_only",
  accessLevel: "free",
  freePreviewPages: 2,
  allowFullPdfDownload: false,
  allowPdfDownload: false,
  fullPdfStorageKey: null,
  previewPdfStorageKey: null,
  isBundledPublicEdition: false,
  chapters: [],
  examId: "",
  examMinutes: 20,
  finalExamQuestions: [],
  updatedAt: "",
});
const slugify = (value:string) =>
  value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s-]/g,"")
    .trim().replace(/\s+/g,"-").replace(/-+/g,"-").slice(0,60);
const toBulk = (book: EbookTrack) =>
  book.draftBulk ??
  (book.finalExamQuestions || [])
    .map((q) =>
      [q.question, ...q.options, "ABCD"[q.answer], q.explanation].join(" | "),
    )
    .join("\n");
export function EbookStudio({
  identity,
  owner,
  summaries,
  initialBook,
  initialChapterId,
  onClose,
  onSaved,
}: {
  identity: string;
  owner: boolean;
  summaries: EbookSummary[];
  initialBook?: EbookTrack;
  initialChapterId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [book, setBook] = useState<EbookTrack | null>(initialBook || null),
    [selected, setSelected] = useState(initialBook?.slug || ""),
    [chapterIndex, setChapterIndex] = useState(() =>
      Math.max(
        0,
        initialBook?.chapters.findIndex((c) => c.id === initialChapterId) || 0,
      ),
    ),
    [bulk, setBulkValue] = useState(initialBook ? toBulk(initialBook) : ""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState(initialBook ? "content" : "inventory");
  const [inventoryVersion, setInventoryVersion] = useState(0);
  const [bulkDirty, setBulkDirty] = useState(false);
  const [adminBooks,setAdminBooks]=useState<EbookSummary[]>(summaries);
  const [toast,setToast]=useState<{kind:"ok"|"error";text:string}|null>(null);
  const [archiveOpen,setArchiveOpen]=useState(false);
  const [accessBusy,setAccessBusy]=useState(false);
  const [dirty,setDirty]=useState(false);
  const proGatedCount=adminBooks.filter((item)=>item.accessLevel==="pro"&&!item.isBundledPublicEdition).length;
  const setBulk = (value: string) => {
    setBulkValue(value);
    setBulkDirty(false);
  };
  const markdownRef = useRef<HTMLTextAreaElement>(null);
  const [requests, setRequests] = useState<EbookAccessRequest[]>([]),
    [grantEmail, setGrantEmail] = useState(""),
    [restore, setRestore] = useState<EbookTrack | null>(null);
  useEffect(() => {
    dialog.current?.showModal();
    setRestore(loadDraft(identity));
    if (!initialBook && owner) setBook(newBook());
  }, [identity, owner, initialBook]);
  const notify=(text:string,kind:"ok"|"error"="ok")=>{setMessage(text);setToast({text,kind});};
  useEffect(()=>{if(!toast)return;const id=window.setTimeout(()=>setToast(null),4500);return()=>window.clearTimeout(id);},[toast]);
  const refreshAdminBooks=async()=>{
    if(!owner)return;
    const result=await ebookAdminApi<{ebooks:EbookSummary[]}>("");
    if(result.data)setAdminBooks(result.data.ebooks);
    else notify(result.error?.message||"Could not load ebook inventory.","error");
  };
  useEffect(()=>{void refreshAdminBooks();},[owner,inventoryVersion]);
  const loadRequests = async () => {
    const result = await ebookApi<{ requests: EbookAccessRequest[] }>(
      "/admin/ebooks/requests",
    );
    if (result.data) setRequests(result.data.requests);
    else setMessage(result.error?.message || "Could not load access requests.");
  };
  useEffect(() => {
    if (owner) void loadRequests();
  }, [owner]);
  const load = async (slug: string) => {
    if (busy || accessBusy) return false;
    if (dirty && !window.confirm(
      "You have unsaved changes. Switch ebooks and discard them? You can save a local draft first.",
    )) return false;
    setMessage("");
    if (!slug) {
      setBook(newBook());
      setSelected("");
      setChapterIndex(0);
      setBulk("");
      setDirty(false);
      return true;
    }
    setBusy(true);
    const result = await ebookAdminApi<{ ebook: EbookTrack }>(
      `/${encodeURIComponent(slug)}`,
    );
    setBusy(false);
    if (result.data) {
      const loaded = {
        ...result.data.ebook,
        id: result.data.ebook.id || result.data.ebook.slug,
        accessLevel: result.data.ebook.accessLevel || "free",
        freePreviewPages: result.data.ebook.freePreviewPages || 2,
        allowFullPdfDownload:
          result.data.ebook.allowFullPdfDownload ??
          result.data.ebook.allowPdfDownload ??
          false,
        fullPdfStorageKey: result.data.ebook.fullPdfStorageKey || null,
        previewPdfStorageKey: result.data.ebook.previewPdfStorageKey || null,
        isBundledPublicEdition:
          result.data.ebook.isBundledPublicEdition === true,
      };
      setBook(loaded);
      setSelected(slug);
      setChapterIndex(0);
      setBulk(toBulk(loaded));
      setDirty(false);
      return true;
    }
    notify(result.error?.message || "Could not open ebook.", "error");
    return false;
  };
  const change = (patch: Partial<EbookTrack>) => {
    setDirty(true);
    setBook((old) => (old ? { ...old, ...patch } : old));
  };
  const commitAccess = async (patch: EbookAccessPatch) => {
    if (!book || accessBusy || busy || !owner) return;
    if (book.isBundledPublicEdition && patch.accessLevel === "pro") {
      notify("Bundled public editions must remain Free.", "error");
      return;
    }
    const before = {
      accessLevel: book.accessLevel,
      freePreviewPages: book.freePreviewPages,
      allowFullPdfDownload: book.allowFullPdfDownload,
    };
    const next = { ...patch, ...(patch.allowFullPdfDownload === undefined
      ? {} : { allowPdfDownload: patch.allowFullPdfDownload }) };
    if (!book.revision) {
      change(next);
      return;
    }
    setAccessBusy(true);
    setBook((old) => old ? { ...old, ...next } : old);
    const result = await ebookAdminApi<{ ebook: EbookTrack }>(
      `/${encodeURIComponent(book.slug)}/access`,
      { method: "PATCH", body: { revision: book.revision, ...patch } },
    );
    setAccessBusy(false);
    if (!result.data) {
      setBook((old) => old && old.slug === book.slug
        ? { ...old, ...before, allowPdfDownload: before.allowFullPdfDownload } : old);
      notify(result.error?.message || "Unable to save ebook access.", "error");
      return;
    }
    const updated = result.data.ebook;
    setBook((old) => old && old.slug === updated.slug ? {
      ...old,
      accessLevel: updated.accessLevel,
      freePreviewPages: updated.freePreviewPages,
      allowFullPdfDownload: updated.allowFullPdfDownload,
      allowPdfDownload: updated.allowFullPdfDownload,
      revision: updated.revision,
      updatedAt: updated.updatedAt,
    } : old);
    setInventoryVersion((v) => v + 1);
    notify("Access settings saved. Readers see the new rule immediately.");
    onSaved();
  };
  const commitVisibility = async (visibility: EbookTrack["visibility"]) => {
    if (!book || !owner || busy || accessBusy || visibility === book.visibility) return;
    if (book.isBundledPublicEdition && visibility !== "public") {
      notify("Bundled public editions must remain public.", "error");
      return;
    }
    if (visibility === "public" &&
        !window.confirm("Publish this ebook to learners? Only reviewed, complete content should be made public.")) return;
    if (!book.revision) {
      change({ visibility });
      return;
    }
    const before = book.visibility;
    setAccessBusy(true);
    setBook((old) => old ? { ...old, visibility } : old);
    const result = await ebookAdminApi<{ ebook: EbookTrack }>(
      `/${encodeURIComponent(book.slug)}/visibility`,
      { method: "PATCH", body: { revision: book.revision, visibility } },
    );
    setAccessBusy(false);
    if (!result.data) {
      setBook((old) => old && old.slug === book.slug
        ? { ...old, visibility: before } : old);
      notify(result.error?.message || "Unable to change publication visibility.", "error");
      return;
    }
    const updated = result.data.ebook;
    setBook((old) => old && old.slug === updated.slug ? {
      ...old, visibility: updated.visibility,
      revision: updated.revision, updatedAt: updated.updatedAt,
    } : old);
    setInventoryVersion((v) => v + 1);
    notify("Publication visibility updated successfully.");
    onSaved();
  };
  const chapter = book?.chapters[chapterIndex];
  const changeChapter = (patch: Partial<EbookChapter>) =>
    book &&
    change({
      chapters: book.chapters.map((value, index) =>
        index === chapterIndex ? { ...value, ...patch } : value,
      ),
    });
  const move = (direction: number) => {
    if (!book) return;
    const next = chapterIndex + direction;
    if (next < 0 || next >= book.chapters.length) return;
    const chapters = [...book.chapters];
    [chapters[chapterIndex], chapters[next]] = [
      chapters[next],
      chapters[chapterIndex],
    ];
    change({ chapters: chapters.map((value, order) => ({ ...value, order })) });
    setChapterIndex(next);
  };
  const draft = () => {
    if (!book) return;
    const parsed = parseBulk(bulk);
    const copy = {
      ...book,
      draftBulk: bulkDirty ? bulk : undefined,
      finalExamQuestions: bulkDirty
        ? parsed.rows.map((q, index) => ({
            ...q,
            id: `${book.slug}-q${index + 1}`,
            domain:
              book.finalExamQuestions?.[index]?.question === q.question
                ? book.finalExamQuestions[index].domain
                : undefined,
          }))
        : book.finalExamQuestions,
    };
    const saved = saveDraft(identity, copy);
    notify(
      saved
        ? `Local draft saved at ${new Date().toLocaleTimeString()}. It is not published or synced.`
        : "Local storage is unavailable; keep this window open and copy your work.",
      saved ? "ok" : "error",
    );
  };
  const handleSaveEbook = async () => {
    if (!book || busy || accessBusy) return;
    const parsed = parseBulk(bulk);
    if (bulkDirty && parsed.errors.length) {
      notify(parsed.errors.join(" "), "error");
      return;
    }
    if (!book.title.trim() || book.title.trim().length < 3) {
      notify("Add an ebook title of at least 3 characters.", "error");
      return;
    }
    if (!/^[a-z0-9][a-z0-9-]{1,59}$/.test(book.slug)) {
      notify("Use a lowercase kebab-case slug of 2–60 characters.", "error");
      return;
    }
    if (
      book.visibility !== "admin_only" &&
      (!book.chapters.length || !(book.finalExamQuestions?.length))
    ) {
      notify(
        "Public and invite-only ebooks need at least one chapter and one assessment question. Keep an incomplete ebook private.",
        "error",
      );
      return;
    }
    if (
      book.visibility === "public" &&
      owner &&
      !window.confirm("Save this ebook as public? Anyone can read its permitted content.")
    )
      return;

    setBusy(true);
    setMessage("");
    const payload = {
      ...book,
      allowPdfDownload: book.allowFullPdfDownload,
      finalExamQuestions: bulkDirty
        ? parsed.rows.map((q, index) => ({
            ...q,
            id: `${book.slug}-q${index + 1}`,
            domain:
              book.finalExamQuestions?.[index]?.question === q.question
                ? book.finalExamQuestions[index].domain
                : undefined,
          }))
        : book.finalExamQuestions || [],
    };
    const exists = Boolean(book.id || book.revision);
    const result = await ebookAdminApi<{ ebook: EbookTrack }>(
      exists ? `/${encodeURIComponent(book.slug)}` : "",
      { method: exists ? "PUT" : "POST", body: payload },
    );
    setBusy(false);
    if (result.data) {
      const saved = {
        ...result.data.ebook,
        id: result.data.ebook.id || result.data.ebook.slug,
      };
      setBook(saved);
      setSelected(saved.slug);
      setBulk(toBulk(saved));
      setBulkDirty(false);
      setDirty(false);
      setInventoryVersion((v) => v + 1);
      notify(exists ? "Ebook updated successfully." : "New ebook created successfully.");
      onSaved();
      return;
    }
    notify(
      result.error?.message ||
        "Save failed. Use Save local draft to preserve edits.",
      "error",
    );
  };
  const startNew = () => {
    if (!owner || busy || accessBusy) return;
    if (dirty && !window.confirm("Discard unsaved changes and start a new ebook?")) return;
    setBook(newBook());
    setSelected("");
    setChapterIndex(0);
    setBulk("");
    setBulkDirty(false);
    setDirty(false);
    setTab("content");
    notify("New ebook ready. Save it as a private draft before attaching a PDF.");
  };
  const closeStudio = () => {
    if (dirty && !window.confirm("Close without saving these edits? You can save a local draft first.")) return;
    onClose();
  };
  const approve = async (
    slug: string,
    email: string,
    role: "reader" | "editor",
    status: "approved" | "revoked",
  ) => {
    setBusy(true);
    const result = await ebookApi(`/admin/ebooks/${slug}/approve-access`, {
      method: "POST",
      body: { email, role, status },
    });
    setBusy(false);
    setMessage(
      result.success
        ? "Access updated."
        : result.error?.message || "Could not update access.",
    );
    if (result.success) void loadRequests();
  };
  return (
    <dialog
      ref={dialog}
      aria-label="Manage and publish ebooks"
      onCancel={(event) => {
        event.preventDefault();
        closeStudio();
      }}
      onClose={onClose}
      className="m-auto max-h-[94dvh] w-[min(98vw,104rem)] overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50 p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/70 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
    >
      <header className="sticky top-0 z-30 border-b border-white/10 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 px-5 py-5 text-white shadow-lg sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="hidden h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white/10 sm:grid">
              <BookOpen className="h-6 w-6 text-indigo-200"/>
            </div>
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-indigo-200">
                ExamPro / Content operations
              </p>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
                Manage & Publish Ebooks
              </h2>
              <p className="mt-1 text-xs leading-5 text-indigo-100/80">
                One workspace for learning content, editions, assessments and reader access.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-indigo-100 sm:inline-flex">
              {adminBooks.length} ebooks · {proGatedCount} Pro
            </span>
            <button
              type="button"
              aria-label="Close ebook studio"
              onClick={closeStudio}
              className="grid h-11 w-11 place-items-center rounded-xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>
      <div className="space-y-6 p-4 sm:p-7">
        <nav
          aria-label="Ebook command center"
          className="flex gap-1.5 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          {([
            ["inventory", "Library overview"],
            ["content", "Chapter Studio"],
            ["pdf", "PDF Manager"],
            ["exam", "Exam Builder"],
            ...(owner ? [["access", `Access (${proGatedCount})`]] : []),
          ] as string[][]).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
              className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold transition-all sm:text-sm ${tab === id ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"}`}
            >
              {id === "inventory" ? <LayoutDashboard className="h-4 w-4"/> :
                id === "content" ? <LibraryBig className="h-4 w-4"/> :
                id === "pdf" ? <FileText className="h-4 w-4"/> :
                id === "exam" ? <ClipboardList className="h-4 w-4"/> :
                <Users className="h-4 w-4"/>}
              {label}
            </button>
          ))}
        </nav>

        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <label htmlFor="ebook-studio-picker" className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Active ebook · switch workspace
            </label>
            <div className="relative max-w-xl">
              <select
                id="ebook-studio-picker"
                className="min-h-12 w-full appearance-none rounded-xl border border-slate-200 bg-background px-4 pr-10 text-sm font-semibold shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 disabled:opacity-50 dark:border-slate-700"
                value={selected}
                disabled={busy || accessBusy}
                onChange={(event) => void load(event.target.value)}
              >
                <option value="">{owner ? "New unsaved ebook" : "Choose an ebook"}</option>
                {adminBooks.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.title} · {item.accessLevel === "pro" ? "Pro" : "Free"} · {item.visibility}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-4 h-4 w-4 text-slate-400"/>
            </div>
            <p className="text-xs text-muted-foreground">
              {book?.revision
                ? `Saved revision ${book.revision} · ${book.visibility.replaceAll("_", " ")} · ${book.accessLevel === "pro" ? "Pro entitlement" : "Free access"}`
                : "Create a new ebook, then save it privately before publishing."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {dirty && <span className="rounded-full bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">Unsaved content edits</span>}
            {owner && (
              <button type="button" disabled={busy || accessBusy}
                onClick={startNew}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-sm font-bold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">
                <Plus className="h-4 w-4"/> New ebook
              </button>
            )}
            {book && tab !== "inventory" && (
              <button type="button" disabled={busy || accessBusy}
                onClick={() => void handleSaveEbook()}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white shadow-md shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:opacity-50">
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>}
                {busy ? "Saving…" : book.revision ? "Save changes" : "Create ebook"}
              </button>
            )}
          </div>
        </div>
        {tab === "inventory" && (
          <>
            <EbookInventory
              owner={owner}
              pending={requests.filter((r) => r.status === "pending").length}
              version={inventoryVersion}
              onMessage={setMessage}
              onRefresh={() => {
                setInventoryVersion((v) => v + 1);
                onSaved();
              }}
              onSelect={(slug, next) => {
                void load(slug).then((loaded) => {
                  if (loaded) setTab(next);
                });
              }}
              onClone={(source) => {
                setBook({
                  ...source,
                  slug: `${source.slug.slice(0, 40)}-copy-${crypto.randomUUID().slice(0, 6)}`,
                  title: source.title + " (copy)",
                  visibility: "admin_only",
                  id: null,
                  revision: undefined,
                  accessLevel: source.isBundledPublicEdition ? "free" : source.accessLevel,
                  allowFullPdfDownload: false,
                  allowPdfDownload: false,
                  fullPdfStorageKey: null,
                  previewPdfStorageKey: null,
                  isBundledPublicEdition: false,
                  pdfUrl: "",
                  pdfFileName: "",
                  permissions: undefined,
                });
                setBulk(toBulk(source));
                setSelected("");
                setChapterIndex(0);
                setDirty(true);
                setTab("content");
                setMessage("Private draft copied. Save to create it.");
              }}
            />
            {owner && (
              <button
                type="button"
                className="min-h-11 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white"
                onClick={startNew}
            >
                + Create new ebook
              </button>
            )}
          </>
        )}
        {tab === "pdf" &&
          (book ? (
            <PdfSettings
              book={book}
              onChange={change}
              owner={owner}
              accessBusy={accessBusy || busy}
              onAccessCommit={(patch) => void commitAccess(patch)}
              onUploaded={(value) => {
                setBook((old) =>
                  old
                    ? {
                        ...old,
                        pdfUrl: value.pdfUrl,
                        pdfFileName: value.pdfFileName,
                        fullPdfStorageKey: value.fullPdfStorageKey,
                        previewPdfStorageKey: value.previewPdfStorageKey,
                        revision: value.revision,
                        updatedAt: value.updatedAt,
                      }
                    : value,
                );
                setInventoryVersion((v) => v + 1);
                onSaved();
              }}
            />
          ) : (
            <p>Select an ebook from Inventory first.</p>
          ))}
        {tab === "exam" && book && (
          <>
            <EbookExamSettings
              book={book}
              onChange={change}
              onQuestions={(questions) => {
                if (
                  bulkDirty &&
                  !window.confirm(
                    "Replace unapplied bulk edits with the visual question bank?",
                  )
                )
                  return;
                change({ finalExamQuestions: questions });
                setBulk(
                  toBulk({
                    ...book,
                    finalExamQuestions: questions,
                    draftBulk: undefined,
                  }),
                );
              }}
            />
            <Field label="Final exam duration (minutes)">
              <input
                type="number"
                min={1}
                max={180}
                className={input}
                value={book.examMinutes}
                onChange={(event) =>
                  change({ examMinutes: Number(event.target.value) })
                }
              />
            </Field>
            <Field
              label="Final exam question bank"
              hint="One plain-text row per question: question | A | B | C | D | correct letter | explanation. Use the visual editor for multiline code or literal pipes."
            >
              <textarea
                rows={8}
                className={`${input} font-mono text-xs`}
                value={bulk}
                onChange={(event) => {
                  setBulkValue(event.target.value);
                  setBulkDirty(true);
                  setDirty(true);
                }}
              />
            </Field>
            <button
              type="button"
              className="min-h-10 rounded-lg border px-3 text-sm"
              onClick={() => {
                const parsed = parseBulk(bulk);
                if (parsed.errors.length) {
                  setMessage(parsed.errors.join(" "));
                  return;
                }
                change({
                  finalExamQuestions: parsed.rows.map((q, i) => ({
                    ...q,
                    id: `${book.slug}-q${i + 1}`,
                    domain:
                      book.finalExamQuestions?.[i]?.question === q.question
                        ? book.finalExamQuestions[i].domain
                        : undefined,
                  })),
                });
                setBulkDirty(false);
                setMessage(
                  "Bulk questions applied to the visual builder. Save ebook to persist.",
                );
              }}
            >
              Apply bulk rows to visual builder
            </button>
            <p className="text-xs text-muted-foreground">
              {parseBulk(bulk).rows.length} valid question rows. Save validates
              chapters, checks and answers on the server.
            </p>
            <EbookBackup
              book={book}
              owner={owner}
              onImport={(value, replace) => {
                const imported = replace
                  ? {
                      ...value,
                      id: book.id || book.slug,
                      slug: book.slug,
                      revision: book.revision,
                      visibility: book.visibility,
                      permissions: book.permissions,
                      accessLevel: book.accessLevel,
                      freePreviewPages: book.freePreviewPages,
                      allowFullPdfDownload: book.allowFullPdfDownload,
                      fullPdfStorageKey: book.fullPdfStorageKey,
                      previewPdfStorageKey: book.previewPdfStorageKey,
                      isBundledPublicEdition: book.isBundledPublicEdition,
                      pdfUrl: book.pdfUrl,
                      pdfFileName: book.pdfFileName,
                    }
                  : {
                      ...value,
                      id: null,
                      slug: `${value.slug.slice(0, 40)}-import-${crypto.randomUUID().slice(0, 6)}`,
                      revision: undefined,
                      visibility: "admin_only" as const,
                      fullPdfStorageKey: null,
                      previewPdfStorageKey: null,
                      isBundledPublicEdition: false,
                      pdfUrl: "",
                      pdfFileName: "",
                      permissions: undefined,
                    };
                setBook(imported);
                setBulk(toBulk(imported));
                setDirty(true);
                setSelected(replace ? book.slug : "");
                setChapterIndex(0);
              }}
              onMarkdown={(value) => changeChapter({ contentMarkdown: value })}
            />
          </>
        )}
        {message && (
          <p
            role="status"
            className="rounded-xl border bg-muted/40 p-4 text-sm"
          >
            {message}
          </p>
        )}
        {tab === "content" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5 dark:border-indigo-900 dark:bg-indigo-950/20">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-300">Authoring workspace</p>
                <h3 className="mt-1 text-xl font-extrabold tracking-tight">Build your learning track</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  Write chapters, preview lessons instantly, and define who can read the ebook.
                  Free/Pro controls save immediately for existing ebooks; chapter edits use Save changes.
                </p>
              </div>
              <span className="rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-200">
                {book?.chapters.length ?? 0} chapters
              </span>
            </div>
            {restore && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 p-4 text-sm">
                <span>
                  A local draft is available:{" "}
                  {restore.title || "Untitled ebook"}
                </span>
                <button
                  type="button"
                  className="min-h-10 font-semibold underline"
                  onClick={() => {
                    setBook(restore);
                    setSelected(restore.revision ? restore.slug : "");
                    setChapterIndex(0);
                    setBulk(toBulk(restore));
                    setBulkDirty(restore.draftBulk !== undefined);
                    setRestore(null);
                  }}
                >
                  Restore local draft
                </button>
              </div>
            )}
            {book && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Title">
                    <input
                      className={input}
                      value={book.title}
                      onChange={(event) => {
                        const title = event.target.value;
                        change(
                          book.id || book.revision
                            ? { title }
                            : { title, slug: slugify(title) },
                        );
                      }}
                    />
                  </Field>
                  <Field
                    label="Slug"
                    hint="Stable lowercase link; cannot change after the first save."
                  >
                    <input
                      disabled={!!book.id || !!book.revision || !owner}
                      readOnly={!!book.id || !!book.revision}
                      className={input}
                      value={book.slug}
                      onChange={(event) => change({ slug: event.target.value })}
                    />
                  </Field>
                  <Field label="Category">
                    <select
                      className={input}
                      value={book.category}
                      onChange={(event) =>
                        change({
                          category: event.target
                            .value as EbookTrack["category"],
                        })
                      }
                    >
                      {EBOOK_CATEGORIES.map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Level">
                    <select
                      className={input}
                      value={book.level}
                      onChange={(event) =>
                        change({
                          level: event.target.value as EbookTrack["level"],
                        })
                      }
                    >
                      {[
                        "Beginner to Pro",
                        "Intermediate",
                        "Advanced",
                        "Certification Cram",
                      ].map((value) => (
                        <option key={value}>{value}</option>
                      ))}
                    </select>
                  </Field>
                  <Field
                    label="Visibility"
                    hint="Only the owner admin can publish or restrict access."
                  >
                    <select
                      disabled={!owner || busy || accessBusy || book.isBundledPublicEdition}
                      className={input}
                      value={book.visibility}
                      onChange={(event) =>
                        void commitVisibility(event.target.value as EbookTrack["visibility"])
                      }
                    >
                      <option value="admin_only">Private admin draft</option>
                      <option value="invite_only">Approved users only</option>
                      <option value="public">Public</option>
                    </select>
                  </Field>
                  <Field
                    label="Linked existing test ID (optional)"
                    hint="Vendor starters open practice; published custom tests retain their existing access rules."
                  >
                    <input
                      className={input}
                      value={book.linkedMockTestId || ""}
                      onChange={(event) =>
                        change({ linkedMockTestId: event.target.value })
                      }
                    />
                  </Field>
                </div>
                <EbookMonetizationControls
                  book={book}
                  owner={owner}
                  busy={accessBusy || busy}
                  onCommit={(patch) => void commitAccess(patch)}
                />
                <Field label="Summary">
                  <textarea
                    className={input}
                    value={book.subtitle}
                    onChange={(event) =>
                      change({ subtitle: event.target.value })
                    }
                  />
                </Field>
                <div className="grid min-w-0 gap-4 xl:grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)]">
                  <nav
                    aria-label="Studio chapter tree"
                    className="space-y-2 rounded-xl border p-3"
                  >
                    {book.chapters.map((c, i) => (
                      <button
                        key={c.id}
                        type="button"
                        className={`block w-full rounded-lg p-3 text-left text-xs ${i === chapterIndex ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200" : "hover:bg-muted"}`}
                        onClick={() => setChapterIndex(i)}
                      >
                        {i + 1}. {c.title}
                      </button>
                    ))}
                  </nav>
                  <section className="space-y-4 rounded-2xl border p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="font-bold">Chapters</h3>
                      <button
                        type="button"
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm"
                        onClick={() => {
                          change({
                            chapters: [...book.chapters, emptyChapter()],
                          });
                          setChapterIndex(book.chapters.length);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        Add chapter
                      </button>
                    </div>
                    <select
                      aria-label="Select chapter to edit"
                      className={input}
                      value={chapterIndex}
                      onChange={(event) =>
                        setChapterIndex(Number(event.target.value))
                      }
                    >
                      {book.chapters.map((chapter, index) => (
                        <option key={chapter.id} value={index}>
                          {index + 1}. {chapter.title}
                        </option>
                      ))}
                    </select>
                    {!book.chapters.length && (
                      <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
                        No chapters yet. Click Add chapter to start authoring.
                      </p>
                    )}
                    {chapter && (
                      <>
                        <div className="flex flex-wrap gap-2">
                          <button
                            aria-label="Move chapter earlier"
                            type="button"
                            disabled={chapterIndex === 0}
                            className="rounded-lg border p-2 disabled:opacity-40"
                            onClick={() => move(-1)}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            aria-label="Move chapter later"
                            type="button"
                            disabled={chapterIndex === book.chapters.length - 1}
                            className="rounded-lg border p-2 disabled:opacity-40"
                            onClick={() => move(1)}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={book.chapters.length < 1}
                            onClick={() => {
                              change({
                                chapters: book.chapters.filter(
                                  (_, index) => index !== chapterIndex,
                                ),
                              });
                              setChapterIndex(0);
                            }}
                            className="inline-flex items-center gap-2 rounded-lg border px-3 text-sm disabled:opacity-40"
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove chapter
                          </button>
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Chapter title">
                            <input
                              className={input}
                              value={chapter.title}
                              onChange={(event) =>
                                changeChapter({ title: event.target.value })
                              }
                            />
                          </Field>
                          <Field label="Reading minutes">
                            <input
                              className={input}
                              type="number"
                              min={1}
                              max={240}
                              value={chapter.durationMinutes}
                              onChange={(event) =>
                                changeChapter({
                                  durationMinutes: Number(event.target.value),
                                })
                              }
                            />
                          </Field>
                        </div>
                        <Field label="Chapter summary">
                          <input
                            className={input}
                            value={chapter.summary}
                            onChange={(event) =>
                              changeChapter({ summary: event.target.value })
                            }
                          />
                        </Field>
                        <div className="flex flex-wrap gap-2">
                          {[
                            ["H2", "## Heading"],
                            ["H3", "### Heading"],
                            ["Bold", "**Important**"],
                            ["Code Block", '```python\nprint("Hello")\n```'],
                            ["Callout", "> Key point"],
                            [
                              "Table",
                              "| Concept | Action |\n| --- | --- |\n| Example | Review |",
                            ],
                            [
                              "Cheatcode Card",
                              "> Cheatcode: `value` — explain why it works.",
                            ],
                          ].map(([label, text]) => (
                            <button
                              key={label}
                              type="button"
                              className="min-h-9 rounded-lg border px-3 text-xs"
                              onClick={() => {
                                const area = markdownRef.current;
                                const start =
                                    area?.selectionStart ??
                                    chapter.contentMarkdown.length,
                                  end = area?.selectionEnd ?? start;
                                changeChapter({
                                  contentMarkdown:
                                    chapter.contentMarkdown.slice(0, start) +
                                    "\n\n" +
                                    text +
                                    "\n\n" +
                                    chapter.contentMarkdown.slice(end),
                                });
                              }}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <Field
                          label="Lesson Markdown"
                          hint="Headings, paragraphs, lists, inline code and fenced code blocks are supported. HTML is displayed as text."
                        >
                          <textarea
                            ref={markdownRef}
                            rows={12}
                            className={`${input} font-mono`}
                            value={chapter.contentMarkdown}
                            onChange={(event) =>
                              changeChapter({
                                contentMarkdown: event.target.value,
                              })
                            }
                          />
                        </Field>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Code example">
                            <textarea
                              rows={7}
                              className={`${input} font-mono`}
                              value={chapter.codeSnippet?.code || ""}
                              onChange={(event) =>
                                changeChapter({
                                  codeSnippet: event.target.value
                                    ? {
                                        language:
                                          chapter.codeSnippet?.language ||
                                          "python",
                                        code: event.target.value,
                                        expectedOutput:
                                          chapter.codeSnippet?.expectedOutput ||
                                          "",
                                      }
                                    : undefined,
                                })
                              }
                            />
                          </Field>
                          <Field
                            label="Expected output"
                            hint="Output preview only; snippets are not executed on the server."
                          >
                            <textarea
                              rows={7}
                              className={`${input} font-mono`}
                              value={chapter.codeSnippet?.expectedOutput || ""}
                              onChange={(event) =>
                                changeChapter({
                                  codeSnippet: {
                                    language:
                                      chapter.codeSnippet?.language || "python",
                                    code: chapter.codeSnippet?.code || "",
                                    expectedOutput: event.target.value,
                                  },
                                })
                              }
                            />
                          </Field>
                        </div>
                        <Field label="Code language">
                          <select
                            className={input}
                            value={chapter.codeSnippet?.language || "python"}
                            onChange={(event) =>
                              changeChapter({
                                codeSnippet: {
                                  code: chapter.codeSnippet?.code || "",
                                  expectedOutput:
                                    chapter.codeSnippet?.expectedOutput || "",
                                  language: event.target.value as NonNullable<
                                    EbookChapter["codeSnippet"]
                                  >["language"],
                                },
                              })
                            }
                          >
                            {[
                              "python",
                              "java",
                              "typescript",
                              "bash",
                              "powershell",
                              "json",
                            ].map((value) => (
                              <option key={value}>{value}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Interview takeaways (one per line)">
                          <textarea
                            className={input}
                            value={chapter.keyTakeaways.join("\n")}
                            onChange={(event) =>
                              changeChapter({
                                keyTakeaways: event.target.value.split("\n"),
                              })
                            }
                          />
                        </Field>
                        {chapter.conceptChecks.map((check, index) => (
                          <fieldset
                            key={index}
                            className="space-y-3 rounded-xl border p-4"
                          >
                            <legend className="px-2 text-sm font-bold">
                              Concept check {index + 1}
                            </legend>
                            <Field label="Question">
                              <input
                                className={input}
                                value={check.question}
                                onChange={(event) =>
                                  changeChapter({
                                    conceptChecks: chapter.conceptChecks.map(
                                      (q, i) =>
                                        i === index
                                          ? {
                                              ...q,
                                              question: event.target.value,
                                            }
                                          : q,
                                    ),
                                  })
                                }
                              />
                            </Field>
                            <div className="grid gap-3 sm:grid-cols-2">
                              {check.options.map((option, oi) => (
                                <Field key={oi} label={`Option ${"ABCD"[oi]}`}>
                                  <input
                                    className={input}
                                    value={option}
                                    onChange={(event) =>
                                      changeChapter({
                                        conceptChecks:
                                          chapter.conceptChecks.map((q, i) =>
                                            i === index
                                              ? {
                                                  ...q,
                                                  options: q.options.map(
                                                    (value, j) =>
                                                      j === oi
                                                        ? event.target.value
                                                        : value,
                                                  ),
                                                }
                                              : q,
                                          ),
                                      })
                                    }
                                  />
                                </Field>
                              ))}
                            </div>
                            <Field label="Correct option">
                              <select
                                className={input}
                                value={check.answer}
                                onChange={(event) =>
                                  changeChapter({
                                    conceptChecks: chapter.conceptChecks.map(
                                      (q, i) =>
                                        i === index
                                          ? {
                                              ...q,
                                              answer: Number(
                                                event.target.value,
                                              ),
                                            }
                                          : q,
                                    ),
                                  })
                                }
                              >
                                {[0, 1, 2, 3].map((value) => (
                                  <option key={value} value={value}>
                                    {"ABCD"[value]}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field label="Explanation">
                              <textarea
                                className={input}
                                value={check.explanation}
                                onChange={(event) =>
                                  changeChapter({
                                    conceptChecks: chapter.conceptChecks.map(
                                      (q, i) =>
                                        i === index
                                          ? {
                                              ...q,
                                              explanation: event.target.value,
                                            }
                                          : q,
                                    ),
                                  })
                                }
                              />
                            </Field>
                          </fieldset>
                        ))}
                      </>
                    )}
                  </section>
                  <aside className="min-w-0 rounded-2xl border p-5">
                    <p className="mb-5 text-xs font-bold uppercase tracking-widest text-indigo-600">
                      Live reader preview
                    </p>
                    {chapter && (
                      <>
                        <h2 className="mb-4 text-2xl font-bold">
                          {chapter.title}
                        </h2>
                        <LessonMarkdown content={chapter.contentMarkdown} />
                        {chapter.codeSnippet && (
                          <CodeExample {...chapter.codeSnippet} />
                        )}
                        <ul className="mt-5 list-inside list-disc text-sm">
                          {chapter.keyTakeaways.map((tip, i) => (
                            <li key={i}>{tip}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </aside>
                </div>
              </>
            )}
          </>
        )}
        {book && tab !== "inventory" && (
          <div className="sticky bottom-0 border-t bg-card py-4">
            {" "}
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy || accessBusy}
                onClick={() => void handleSaveEbook()}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {busy ? "Saving…" : book.revision ? "Save changes" : "Create ebook"}
              </button>
              <button
                type="button"
                onClick={draft}
                disabled={busy || accessBusy}
                className="min-h-11 rounded-xl border px-4 text-sm font-semibold"
              >
                Save local draft
              </button>
              {owner && book.revision && (
                <button
                  type="button"
                  className="min-h-11 rounded-xl border px-4 text-sm text-red-600"
                  disabled={busy}
                  onClick={() => setArchiveOpen(true)}
               >
                  Archive ebook
                </button>
              )}
            </div>
          </div>
        )}
        {toast && (
          <div
            role={toast.kind === "error" ? "alert" : "status"}
            className={`fixed right-5 top-24 z-[100] max-w-sm rounded-xl border px-4 py-3 text-sm font-semibold shadow-xl ${toast.kind === "error" ? "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100" : "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"}`}
          >
            {toast.text}
          </div>
        )}
        {archiveOpen && book?.revision && (
          <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/60 p-4" role="presentation">
            <section role="dialog" aria-modal="true" aria-labelledby="archive-ebook-title" className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl">
              <h3 id="archive-ebook-title" className="text-xl font-bold">Archive this ebook?</h3>
              <p className="mt-3 text-sm text-muted-foreground">
                {book.title} will be removed from active authoring and learner listings. Existing attempts remain preserved.
              </p>
              <div className="mt-6 flex justify-end gap-3">
                <button type="button" disabled={busy} className="min-h-11 rounded-xl border px-4 text-sm font-semibold" onClick={() => setArchiveOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
                  onClick={async () => {
                    setBusy(true);
                    const result = await ebookAdminApi(`/${encodeURIComponent(book.slug)}`, { method: "DELETE" });
                    setBusy(false);
                    if (!result.success) {
                      notify(result.error?.message || "Archive failed.", "error");
                      return;
                    }
                    setArchiveOpen(false);
                    setBook(newBook());
                    setSelected("");
                    setBulk("");
                    setBulkDirty(false);
                    setDirty(false);
                    setInventoryVersion((v) => v + 1);
                    notify("Ebook archived.");
                    onSaved();
                  }}
                >
                  {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  Archive ebook
                </button>
              </div>
            </section>
          </div>
        )}
        {tab === "access" && owner && (
          <div className="space-y-5">
            <h3 className="font-bold">
              Pending access & collaborator requests
            </h3>
            <p className="text-sm text-muted-foreground">
              Only verified Google or GitHub account emails can request access.
              Grants apply to one ebook; editors cannot grant access or change
              visibility.
            </p>
            <div className="rounded-xl border p-4">
              <Field label="Grant access to an email">
                <input
                  type="email"
                  className={input}
                  value={grantEmail}
                  onChange={(event) => setGrantEmail(event.target.value)}
                />
              </Field>
              <p className="mt-2 text-xs text-muted-foreground">
                Selected ebook:{" "}
                {book?.title || "Select a saved ebook in Chapter Studio first."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(["reader", "editor"] as const).map((role) => (
                  <button
                    key={role}
                    type="button"
                    disabled={!book?.revision || busy}
                    className="min-h-10 rounded-lg border px-3 text-sm disabled:opacity-40"
                    onClick={() =>
                      book &&
                      void approve(book.slug, grantEmail, role, "approved")
                    }
                  >
                    Approve as {role === "editor" ? "Co-Editor" : "Reader"}
                  </button>
                ))}
              </div>
            </div>
            {requests.map((request) => (
              <article
                key={`${request.slug}-${request.email}`}
                className="space-y-3 rounded-xl border p-4"
              >
                <p className="font-semibold">{request.title}</p>
                <p className="break-all text-sm">
                  {request.email} · {request.status} · {request.role}
                </p>
                <p className="text-sm text-muted-foreground">{request.note}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void approve(
                        request.slug,
                        request.email,
                        "reader",
                        "approved",
                      )
                    }
                    className="min-h-10 rounded-lg border px-3 text-xs font-semibold"
                  >
                    Approve as Reader
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void approve(
                        request.slug,
                        request.email,
                        "editor",
                        "approved",
                      )
                    }
                    className="min-h-10 rounded-lg border px-3 text-xs font-semibold"
                  >
                    Approve as Co-Editor
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void approve(
                        request.slug,
                        request.email,
                        request.role,
                        "revoked",
                      )
                    }
                    className="min-h-10 rounded-lg border px-3 text-xs font-semibold text-red-600"
                  >
                    Revoke Access
                  </button>
                </div>
              </article>
            ))}
            {requests.length === 0 && (
              <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                No access requests yet.
              </p>
            )}
          </div>
        )}
      </div>
    </dialog>
  );
}
