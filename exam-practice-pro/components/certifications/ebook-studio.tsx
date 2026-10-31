/* eslint-disable react-hooks/set-state-in-effect -- initialize account-scoped browser storage and refresh externally loaded data */
"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Save, Trash2, X } from "lucide-react";
import { parseBulk } from "@/lib/admin";
import {
  ebookApi,
  loadDraft,
  saveDraft,
  type EbookTrack,
  type EbookSummary,
  type EbookChapter,
  type EbookAccessRequest,
} from "@/lib/ebooks";
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
    [bulk, setBulk] = useState(initialBook ? toBulk(initialBook) : ""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("content");
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
      draftBulk: bulk,
      finalExamQuestions: parsed.rows.map((q, index) => ({
        ...q,
        id: `${book.slug}-q${index + 1}`,
      })),
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
    if (parsed.errors.length) {
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
      finalExamQuestions: parsed.rows.map((q, index) => ({
        ...q,
        id: `${book.slug}-q${index + 1}`,
      })),
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
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      className="m-auto max-h-[90dvh] w-[min(95vw,70rem)] overflow-y-auto rounded-2xl border bg-card p-0 text-foreground shadow-2xl backdrop:bg-slate-950/60"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-card p-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-300">
            ExamPro authoring
          </p>
          <h2 className="mt-1 text-xl font-bold">Ebook Studio</h2>
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
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("content")}
            aria-pressed={tab === "content"}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold ${tab === "content" ? "bg-indigo-600 text-white" : ""}`}
          >
            Content & chapters
          </button>
          {owner && (
            <button
              type="button"
              onClick={() => setTab("access")}
              aria-pressed={tab === "access"}
              className={`rounded-xl border px-4 py-2 text-sm font-semibold ${tab === "access" ? "bg-indigo-600 text-white" : ""}`}
            >
              Access & collaborators (
              {requests.filter((r) => r.status === "pending").length})
            </button>
          )}
        </div>
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
                      {[
                        "Python",
                        "AI with Copilot",
                        "Java",
                        "Cloud & DevOps",
                      ].map((value) => (
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
                      {["Beginner to Pro", "Intermediate", "Advanced"].map(
                        (value) => (
                          <option key={value}>{value}</option>
                        ),
                      )}
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
                      <Field
                        label="Lesson Markdown"
                        hint="Headings, paragraphs, lists, inline code and fenced code blocks are supported. HTML is displayed as text."
                      >
                        <textarea
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
                          {["python", "java", "typescript", "bash", "json"].map(
                            (value) => (
                              <option key={value}>{value}</option>
                            ),
                          )}
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
                                        ? { ...q, question: event.target.value }
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
                                      conceptChecks: chapter.conceptChecks.map(
                                        (q, i) =>
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
                                            answer: Number(event.target.value),
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
                  hint="One row per question: question | A | B | C | D | correct letter | explanation"
                >
                  <textarea
                    rows={8}
                    className={`${input} font-mono text-xs`}
                    value={bulk}
                    onChange={(event) => setBulk(event.target.value)}
                  />
                </Field>
                <p className="text-xs text-muted-foreground">
                  {parseBulk(bulk).rows.length} valid question rows. Save
                  validates chapters, checks and answers on the server.
                </p>
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
              </>
            )}
          </>
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
                {book?.title ||
                  "Select a saved ebook in Content & chapters first."}
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
