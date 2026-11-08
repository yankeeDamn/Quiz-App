"use client";
import { useEffect, useState } from "react";
import {
  EBOOK_CATEGORIES,
  ebookApi,
  ebookAdminApi,
  type EbookTrack,
  type EbookSummary,
} from "@/lib/ebooks";
import { EbookShare } from "./ebook-share";
import { Field } from "@/components/admin/ui";
import { ebookFieldClass as input, ebookSelectClass, ebookTextareaClass } from "./ebook-admin-ui";
import { BookOpen, CheckCircle2, Crown, FileText, Layers3, LoaderCircle, ShieldCheck } from "lucide-react";
export function EbookInventory({
  owner,
  pending,
  version,
  onSelect,
  onClone,
  onRefresh,
  onMessage,
  onUpdated,
}: {
  owner: boolean;
  pending: number;
  version: number;
  onSelect: (slug: string, tab: string) => void;
  onClone: (book: EbookTrack) => void;
  onRefresh: () => void;
  onMessage: (message: string) => void;
  onUpdated: (ebook: EbookTrack) => void;
}) {
  const [books, setBooks] = useState<EbookSummary[]>([]),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("All"),
    [visibility, setVisibility] = useState("all"),
    [busySlug, setBusySlug] = useState("");
  useEffect(() => {
    let active = true;
    const request = owner
      ? ebookAdminApi<{ ebooks: EbookSummary[] }>("")
      : ebookApi<{ ebooks: EbookSummary[] }>("/ebooks");
    void request.then((result) => {
      if (!active) return;
      if (result.data)
        setBooks(
          owner
            ? result.data.ebooks
            : result.data.ebooks.filter((book) => book.permissions?.canEdit),
        );
      else onMessage(result.error?.message || "Inventory unavailable.");
    });
    return () => {
      active = false;
    };
  }, [owner, version, onMessage]);
  const shown = books.filter(
    (b) =>
      (category === "All" || b.category === category) &&
      (visibility === "all" || b.visibility === visibility) &&
      `${b.title} ${b.slug}`.toLowerCase().includes(search.toLowerCase()),
  );
  const totalChapters = books.reduce((sum, b) => sum + b.chapterCount, 0),
    publicCount = books.filter((b) => b.visibility === "public").length;
  const stats = [
    ["Ebooks & chapters", `${books.length} tracks · ${totalChapters} chapters`],
    [
      "Visibility",
      `${publicCount} public · ${books.length - publicCount} restricted`,
    ],
    [
      "Print / PDF ready",
      `${books.filter((b) => b.fullPdfStorageKey || b.pdfUrl).length} tracks`,
    ],
    [
      "Assessments",
      `${books.length} exams · ${books.reduce((sum, b) => sum + (b.questionCount || 0), 0)} questions`,
    ],
    ["Pending approvals", owner ? String(pending) : "Owner managed"],
  ];
  const fetchBook = async (slug: string) => {
    const r = await ebookAdminApi<{ ebook: EbookTrack }>(`/${slug}`);
    if (!r.data) throw Error(r.error?.message || "Could not load ebook.");
    return r.data.ebook;
  };
  const patchBook = async (
    book: EbookSummary,
    kind: "access" | "visibility",
    patch: { accessLevel?: "free" | "pro"; visibility?: EbookTrack["visibility"] },
  ) => {
    if (!owner || busySlug) return;
    if (kind === "access" && book.isBundledPublicEdition && patch.accessLevel === "pro") {
      onMessage("Bundled public editions must remain Free.");
      return;
    }
    if (kind === "visibility" && patch.visibility === "public" &&
        !window.confirm("Publish this ebook to learners? Incomplete drafts will be rejected.")) return;
    setBusySlug(book.slug);
    const response = await ebookAdminApi<{ebook:EbookTrack}>(
      `/${encodeURIComponent(book.slug)}/${kind}`,
      { method: "PATCH", body: { revision: book.revision, ...patch } },
    );
    setBusySlug("");
    if (!response.data) {
      onMessage(response.error?.message || "Unable to update the ebook.");
      return;
    }
    onUpdated(response.data.ebook);
    onMessage(kind === "access" ? "Free/Pro access saved." : "Publication visibility saved.");
    onRefresh();
  };
  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Ebook library metrics">
        {stats.map(([label, value], index) => (
          <div key={label} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-card p-5 shadow-sm dark:border-slate-800">
            <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
              {index === 0 ? <BookOpen className="h-5 w-5"/> : index === 1 ? <Layers3 className="h-5 w-5"/> : index === 2 ? <FileText className="h-5 w-5"/> : index === 3 ? <CheckCircle2 className="h-5 w-5"/> : <ShieldCheck className="h-5 w-5"/>}
            </div>
            <p className="text-xs font-semibold text-muted-foreground">{label}</p>
            <p className="mt-2 text-base font-extrabold tracking-tight">{value}</p>
          </div>
        ))}
      </section>
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-card p-4 shadow-sm dark:border-slate-800 sm:grid-cols-3">
        <input
          type="search"
          aria-label="Search ebook inventory"
          placeholder="Search title or slug"
          className={input}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Inventory category"
          className={input}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option>All</option>
          {EBOOK_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          aria-label="Inventory visibility"
          className={input}
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
        >
          <option value="all">All visibility</option>
          {["admin_only", "invite_only", "public"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-card shadow-sm dark:border-slate-800">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-slate-100/70 dark:bg-slate-900">
            <tr>
              {["Ebook", "Publication", "Reader tier", "Content", "Actions"].map((label) => (
                <th className="p-4" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((book) => (
              <tr key={book.slug} className="border-t transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-900/50">
                <td className="max-w-sm p-4">
                  <p className="font-semibold">{book.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {book.slug} · {book.category}
                  </p>
                </td>
                <td className="p-4">
                  <select
                    aria-label={`Publication visibility for ${book.title}`}
                    className="min-h-10 max-w-[180px] rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm outline-none transition-all hover:border-indigo-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                    value={book.visibility}
                    disabled={!owner || !!busySlug || book.isBundledPublicEdition}
                    onChange={(event) => void patchBook(book, "visibility", {
                      visibility: event.target.value as EbookTrack["visibility"],
                    })}
                  >
                    <option value="admin_only">Private draft</option>
                    <option value="invite_only">Invite only</option>
                    <option value="public">Public</option>
                  </select>
                </td>
                <td className="p-4">
                  <div className="inline-flex items-center gap-2">
                    <select
                      aria-label={`Reader tier for ${book.title}`}
                      value={book.accessLevel || "free"}
                      disabled={!owner || !!busySlug || book.isBundledPublicEdition}
                      onChange={(event) => void patchBook(book, "access", {
                        accessLevel: event.target.value as "free" | "pro",
                      })}
                      className={`min-h-10 rounded-xl border px-3 text-xs font-bold shadow-sm outline-none transition-all focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-50 ${book.accessLevel === "pro" ? "border-violet-200 bg-violet-50 text-violet-900 hover:border-violet-300 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200" : "border-emerald-200 bg-emerald-50 text-emerald-900 hover:border-emerald-300 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"}`}
                    >
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                    </select>
                    {busySlug === book.slug && <LoaderCircle className="h-4 w-4 animate-spin text-indigo-600"/>}
                    {book.accessLevel === "pro" && <Crown className="h-4 w-4 text-violet-500"/>}
                  </div>
                </td>
                <td className="p-4 text-xs">
                  {book.chapterCount} chapters
                  <br />
                  {book.questionCount || 0} questions
                  <br />
                  {book.pdfUrl ? "PDF attached" : "Printable edition"}
                </td>
                <td className="space-y-2 p-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onSelect(book.slug, "content")}
                      className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                    >
                      Edit chapters
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelect(book.slug, "pdf")}
                      className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                    >
                      Manage PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelect(book.slug, "exam")}
                      className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                    >
                      Edit exam
                    </button>
                    {owner && (
                      <button
                        type="button"
                        disabled={!!busySlug}
                        onClick={async () => {
                          try {
                            onClone(await fetchBook(book.slug));
                          } catch (error) {
                            onMessage(String(error));
                          }
                        }}
                        className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                      >
                        Clone private draft
                      </button>
                    )}
                  </div>
                  <EbookShare book={book} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Bundled public starters remain public because their content is
        distributed with the app. Clone them to create a restricted variant.
        Inventory changes use server permissions and revision checks.
      </p>
    </div>
  );
}
export function EbookExamSettings({
  book,
  onChange,
  onQuestions,
}: {
  book: EbookTrack;
  onChange: (patch: Partial<EbookTrack>) => void;
  onQuestions: (
    questions: NonNullable<EbookTrack["finalExamQuestions"]>,
  ) => void;
}) {
  const questions = book.finalExamQuestions || [];
  const changeQuestion = (
    i: number,
    patch: Partial<(typeof questions)[number]>,
  ) => onQuestions(questions.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-white p-6 shadow-sm dark:border-indigo-900 dark:from-indigo-950/40 dark:via-slate-950 dark:to-slate-950">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-700 dark:text-indigo-300">Exam Builder</p>
          <h3 className="mt-2 text-2xl font-extrabold tracking-tight">Assessment & question studio</h3>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Author questions, correct answers, explanations, scoring and timing.
            Use Save changes to persist edits; new drafts can remain incomplete.
          </p>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-white px-4 py-3 text-center dark:border-indigo-800 dark:bg-slate-900">
          <span className="block text-2xl font-extrabold text-indigo-700 dark:text-indigo-300">{questions.length}</span>
          <span className="text-xs font-semibold text-muted-foreground">Questions</span>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Pass percentage">
          <input
            type="number"
            min={1}
            max={100}
            className={input}
            value={book.passPercent ?? 70}
            onChange={(e) => onChange({ passPercent: Number(e.target.value) })}
          />
        </Field>
        <Field label="Marks per correct">
          <input
            type="number"
            min={0.25}
            max={10}
            step={0.25}
            className={input}
            value={book.marksPerCorrect ?? 1}
            onChange={(e) =>
              onChange({ marksPerCorrect: Number(e.target.value) })
            }
          />
        </Field>
        <Field label="Negative marks">
          <select
            className={input}
            value={book.negativeMarks ?? 0}
            onChange={(e) =>
              onChange({ negativeMarks: Number(e.target.value) })
            }
          >
            <option value={0}>0</option>
            <option value={0.25}>−0.25</option>
          </select>
        </Field>
        <Field label="Badge code">
          <input
            className={input}
            value={book.examBadgeCode || ""}
            onChange={(e) => onChange({ examBadgeCode: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Linked existing mock test ID (optional)">
        <input
          className={input}
          value={book.linkedMockTestId || ""}
          onChange={(e) => onChange({ linkedMockTestId: e.target.value })}
        />
      </Field>
      <div className="space-y-3">
        {questions.map((q, i) => (
          <details key={i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.04] transition-shadow open:shadow-md dark:border-slate-800 dark:bg-slate-950">
            <summary className="cursor-pointer text-sm font-semibold">
              {i + 1}. {q.question || "New question"}
            </summary>
            <div className="mt-4 space-y-3">
              <Field label="Question">
                <textarea
                  className={input}
                  value={q.question}
                  onChange={(e) =>
                    changeQuestion(i, { question: e.target.value })
                  }
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                {q.options.map((option, oi) => (
                  <Field key={oi} label={`Option ${"ABCD"[oi]}`}>
                    <input
                      className={input}
                      value={option}
                      onChange={(e) =>
                        changeQuestion(i, {
                          options: q.options.map((v, j) =>
                            j === oi ? e.target.value : v,
                          ),
                        })
                      }
                    />
                  </Field>
                ))}
              </div>
              <Field label="Correct answer">
                <select
                  className={input}
                  value={q.answer}
                  onChange={(e) =>
                    changeQuestion(i, { answer: Number(e.target.value) })
                  }
                >
                  {[0, 1, 2, 3].map((v) => (
                    <option key={v} value={v}>
                      {"ABCD"[v]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Explanation">
                <textarea
                  className={input}
                  value={q.explanation}
                  onChange={(e) =>
                    changeQuestion(i, { explanation: e.target.value })
                  }
                />
              </Field>
              <Field label="Domain (optional)">
                <input
                  className={input}
                  value={q.domain || ""}
                  onChange={(e) =>
                    changeQuestion(i, { domain: e.target.value })
                  }
                />
              </Field>
              <button
                type="button"
                className="min-h-10 rounded-xl px-3 text-sm font-bold text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
                onClick={() => onQuestions(questions.filter((_, j) => j !== i))}
              >
                Remove question
              </button>
            </div>
          </details>
        ))}
      </div>
      <button
        type="button"
        className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 px-5 text-sm font-bold text-indigo-700 shadow-sm hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md dark:border-indigo-800 dark:from-indigo-950/50 dark:to-violet-950/40 dark:text-indigo-200"
        onClick={() =>
          onQuestions([
            ...questions,
            {
              question: "",
              options: ["", "", "", ""],
              answer: 0,
              explanation: "",
            },
          ])
        }
      >
        + Add question visually
      </button>
    </div>
  );
}
function validBackup(value: unknown): value is EbookTrack {
  if (!value || typeof value !== "object") return false;
  const b = value as EbookTrack;
  const strings = (values: unknown): values is string[] =>
    Array.isArray(values) && values.every((v) => typeof v === "string");
  const question = (q: unknown) => {
    if (!q || typeof q !== "object") return false;
    const v = q as NonNullable<EbookTrack["finalExamQuestions"]>[number];
    return (
      typeof v.question === "string" &&
      strings(v.options) &&
      v.options.length === 4 &&
      Number.isInteger(v.answer) &&
      v.answer >= 0 &&
      v.answer <= 3 &&
      typeof v.explanation === "string" &&
      (v.domain === undefined || typeof v.domain === "string")
    );
  };
  return (
    typeof b.slug === "string" &&
    /^[a-z0-9][a-z0-9-]{1,59}$/.test(b.slug) &&
    typeof b.title === "string" &&
    typeof b.subtitle === "string" &&
    EBOOK_CATEGORIES.includes(b.category) &&
    [
      "Beginner to Pro",
      "Intermediate",
      "Advanced",
      "Certification Cram",
    ].includes(b.level) &&
    Number.isInteger(b.examMinutes) &&
    b.examMinutes > 0 &&
    Array.isArray(b.chapters) &&
    b.chapters.length > 0 &&
    b.chapters.length <= 50 &&
    b.chapters.every(
      (c) =>
        c &&
        typeof c.id === "string" &&
        typeof c.title === "string" &&
        typeof c.summary === "string" &&
        Number.isInteger(c.durationMinutes) &&
        typeof c.contentMarkdown === "string" &&
        strings(c.keyTakeaways) &&
        Array.isArray(c.conceptChecks) &&
        c.conceptChecks.length === 2 &&
        c.conceptChecks.every(question) &&
        (!c.codeSnippet ||
          ([
            "python",
            "bash",
            "powershell",
            "typescript",
            "java",
            "json",
          ].includes(c.codeSnippet.language) &&
            typeof c.codeSnippet.code === "string" &&
            typeof c.codeSnippet.expectedOutput === "string")),
    ) &&
    Array.isArray(b.finalExamQuestions) &&
    b.finalExamQuestions.length > 0 &&
    b.finalExamQuestions.length <= 100 &&
    b.finalExamQuestions.every(question)
  );
}
export function EbookBackup({
  book,
  owner,
  onImport,
  onMarkdown,
}: {
  book: EbookTrack | null;
  owner: boolean;
  onImport: (book: EbookTrack, replace: boolean) => void;
  onMarkdown: (text: string) => void;
}) {
  const [error, setError] = useState(""),
    [replace, setReplace] = useState(!owner);
  const download = (data: string, type: string, name: string) => {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section className="space-y-3 rounded-xl border p-4">
      <h3 className="font-semibold">Import / export</h3>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={!book}
          className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          onClick={() =>
            book &&
            download(
              JSON.stringify(book, null, 2),
              "application/json",
              `${book.slug || "ebook"}.json`,
            )
          }
        >
          Export JSON backup
        </button>
        <button
          type="button"
          disabled={!book}
          className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          onClick={() =>
            book &&
            download(
              `# ${book.title}\n\n` +
                book.chapters
                  .map(
                    (c) =>
                      `## ${c.title}\n\n${c.contentMarkdown}\n\n${c.codeSnippet ? "```" + c.codeSnippet.language + "\n" + c.codeSnippet.code + "\n```" : ""}`,
                  )
                  .join("\n\n"),
              "text/markdown",
              `${book.slug || "ebook"}.md`,
            )
          }
        >
          Export Markdown
        </button>
      </div>
      {owner && (
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={replace}
            disabled={!book?.revision}
            onChange={(e) => setReplace(e.target.checked)}
          />
          Update selected ebook from matching JSON backup
        </label>
      )}
      <label className="grid gap-2 text-sm">
        {replace
          ? "Import JSON into selected ebook (matching slug required)"
          : "Import JSON as a new private draft"}
        <input
          type="file"
          accept=".json,application/json"
          disabled={!owner && !book?.revision}
          onChange={async (e) => {
            try {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 1024 * 1024) throw Error("JSON limit is 1 MiB.");
              const b: unknown = JSON.parse(await file.text());
              if (!validBackup(b))
                throw Error(
                  "Use a complete Ebook Studio JSON backup with valid chapters, checks and four-option questions.",
                );
              if (replace && (!book?.revision || b.slug !== book.slug))
                throw Error(
                  "Load the matching ebook before importing an update.",
                );
              if (
                replace &&
                !window.confirm(
                  "Replace current unsaved content with this backup? Visibility and access remain unchanged until you save.",
                )
              )
                return;
              const imported: EbookTrack = {
                ...b,
                pdfUrl: undefined,
                pdfFileName: undefined,
                examBadgeCode:
                  typeof b.examBadgeCode === "string" ? b.examBadgeCode : "",
                version: typeof b.version === "string" ? b.version : "1.0",
                linkedMockTestId:
                  typeof b.linkedMockTestId === "string"
                    ? b.linkedMockTestId
                    : "",
                passPercent:
                  typeof b.passPercent === "number" ? b.passPercent : 70,
                marksPerCorrect:
                  typeof b.marksPerCorrect === "number" ? b.marksPerCorrect : 1,
                negativeMarks: b.negativeMarks === 0.25 ? 0.25 : 0,
                accessLevel: b.isBundledPublicEdition === true ? "free" : (b.accessLevel === "pro" ? "pro" : "free"),
                freePreviewPages:
                  typeof b.freePreviewPages === "number" &&
                  Number.isInteger(b.freePreviewPages) &&
                  b.freePreviewPages >= 1 &&
                  b.freePreviewPages <= 20
                    ? b.freePreviewPages
                    : 2,
                allowFullPdfDownload:
                  b.allowFullPdfDownload === true || b.allowPdfDownload === true,
                allowPdfDownload:
                  b.allowFullPdfDownload === true || b.allowPdfDownload === true,
                fullPdfStorageKey: null,
                previewPdfStorageKey: null,
                isBundledPublicEdition: false,
                isCheatSheet: b.isCheatSheet === true,
                draftBulk: undefined,
                references: Array.isArray(b.references)
                  ? b.references.filter(
                      (x) => typeof x === "string" && x.startsWith("https://"),
                    )
                  : [],
              };
              onImport(imported, replace);
              setError(
                "Backup loaded into the form. Save ebook to persist it. PDF attachments and access grants are managed separately.",
              );
            } catch (error) {
              setError(
                error instanceof Error ? error.message : "Import failed.",
              );
            }
          }}
        />
      </label>
      <label className="grid gap-2 text-sm">
        Import Markdown into selected chapter
        <input
          type="file"
          accept=".md,text/markdown"
          onChange={async (e) => {
            try {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 40000)
                throw Error("Markdown chapter limit is 40,000 bytes.");
              onMarkdown(await file.text());
              setError(
                "Markdown imported into the selected chapter; save to persist.",
              );
            } catch (error) {
              setError(String(error));
            }
          }}
        />
      </label>
      <p role="status" className="text-xs">
        {error}
      </p>
    </section>
  );
}
