/* eslint-disable react-hooks/set-state-in-effect -- initialize account-scoped browser storage and refresh externally loaded data */
"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Save, Trash2, X } from "lucide-react";
import { parseBulk } from "@/lib/admin";
import {
  EBOOK_CATEGORIES,
  ebookApi,
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
  slug: "",
  title: "",
  subtitle: "",
  category: "Python",
  level: "Beginner to Pro",
  visibility: "admin_only",
  chapters: [emptyChapter()],
  examId: "",
  examMinutes: 20,
  finalExamQuestions: [],
  updatedAt: "",
});
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
  const setBulk = (value: string) => {
    setBulkValue(value);
    setBulkDirty(false);
  };
  const markdownRef = useRef<HTMLTextAreaElement>(null);
  const [requests, setRequests] = useState<EbookAccessRequest[]>([]),
    [grantEmail, setGrantEmail] = useState(""),
    [restore, setRestore] = useState<EbookTrack | null>(null);
  const [newlySaved, setNewlySaved] = useState<EbookSummary[]>([]);
  useEffect(() => {
    dialog.current?.showModal();
    setRestore(loadDraft(identity));
    if (!initialBook && owner) setBook(newBook());
  }, [identity, owner, initialBook]);
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
    if (
      book &&
      !window.confirm(
        "Switch ebook? Unsaved edits can be saved as a local draft first.",
      )
    )
      return;
    setSelected(slug);
    setChapterIndex(0);
    setMessage("");
    if (!slug) {
      setBook(newBook());
      setBulk("");
      return;
    }
    setBusy(true);
    const result = await ebookApi<{ ebook: EbookTrack }>(`/ebooks/${slug}`);
    setBusy(false);
    if (result.data) {
      setBook(result.data.ebook);
      setBulk(toBulk(result.data.ebook));
    } else {
      setBook(null);
      setMessage(result.error?.message || "Could not open ebook.");
    }
  };
  const change = (patch: Partial<EbookTrack>) =>
    setBook((old) => (old ? { ...old, ...patch } : old));
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
    setMessage(
      saveDraft(identity, copy)
        ? "Draft saved on this device for this account. It is not published or synced."
        : "Local storage is unavailable; keep this window open and copy your work.",
    );
  };
  const save = async () => {
    if (!book) return;
    const parsed = parseBulk(bulk);
    if (bulkDirty && parsed.errors.length) {
      setMessage(parsed.errors.join(" "));
      return;
    }
    if (
      book.visibility === "public" &&
      owner &&
      !window.confirm(
        "Save this ebook as public? Anyone will be able to read its content.",
      )
    )
      return;
    setBusy(true);
    setMessage("");
    const payload = {
      ...book,
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
    const result = await ebookApi<{ ebook: EbookTrack }>(
      `/admin/ebooks${book.revision ? "/" + book.slug : ""}`,
      { method: book.revision ? "PUT" : "POST", body: payload },
    );
    setBusy(false);
    if (result.data) {
      setBook(result.data.ebook);
      setSelected(result.data.ebook.slug);
      setBulk(toBulk(result.data.ebook));
      setNewlySaved((items) => [
        ...items.filter((item) => item.slug !== result.data!.ebook.slug),
        {
          ...result.data!.ebook,
          chapterCount: result.data!.ebook.chapters.length,
          durationMinutes: 0,
        },
      ]);
      setMessage("Ebook saved to the server.");
      setInventoryVersion((v) => v + 1);
      onSaved();
    } else {
      setMessage(
        result.error?.message ||
          "Save failed. Use Save local draft to preserve edits.",
      );
    }
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
        onClose();
      }}
      onClose={onClose}
      className="m-auto max-h-[90dvh] w-[min(97vw,100rem)] overflow-y-auto rounded-2xl border bg-card p-0 text-foreground shadow-2xl backdrop:bg-slate-950/60"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-card p-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-300">
            ExamPro authoring
          </p>
          <h2 className="mt-1 text-xl font-bold">Manage & Publish Ebooks</h2>
        </div>
        <button
          type="button"
          aria-label="Close ebook studio"
          onClick={onClose}
          className="rounded-lg p-3 hover:bg-muted"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="space-y-5 p-5 sm:p-7">
        <nav
          aria-label="Ebook command center"
          className="flex gap-2 overflow-x-auto pb-2"
        >
          {[
            ["inventory", "Inventory & KPIs"],
            ["content", "Chapter Studio"],
            ["pdf", "PDF Manager"],
            ["exam", "Exam Builder"],
            ...(owner
              ? [
                  [
                    "access",
                    `Access (${requests.filter((r) => r.status === "pending").length})`,
                  ],
                ]
              : []),
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
              className={`min-h-11 shrink-0 rounded-xl border px-4 text-sm font-semibold ${tab === id ? "bg-indigo-600 text-white" : ""}`}
            >
              {label}
            </button>
          ))}
        </nav>
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
                void load(slug).then(() => setTab(next));
              }}
              onClone={(source) => {
                setBook({
                  ...source,
                  slug: `${source.slug.slice(0, 40)}-copy-${crypto.randomUUID().slice(0, 6)}`,
                  title: source.title + " (copy)",
                  visibility: "admin_only",
                  revision: undefined,
                  pdfUrl: "",
                  pdfFileName: "",
                  permissions: undefined,
                });
                setBulk(toBulk(source));
                setSelected("");
                setChapterIndex(0);
                setTab("content");
                setMessage("Private draft copied. Save to create it.");
              }}
            />
            {owner && (
              <button
                type="button"
                className="min-h-11 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white"
                onClick={() => {
                  setBook(newBook());
                  setSelected("");
                  setBulk("");
                  setTab("content");
                }}
              >
                + Create private ebook
              </button>
            )}
          </>
        )}
        {tab === "pdf" &&
          (book ? (
            <PdfSettings
              book={book}
              onChange={change}
              onUploaded={(value) => {
                setBook((old) =>
                  old
                    ? {
                        ...old,
                        pdfUrl: value.pdfUrl,
                        pdfFileName: value.pdfFileName,
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
                      slug: book.slug,
                      revision: book.revision,
                      visibility: book.visibility,
                      permissions: book.permissions,
                      pdfUrl: book.pdfUrl,
                      pdfFileName: book.pdfFileName,
                    }
                  : {
                      ...value,
                      slug: `${value.slug.slice(0, 40)}-import-${crypto.randomUUID().slice(0, 6)}`,
                      revision: undefined,
                      visibility: "admin_only" as const,
                      pdfUrl: "",
                      pdfFileName: "",
                      permissions: undefined,
                    };
                setBook(imported);
                setBulk(toBulk(imported));
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
            <Field label="Choose ebook">
              <select
                className={input}
                value={selected}
                onChange={(event) => void load(event.target.value)}
              >
                {owner && <option value="">Create a new private ebook</option>}
                {!owner && !selected && (
                  <option value="">Select an approved ebook</option>
                )}
                {[
                  ...summaries,
                  ...newlySaved.filter(
                    (item) =>
                      !summaries.some((book) => book.slug === item.slug),
                  ),
                ].map((book) => (
                  <option key={book.slug} value={book.slug}>
                    {book.title}
                  </option>
                ))}
              </select>
            </Field>
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
                      onChange={(event) =>
                        change({ title: event.target.value })
                      }
                    />
                  </Field>
                  <Field
                    label="Slug"
                    hint="Stable lowercase link; cannot change after the first save."
                  >
                    <input
                      disabled={!!book.revision || !owner}
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
                      disabled={!owner}
                      className={input}
                      value={book.visibility}
                      onChange={(event) =>
                        change({
                          visibility: event.target
                            .value as EbookTrack["visibility"],
                        })
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
                            disabled={book.chapters.length < 2}
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
                disabled={busy}
                onClick={() => void save()}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {busy ? "Saving…" : "Save ebook"}
              </button>
              <button
                type="button"
                onClick={draft}
                className="min-h-11 rounded-xl border px-4 text-sm font-semibold"
              >
                Save local draft
              </button>
              {owner && book.revision && (
                <button
                  type="button"
                  className="min-h-11 rounded-xl border px-4 text-sm text-red-600"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      !window.confirm(
                        "Archive this ebook and remove it from the learning hub?",
                      )
                    )
                      return;
                    const result = await ebookApi(
                      `/admin/ebooks/${book.slug}`,
                      { method: "DELETE" },
                    );
                    if (result.success) {
                      onSaved();
                      setBook(newBook());
                      setSelected("");
                      setBulk("");
                    }
                    setMessage(
                      result.success
                        ? "Ebook archived."
                        : result.error?.message || "Archive failed.",
                    );
                  }}
                >
                  Archive ebook
                </button>
              )}
            </div>
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
