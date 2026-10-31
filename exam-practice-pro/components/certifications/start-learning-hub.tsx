/* eslint-disable react-hooks/set-state-in-effect -- initialize account-scoped browser storage and refresh externally loaded data */
"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  Clock3,
  Code2,
  Layers3,
  Search,
  Settings2,
} from "lucide-react";
import { STARTER_EBOOKS } from "@/lib/ebooks-seed";
import {
  EBOOK_CATEGORIES,
  ebookApi,
  readProgress,
  summarize,
  type EbookSummary,
} from "@/lib/ebooks";
import { EbookShare } from "./ebook-share";
import { EbookStudio } from "./ebook-studio";
const STARTERS = STARTER_EBOOKS.map(summarize);
const FILTERS = ["All Tracks", ...EBOOK_CATEGORIES];
const covers: Record<string, string> = {
  Python: "from-emerald-600 to-teal-800",
  "Python & Cheatcodes": "from-teal-600 to-cyan-900",
  "Machine Learning": "from-blue-600 to-indigo-900",
  "LLMs & Hugging Face": "from-amber-600 to-orange-900",
  "GitHub Copilot (GH-300)": "from-violet-600 to-fuchsia-900",
  "Endpoint Admin (MD-102)": "from-sky-600 to-blue-900",
  "AI with Copilot": "from-violet-600 to-indigo-900",
  Java: "from-orange-600 to-rose-800",
  "Cloud & DevOps": "from-sky-600 to-indigo-800",
};
export function StartLearningHub() {
  const { data: session } = useSession();
  const identity = session?.user?.email?.toLowerCase() || "guest";
  const [state, setState] = useState<{
    identity: string;
    books: EbookSummary[];
    owner: boolean;
    error: string;
  }>({ identity: "guest", books: STARTERS, owner: false, error: "" });
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("All Tracks"),
    [studio, setStudio] = useState(false),
    [version, setVersion] = useState(0);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const books = state.identity === identity ? state.books : STARTERS;
  const owner = state.identity === identity && state.owner;
  useEffect(() => {
    let active = true;
    void Promise.all([
      ebookApi<{ ebooks: EbookSummary[] }>("/ebooks"),
      ebookApi<{ isOwnerAdmin: boolean }>("/ebooks/capabilities"),
    ]).then(([result, capabilities]) => {
      if (active)
        setState({
          identity,
          owner: capabilities.data?.isOwnerAdmin === true,
          books: result.success && result.data ? result.data.ebooks : STARTERS,
          error: result.success
            ? ""
            : "Showing built-in starters. Custom books and publishing need the online API.",
        });
    });
    return () => {
      active = false;
    };
  }, [identity, version]);
  useEffect(() => {
    const values: Record<string, number> = {};
    for (const book of books)
      values[book.slug] = Math.min(
        100,
        Math.round(
          (readProgress(book.slug, identity).completed.length /
            book.chapterCount) *
            100,
        ),
      );
    setProgress(values);
  }, [books, identity]);
  const filtered = books.filter(
    (book) =>
      (category === "All Tracks" ||
        book.category ===
          (category === "AI & Copilot" ? "AI with Copilot" : category)) &&
      `${book.title} ${book.slug} ${book.subtitle} ${book.category}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const canManage = owner || books.some((book) => book.permissions?.canEdit);
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300">
            Read. Build. Put it to the test.
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight">
            Your next skill starts here.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Guided ebooks with code walkthroughs, quick concept checks and a
            final skill assessment. Learn at your pace, one chapter at a time.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setStudio(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-card px-4 text-sm font-semibold hover:bg-muted"
          >
            <Settings2 className="h-4 w-4" />
            Manage & Publish Ebooks
          </button>
        )}
      </div>
      <div className="flex flex-col gap-4 rounded-2xl border bg-muted/20 p-4 sm:p-5">
        <label className="flex items-center gap-3 rounded-xl border bg-background px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            aria-label="Search ebooks"
            type="search"
            placeholder="What do you want to learn?"
            className="w-full bg-transparent text-sm outline-none"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              aria-pressed={category === filter}
              onClick={() => setCategory(filter)}
              className={`min-h-10 rounded-full px-4 text-xs font-semibold transition-colors ${category === filter ? "bg-indigo-600 text-white" : "border bg-background hover:bg-muted"}`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>
      {state.identity === identity && state.error && (
        <p
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50/50 p-4 text-sm dark:bg-amber-950/20"
        >
          {state.error}
        </p>
      )}
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((book) => (
          <article
            key={book.slug}
            className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-lg hover:shadow-indigo-500/5"
          >
            <div
              className={`relative flex min-h-44 flex-col justify-between bg-gradient-to-br ${covers[book.category]} p-6 text-white`}
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] font-semibold">
                  {book.category}
                </span>
                <Code2 className="h-7 w-7 opacity-70" />
              </div>
              <div className="mt-7 flex items-end justify-between">
                <p className="text-2xl font-bold tracking-tight">
                  {book.category === "AI with Copilot"
                    ? "AI + Copilot"
                    : book.category === "Python"
                      ? "Python 3"
                      : book.category === "Java"
                        ? "Java 21"
                        : book.category}
                </p>
                <BookOpen className="h-8 w-8 opacity-60" />
              </div>
            </div>
            <div className="flex flex-1 flex-col p-6">
              <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                <span>{book.level}</span>
                {book.examBadgeCode && (
                  <span className="rounded bg-indigo-50 px-2 dark:bg-indigo-950">
                    {book.examBadgeCode}
                  </span>
                )}
                {book.visibility !== "public" && (
                  <span className="rounded bg-amber-100 px-2 text-amber-900">
                    {book.visibility === "admin_only"
                      ? "Private draft"
                      : "Approved access"}
                  </span>
                )}
              </div>
              <h3 className="mt-3 text-xl font-bold leading-snug">
                {book.title}
              </h3>
              <p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">
                {book.subtitle}
              </p>
              <div className="mt-5 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Layers3 className="h-3.5 w-3.5" />
                  {book.chapterCount} chapters
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5" />
                  {book.durationMinutes} min
                </span>
              </div>
              {book.allowPdfDownload !== false && (
                <Link
                  href={`/certifications/learn/${book.slug}?view=pdf`}
                  className="mt-4 text-xs font-semibold text-indigo-600 dark:text-indigo-300"
                >
                  {book.isCheatSheet
                    ? "Printable ebook + cheat-sheet ↗"
                    : "Printable PDF edition ↗"}
                </Link>
              )}
              <div className="mt-5">
                <div className="mb-2 flex justify-between text-xs">
                  <span className="text-muted-foreground">
                    Reading progress on this device
                  </span>
                  <strong>{progress[book.slug] || 0}%</strong>
                </div>
                <progress
                  aria-label={`${book.title} reading progress`}
                  max={100}
                  value={progress[book.slug] || 0}
                  className="h-1.5 w-full accent-indigo-600"
                />
              </div>
              <div className="mt-5 flex items-center justify-between gap-2">
                <Link
                  href={`/certifications/learn/${book.slug}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  {progress[book.slug] ? "Continue learning" : "Start Learning"}
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <EbookShare book={book} />
              </div>
            </div>
          </article>
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-4 font-bold">No matching ebooks yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Try another category or a shorter search.
          </p>
        </div>
      )}
      <p className="text-xs leading-6 text-muted-foreground">
        Original ExamPro learning material. Skill completion certificates
        recognize an ExamPro assessment; they are not vendor-issued or
        accredited certifications.
      </p>
      {studio && canManage && (
        <EbookStudio
          key={identity}
          identity={identity}
          owner={owner}
          summaries={books.filter((book) => owner || book.permissions?.canEdit)}
          onClose={() => setStudio(false)}
          onSaved={() => setVersion((value) => value + 1)}
        />
      )}
    </div>
  );
}
