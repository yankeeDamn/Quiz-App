"use client";
import { useEffect, useState } from "react";
import {
  EBOOK_CATEGORIES,
  ebookApi,
  type EbookTrack,
  type EbookSummary,
} from "@/lib/ebooks";
import { EbookShare } from "./ebook-share";
import { Field, input } from "@/components/admin/ui";
export function EbookInventory({
  owner,
  pending,
  version,
  onSelect,
  onClone,
  onRefresh,
  onMessage,
}: {
  owner: boolean;
  pending: number;
  version: number;
  onSelect: (slug: string, tab: string) => void;
  onClone: (book: EbookTrack) => void;
  onRefresh: () => void;
  onMessage: (message: string) => void;
}) {
  const [books, setBooks] = useState<EbookSummary[]>([]),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("All"),
    [visibility, setVisibility] = useState("all"),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void ebookApi<{ ebooks: EbookSummary[] }>("/ebooks").then((r) => {
      if (!active) return;
      if (r.data)
        setBooks(r.data.ebooks.filter((b) => owner || b.permissions?.canEdit));
      else onMessage(r.error?.message || "Inventory unavailable.");
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
      `${books.filter((b) => b.allowPdfDownload !== false || b.pdfUrl).length} tracks`,
    ],
    [
      "Assessments",
      `${books.length} exams · ${books.reduce((sum, b) => sum + (b.questionCount || 0), 0)} questions`,
    ],
    ["Pending approvals", owner ? String(pending) : "Owner managed"],
  ];
  const fetchBook = async (slug: string) => {
    const r = await ebookApi<{ ebook: EbookTrack }>(`/ebooks/${slug}`);
    if (!r.data) throw Error(r.error?.message || "Could not load ebook.");
    return r.data.ebook;
  };
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-2xl border bg-muted/20 p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-3 text-lg font-bold">{value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
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
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-muted">
            <tr>
              {["Track", "Visibility", "Content", "Actions"].map((label) => (
                <th className="p-4" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((book) => (
              <tr key={book.slug} className="border-t">
                <td className="max-w-sm p-4">
                  <p className="font-semibold">{book.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {book.slug} · {book.category}
                  </p>
                </td>
                <td className="p-4">
                  <button
                    type="button"
                    disabled={!owner || busy}
                    className="min-h-10 rounded-full border px-3 text-xs font-semibold disabled:opacity-60"
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const full = await fetchBook(book.slug);
                        const values = [
                          "admin_only",
                          "invite_only",
                          "public",
                        ] as const;
                        const next =
                          values[(values.indexOf(full.visibility) + 1) % 3];
                        const r = await ebookApi(`/admin/ebooks/${book.slug}`, {
                          method: "PUT",
                          body: { ...full, visibility: next },
                        });
                        if (!r.success) throw Error(r.error?.message);
                        onRefresh();
                      } catch (error) {
                        onMessage(
                          error instanceof Error
                            ? error.message
                            : "Visibility change failed.",
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {book.visibility}
                  </button>
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
                      className="min-h-9 rounded-lg border px-3 text-xs"
                    >
                      Edit chapters
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelect(book.slug, "pdf")}
                      className="min-h-9 rounded-lg border px-3 text-xs"
                    >
                      PDF settings
                    </button>
                    {owner && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          try {
                            onClone(await fetchBook(book.slug));
                          } catch (error) {
                            onMessage(String(error));
                          }
                        }}
                        className="min-h-9 rounded-lg border px-3 text-xs"
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
    <div className="space-y-5">
      <h3 className="text-xl font-bold">
        Assessment settings & visual question builder
      </h3>
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
          <details key={i} className="rounded-xl border p-4">
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
                className="min-h-10 text-sm text-red-600"
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
        className="min-h-11 rounded-xl border px-4 text-sm font-semibold"
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
          className="min-h-10 rounded-lg border px-3 text-sm"
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
          className="min-h-10 rounded-lg border px-3 text-sm"
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
              const imported = {
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
                allowPdfDownload: b.allowPdfDownload !== false,
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
