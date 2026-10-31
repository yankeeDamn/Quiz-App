/* eslint-disable react-hooks/set-state-in-effect -- initialize account-scoped browser storage and refresh externally loaded data */
"use client";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Award,
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  LockKeyhole,
  Menu,
  PencilLine,
} from "lucide-react";
import { starterEbook } from "@/lib/ebooks-seed";
import {
  canEditEbook,
  ebookApi,
  readProgress,
  summarize,
  writeProgress,
  type EbookTrack,
  type EbookProgress,
  type EbookChapter,
} from "@/lib/ebooks";
import { CodeExample, LessonMarkdown } from "./lesson-content";
import { EbookShare } from "./ebook-share";
import { EbookStudio } from "./ebook-studio";
import { EbookAssessment } from "./ebook-assessment";
function ConceptCheck({
  chapter,
  onComplete,
  complete,
}: {
  chapter: EbookChapter;
  onComplete: () => void;
  complete: boolean;
}) {
  const [choices, setChoices] = useState<Record<number, number>>({}),
    [checked, setChecked] = useState(false);
  return (
    <section className="mt-8 rounded-2xl border p-5 sm:p-6">
      <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-300">
        Pause & recall
      </p>
      <h2 className="mt-2 text-xl font-bold">Chapter concept check</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Try both questions before marking the chapter complete.
      </p>
      <div className="mt-6 space-y-6">
        {chapter.conceptChecks.map((question, index) => (
          <fieldset key={index}>
            <legend className="mb-3 text-sm font-semibold leading-6">
              {index + 1}. {question.question}
            </legend>
            <div className="space-y-2">
              {question.options.map((option, oi) => (
                <label
                  key={oi}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm leading-6 ${checked && oi === question.answer ? "border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30" : ""}`}
                >
                  <input
                    className="mt-1.5 shrink-0"
                    type="radio"
                    name={`check-${chapter.id}-${index}`}
                    checked={choices[index] === oi}
                    onChange={() => {
                      setChoices((old) => ({ ...old, [index]: oi }));
                      setChecked(false);
                    }}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
            {checked && (
              <p className="mt-3 rounded-lg bg-muted/40 p-3 text-sm leading-6">
                {choices[index] === question.answer
                  ? "Correct. "
                  : "Review this one. "}
                {question.explanation}
              </p>
            )}
          </fieldset>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={Object.keys(choices).length !== 2}
          onClick={() => setChecked(true)}
          className="min-h-11 rounded-xl border px-4 text-sm font-semibold disabled:opacity-40"
        >
          Check answers
        </button>
        <button
          type="button"
          disabled={!checked && !complete}
          onClick={onComplete}
          className="min-h-11 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {complete
            ? "Continue to next chapter →"
            : "Mark Chapter Complete & Next →"}
        </button>
      </div>
    </section>
  );
}
export function EbookReader(props: {
  slug: string;
  initialChapter?: string;
  resumeId?: string;
}) {
  const { data: session } = useSession();
  const identity = session?.user?.email?.toLowerCase() || "guest";
  return (
    <ReaderSession
      key={`${props.slug}:${identity}`}
      {...props}
      identity={identity}
    />
  );
}
function ReaderSession({
  slug,
  initialChapter,
  resumeId,
  identity,
}: {
  slug: string;
  initialChapter?: string;
  resumeId?: string;
  identity: string;
}) {
  const fallback = starterEbook(slug);
  const [book, setBook] = useState<EbookTrack | null>(fallback || null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [code, setCode] = useState("");
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      fallback?.chapters.findIndex((c) => c.id === initialChapter) || 0,
    ),
  );
  const [progress, setProgress] = useState<EbookProgress>({
      completed: [],
      bookmark: null,
    }),
    [status, setStatus] = useState(""),
    [menu, setMenu] = useState(true),
    [studio, setStudio] = useState(false),
    [exam, setExam] = useState(!!resumeId),
    [note, setNote] = useState(""),
    [reload, setReload] = useState(0);
  const titleRef = useRef<HTMLHeadingElement>(null),
    writeQueue = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    let active = true;
    setProgress(readProgress(slug, identity));
    void ebookApi<{ ebook: EbookTrack }>(`/ebooks/${slug}`).then((result) => {
      if (!active) return;
      setLoading(false);
      if (result.data) {
        setBook(result.data.ebook);
        setError("");
        if (initialChapter)
          setIndex(
            Math.max(
              0,
              result.data.ebook.chapters.findIndex(
                (c) => c.id === initialChapter,
              ),
            ),
          );
      } else {
        const unavailable =
          !result.error?.status ||
          result.error.status >= 500 ||
          (result.error.status === 404 && !result.error.code);
        if (!fallback || !unavailable) setBook(null);
        setCode(result.error?.code || "");
        setError(
          unavailable && fallback
            ? "Reading the built-in public edition. Server saves, private books and verified assessments need the online API."
            : result.error?.message || "Could not load this ebook.",
        );
      }
    });
    if (identity !== "guest")
      void ebookApi<EbookProgress>(`/ebooks/${slug}/progress`).then(
        (result) => {
          if (!active || !result.data) return;
          const local = readProgress(slug, identity);
          const merged = {
            completed: [
              ...new Set([...result.data.completed, ...local.completed]),
            ],
            bookmark: local.bookmark || result.data.bookmark,
          };
          setProgress(merged);
          writeProgress(slug, identity, merged);
        },
      );
    return () => {
      active = false;
    };
  }, [slug, identity, reload, initialChapter, fallback]);
  const chapter = book?.chapters[Math.min(index, book.chapters.length - 1)];
  const ids = new Set(book?.chapters.map((c) => c.id) || []);
  const completeCount = progress.completed.filter((id) => ids.has(id)).length;
  const percent = book
    ? Math.round((completeCount / book.chapters.length) * 100)
    : 0;
  const navigate = (next: number) => {
    if (!book) return;
    const position = Math.max(0, Math.min(book.chapters.length - 1, next));
    setIndex(position);
    const url = new URL(window.location.href);
    url.searchParams.set("chapter", book.chapters[position].id);
    url.searchParams.delete("attempt");
    window.history.replaceState(window.history.state, "", url);
    requestAnimationFrame(() => titleRef.current?.focus());
  };
  const saveProgress = (next: EbookProgress) => {
    const clean = {
      ...next,
      bookmark: next.bookmark && ids.has(next.bookmark) ? next.bookmark : null,
      completed: next.completed.filter((id) => ids.has(id)),
    };
    setProgress(clean);
    writeProgress(slug, identity, clean);
    if (identity === "guest") {
      setStatus(
        "Progress saved on this device. Sign in to sync across devices.",
      );
      return;
    }
    setStatus("Saving progress…");
    writeQueue.current = writeQueue.current.then(async () => {
      const result = await ebookApi(`/ebooks/${slug}/progress`, {
        method: "PUT",
        body: clean,
      });
      setStatus(
        result.success
          ? "Progress synced to your account."
          : "Saved on this device; server sync is unavailable.",
      );
    });
  };
  if (!book)
    return (
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-16">
        <div className="rounded-2xl border bg-card p-7">
          <LockKeyhole className="h-9 w-9 text-indigo-600" />
          <h1 className="mt-4 text-2xl font-bold">
            {loading
              ? "Opening learning track…"
              : code === "EBOOK_ACCESS_REQUIRED"
                ? "Access Restricted — Request Admin Approval"
                : "Ebook unavailable"}
          </h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {error || "Checking access with the server."}
          </p>
          {code === "EBOOK_ACCESS_REQUIRED" &&
            (identity === "guest" ? (
              <Link
                className="mt-5 inline-block font-semibold text-indigo-600 underline"
                href={`/auth/signin?callbackUrl=${encodeURIComponent("/certifications/learn/" + slug)}`}
              >
                Sign in with Google or GitHub to request access
              </Link>
            ) : (
              <form
                className="mt-5 space-y-3"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const result = await ebookApi(
                    `/ebooks/${slug}/request-access`,
                    { method: "POST", body: { note } },
                  );
                  setStatus(
                    result.success
                      ? "Request received. The owner must approve access before you can read this ebook."
                      : result.error?.message || "Request failed.",
                  );
                }}
              >
                <p className="break-all text-xs text-muted-foreground">
                  Requesting as your verified account: {identity}
                </p>
                <label className="grid gap-2 text-sm font-semibold">
                  Note to the owner
                  <textarea
                    value={note}
                    maxLength={1000}
                    onChange={(event) => setNote(event.target.value)}
                    className="rounded-xl border bg-background p-3 font-normal"
                  />
                </label>
                <button
                  type="submit"
                  className="min-h-11 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white"
                >
                  Request Access
                </button>
              </form>
            ))}
          <p role="status" className="mt-3 text-sm">
            {status}
          </p>
          <Link
            href="/certifications?tab=start-learning"
            className="mt-6 inline-block text-sm underline"
          >
            Back to Start Learning
          </Link>
        </div>
      </main>
    );
  if (!chapter) return null;
  return (
    <main className="w-full min-w-0 flex-1 bg-muted/15">
      <div className="mx-auto grid max-w-[1600px] min-w-0 xl:grid-cols-[230px_minmax(0,1fr)_210px]">
        <aside className="min-w-0 border-b bg-card xl:border-b-0 xl:border-r">
          <div className="p-5 xl:sticky xl:top-20">
            <Link
              href="/certifications?tab=start-learning"
              className="inline-flex min-h-10 items-center gap-1 text-xs font-semibold text-muted-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              All learning tracks
            </Link>
            <p className="mt-4 text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-300">
              {book.category}
            </p>
            <h2 className="mt-2 text-base font-bold leading-6">{book.title}</h2>
            <div className="my-5">
              <p className="mb-2 text-xs text-muted-foreground">
                {completeCount} / {book.chapters.length} chapters completed ·{" "}
                {percent}%
              </p>
              <progress
                aria-label="Ebook completion"
                value={percent}
                max={100}
                className="h-1.5 w-full accent-emerald-600"
              />
            </div>
            <button
              type="button"
              onClick={() => setMenu(!menu)}
              aria-expanded={menu}
              aria-controls="chapter-tree"
              className="flex min-h-10 w-full items-center justify-between text-xs font-bold uppercase tracking-widest"
            >
              Chapters
              <Menu className="h-4 w-4" />
            </button>
            {menu && (
              <nav
                id="chapter-tree"
                aria-label="Ebook chapters"
                className="mt-3 space-y-1"
              >
                {book.chapters.map((value, ci) => (
                  <button
                    key={value.id}
                    type="button"
                    aria-current={chapter.id === value.id ? "step" : undefined}
                    onClick={() => navigate(ci)}
                    className={`flex min-h-12 w-full items-start gap-3 rounded-xl p-3 text-left text-xs leading-5 ${chapter.id === value.id ? "bg-indigo-50 font-semibold text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-200" : "text-muted-foreground hover:bg-muted"}`}
                  >
                    {progress.completed.includes(value.id) ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px]">
                        {ci + 1}
                      </span>
                    )}
                    <span>{value.title}</span>
                  </button>
                ))}
              </nav>
            )}
            <div className="mt-6 rounded-xl border bg-muted/30 p-4">
              <Award className="h-6 w-6 text-indigo-600" />
              <h3 className="mt-3 text-sm font-bold">Final skill assessment</h3>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                {percent >= 80
                  ? "You have reached the reading milestone."
                  : "Complete 80% of chapters, or challenge the exam whenever you are ready."}
              </p>
              <button
                type="button"
                className="mt-3 min-h-10 w-full rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white"
                onClick={() => setExam(true)}
              >
                {percent >= 80
                  ? "Start Certification Exam"
                  : "Challenge Final Exam Now"}
              </button>
            </div>
          </div>
        </aside>
        <article className="min-w-0 bg-background px-5 py-8 sm:px-10 lg:px-14">
          <nav
            aria-label="Breadcrumb"
            className="mb-7 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground"
          >
            <Link href="/certifications">Build your IT career</Link>
            <span>›</span>
            <Link href="/certifications?tab=start-learning">
              Start Learning
            </Link>
            <span>›</span>
            <span>{book.category}</span>
            <span>› Chapter {index + 1}</span>
          </nav>
          {error && (
            <p
              role="status"
              className="mb-6 rounded-xl border border-amber-300 p-4 text-xs leading-6"
            >
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-300">
              Chapter {index + 1} of {book.chapters.length}
            </p>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" />
              {chapter.durationMinutes} min read
            </span>
          </div>
          <h1
            ref={titleRef}
            tabIndex={-1}
            className="mt-4 text-3xl font-bold leading-tight tracking-tight focus:outline-none sm:text-4xl"
          >
            {chapter.title}
          </h1>
          <p className="mt-4 border-b pb-7 text-base leading-8 text-muted-foreground">
            {chapter.summary}
          </p>
          <div className="mt-6">
            <LessonMarkdown content={chapter.contentMarkdown} />
            {chapter.codeSnippet && (
              <CodeExample key={chapter.id} {...chapter.codeSnippet} />
            )}
          </div>
          <section className="mt-8 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-6 dark:border-indigo-900 dark:bg-indigo-950/25">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-300">
              Interview cheat-sheet
            </p>
            <h2 className="mt-2 text-xl font-bold">Key takeaways</h2>
            <ul className="mt-4 space-y-3">
              {chapter.keyTakeaways.map((tip, ti) => (
                <li
                  key={ti}
                  className="flex items-start gap-3 text-sm leading-7"
                >
                  <CheckCircle2 className="mt-1.5 h-4 w-4 shrink-0 text-indigo-600" />
                  {tip}
                </li>
              ))}
            </ul>
          </section>
          <ConceptCheck
            key={chapter.id}
            chapter={chapter}
            complete={progress.completed.includes(chapter.id)}
            onComplete={() => {
              saveProgress({
                ...progress,
                completed: [...new Set([...progress.completed, chapter.id])],
              });
              if (index < book.chapters.length - 1) navigate(index + 1);
              else setExam(true);
            }}
          />
          <p role="status" className="mt-4 text-xs text-muted-foreground">
            {status}
          </p>
          <div className="mt-6 flex justify-between gap-3">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => navigate(index - 1)}
              className="min-h-10 text-sm font-semibold disabled:opacity-30"
            >
              ← Previous chapter
            </button>
            <button
              type="button"
              disabled={index === book.chapters.length - 1}
              onClick={() => navigate(index + 1)}
              className="min-h-10 text-sm font-semibold disabled:opacity-30"
            >
              Next chapter →
            </button>
          </div>
          {!!book.references?.length && (
            <details className="mt-8 rounded-xl border p-4">
              <summary className="cursor-pointer text-xs font-semibold">
                Official documentation for further study
              </summary>
              <ul className="mt-3 space-y-2">
                {book.references.map((link) => (
                  <li key={link}>
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-xs text-indigo-600 underline dark:text-indigo-300"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </article>
        <aside className="min-w-0 border-t bg-card xl:border-l xl:border-t-0">
          <div className="space-y-5 p-5 xl:sticky xl:top-20">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Your learning space
              </p>
              <p className="mt-4 text-3xl font-bold tabular-nums">{percent}%</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Reading progress
              </p>
            </div>
            <button
              type="button"
              aria-pressed={progress.bookmark === chapter.id}
              onClick={() =>
                saveProgress({
                  ...progress,
                  bookmark:
                    progress.bookmark === chapter.id ? null : chapter.id,
                })
              }
              className="flex min-h-11 w-full items-center gap-2 rounded-xl border p-3 text-xs font-semibold"
            >
              <Bookmark
                className={`h-4 w-4 ${progress.bookmark === chapter.id ? "fill-indigo-600 text-indigo-600" : ""}`}
              />
              {progress.bookmark === chapter.id
                ? "Bookmarked"
                : "Bookmark chapter"}
            </button>
            {progress.bookmark && ids.has(progress.bookmark) && (
              <button
                type="button"
                className="min-h-10 text-xs underline"
                onClick={() =>
                  navigate(
                    book.chapters.findIndex((c) => c.id === progress.bookmark),
                  )
                }
              >
                Go to bookmark
              </button>
            )}
            <div className="border-t pt-4">
              <EbookShare book={book} chapter={chapter.id} />
              <EbookShare book={book} />
            </div>
            {canEditEbook(book) && (
              <button
                type="button"
                onClick={() => setStudio(true)}
                className="flex min-h-11 items-center gap-2 rounded-xl border px-3 text-xs font-semibold"
              >
                <PencilLine className="h-4 w-4" />
                Quick-edit chapter
              </button>
            )}
            <p className="border-t pt-4 text-xs leading-6 text-muted-foreground">
              {identity === "guest"
                ? "Sign in to sync progress and save final assessment results."
                : "Progress is associated with your signed-in account."}
            </p>
          </div>
        </aside>
      </div>
      {studio && canEditEbook(book) && (
        <EbookStudio
          identity={identity}
          owner={book.permissions?.canManageAccess === true}
          summaries={[summarize(book)]}
          initialBook={book}
          initialChapterId={chapter.id}
          onClose={() => setStudio(false)}
          onSaved={() => setReload((value) => value + 1)}
        />
      )}{" "}
      {exam && (
        <EbookAssessment
          key={identity}
          book={book}
          resumeId={resumeId}
          onClose={() => setExam(false)}
        />
      )}
    </main>
  );
}
