"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { BookOpen, CheckCircle2, Clock3, LockKeyhole } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import {
  study,
  type StudyPlan,
  type StudyCatalogue,
  type StudyTrack,
  type StudyDay,
  type StudyQuestion,
} from "@/lib/study-plans";
import { admin } from "@/lib/admin";
const card = "rounded-2xl border bg-card p-5 shadow-sm";
export function StudyPage({
  slug,
  day,
  previewId,
}: {
  slug?: string;
  day?: number;
  previewId?: string;
}) {
  const { data: session, status } = useSession();
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-12">
        <StudyContent
          key={`${session?.user?.email || status}:${slug}:${day}:${previewId}`}
          slug={slug}
          day={day}
          previewId={previewId}
        />
      </main>
      <Footer />
    </>
  );
}
function StudyContent({
  slug,
  day,
  previewId,
}: {
  slug?: string;
  day?: number;
  previewId?: string;
}) {
  const [catalogue, setCatalogue] = useState<StudyCatalogue | null>(null);
  const [plan, setPlan] = useState<StudyPlan | null>(null),
    [daily, setDaily] = useState<StudyDay | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0),
    [start, setStart] = useState(() => new Date().toLocaleDateString("en-CA"));
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setError("");
        if (previewId) {
          const r = await admin<StudyPlan>(
            `/study-plans/plans/${previewId}/preview`,
          );
          if (!r.ok) throw Error(r.message);
          if (!cancelled) setPlan(r.data);
          if (day) {
            const d = await admin<StudyDay>(
              `/study-plans/plans/${previewId}/preview/day/${day}`,
            );
            if (!d.ok) throw Error(d.message);
            if (!cancelled) setDaily(d.data);
          }
        } else if (slug) {
          const p = await study<StudyPlan>("/" + slug);
          if (!cancelled) setPlan(p);
          if (day) {
            const d = await study<StudyDay>(`/${slug}/day/${day}`);
            if (!cancelled) setDaily(d);
          }
        } else {
          const c = await study<StudyCatalogue>("");
          if (!cancelled) setCatalogue(c);
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Unable to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug, day, version, previewId]);
  async function mutate(path: string, method: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      await study(path, method, body);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  }
  const link = (n?: number) =>
    previewId
      ? `/admin/study-plans/preview/${previewId}${n ? `?day=${n}` : ""}`
      : `/study-plans/${slug}${n ? `/day/${n}` : ""}`;
  return (
    <div className="space-y-7">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-accent-ink">
          ExamPro • Learn with a plan
        </p>
        <h1 className="text-3xl font-bold sm:text-4xl">
          {plan?.title || "Study Plans"}
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          {plan?.description ||
            "Build a steady routine with syllabus topics, guided practice and revision. Your progress stays with your account."}
        </p>
      </div>
      {previewId && (
        <p className="rounded-xl bg-amber-100 p-4 text-amber-950">
          Administrator preview · This does not publish content or record
          student progress.
        </p>
      )}
      {error && (
        <div role="alert" className="rounded-xl border border-red-300 p-4">
          <p>{error}</p>
          <Button
            variant="outline"
            onClick={() => {
              setError("");
              setVersion((v) => v + 1);
            }}
          >
            Retry
          </Button>{" "}
          <Link href="/auth/signin">Sign in</Link>
        </div>
      )}
      {loading && <p role="status">Loading study plans…</p>}
      {catalogue && <StudyCatalogueView catalogue={catalogue} />}
      {plan && (
        <>
          <nav className="flex gap-4 text-sm">
            <Link href="/study-plans" className="underline">
              All study plans
            </Link>
            {day && (
              <Link href={link()} className="underline">
                Plan overview
              </Link>
            )}
          </nav>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-muted px-3 py-2">
              {plan.name} · {plan.syllabus_version}
            </span>
            <span className="rounded-full bg-muted px-3 py-2">
              {plan.duration} days
            </span>
            <span className="flex items-center gap-2 rounded-full bg-muted px-3 py-2">
              <Clock3 size={16} />
              {plan.daily_minutes} min/day
            </span>
            <span className="rounded-full bg-muted px-3 py-2">
              {plan.access ? "Access available" : "Free preview"}
            </span>
          </div>
          {!plan.access && (
            <div className={card}>
              <LockKeyhole className="mb-2 text-accent-ink" />
              <h2 className="font-bold">Continue your preparation with Pro</h2>
              <p className="my-2 text-sm">
                Explore the selected free tasks. Full guidance and progress
                tracking require an active Pro subscription.
              </p>
              <Button asChild>
                <Link href="/pricing">View Pro subscriptions</Link>
              </Button>
            </div>
          )}
          {!previewId && plan.access && !plan.progress && (
            <div className={card}>
              <h2 className="mb-3 font-bold">Choose your start date</h2>
              <label className="mr-4 text-sm">
                Start date{" "}
                <input
                  className="ml-2 rounded border bg-background p-2"
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <Button
                disabled={busy}
                onClick={() =>
                  mutate(`/${slug}/enroll`, "POST", { start_date: start })
                }
              >
                Start this plan
              </Button>
              <p className="mt-3 text-sm text-muted-foreground">
                Missed a day? Resume whenever you are ready. Later days stay
                available.
              </p>
            </div>
          )}
          {plan.progress && (
            <section className={card} aria-label="Your progress">
              <div className="flex justify-between">
                <h2 className="font-bold">Your progress</h2>
                <strong>{plan.progress.percentage}%</strong>
              </div>
              <progress
                className="my-3 h-3 w-full accent-indigo-600"
                max={100}
                value={plan.progress.percentage}
              />
              <p className="text-sm">
                {plan.progress.completed} required tasks completed ·{" "}
                {plan.progress.pending} pending ·{" "}
                {plan.progress.completedDays.length} days completed
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Started{" "}
                {String(plan.progress.enrollment.start_date).slice(0, 10)} ·
                Current day {plan.progress.enrollment.current_day}
              </p>
              {!day && (
                <Button className="mt-4" asChild>
                  <Link
                    href={link(
                      plan.days.find(
                        (d) => !plan.progress?.completedDays.includes(d.day),
                      )?.day || 1,
                    )}
                  >
                    Resume next study day
                  </Link>
                </Button>
              )}
              {!!plan.progress.results.length && (
                <p className="mt-3 text-sm">
                  {plan.progress.results.length} linked mock results recorded.{" "}
                  <Link className="underline" href="/dashboard">
                    View results
                  </Link>
                </p>
              )}
            </section>
          )}
          {!day && (
            <>
              <section className={card}>
                <h2 className="font-bold">Subjects & weekly goals</h2>
                <p className="mt-2">
                  {plan.subjects
                    .map((s) => (typeof s === "string" ? s : s.name))
                    .join(" · ") ||
                    "See daily tasks for the published subject breakdown."}
                </p>
                {plan.weekly_goals && (
                  <p className="mt-3 whitespace-pre-wrap text-sm">
                    {plan.weekly_goals}
                  </p>
                )}
                {plan.milestones?.map((m, i) => (
                  <p key={i} className="mt-2 text-sm">
                    Day {m.day} · {m.kind}: {m.title}
                  </p>
                ))}
                {plan.completion_criteria && (
                  <p className="mt-3 text-sm">
                    Completion: {plan.completion_criteria}
                  </p>
                )}
              </section>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {plan.days.map((d) => (
                  <Link
                    key={d.day}
                    href={link(d.day)}
                    className={card + " transition hover:border-accent-ink"}
                  >
                    <h2 className="font-bold">
                      Day {d.day}{" "}
                      {plan.progress?.completedDays.includes(d.day) && (
                        <CheckCircle2
                          className="inline text-emerald-600"
                          size={18}
                        />
                      )}
                    </h2>
                    <p className="my-2 text-sm">{d.objectives}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.tasks} tasks · {d.previews} free preview tasks
                    </p>
                  </Link>
                ))}
              </div>
            </>
          )}
          {daily && (
            <section className="space-y-4">
              <h2 className="text-2xl font-bold">Day {daily.day}</h2>
              <p className="whitespace-pre-wrap text-muted-foreground">
                {daily.objectives}
              </p>
              {!daily.tasks.length && (
                <p className={card}>
                  This day requires Pro access. Choose another day with a free
                  preview or view subscriptions.
                </p>
              )}
              {daily.tasks.map((t, i) => (
                <article key={t.id} className={card}>
                  <p className="mb-2 text-xs font-semibold uppercase text-accent-ink">
                    {i + 1} · {t.kind} · {t.minutes} min ·{" "}
                    {t.required ? "Required" : "Optional"}
                  </p>
                  <h3 className="text-lg font-bold">{t.title}</h3>
                  <p className="my-3 whitespace-pre-wrap text-sm leading-6">
                    {t.description}
                  </p>
                  {t.resource && previewId && (
                    <p className="my-3 rounded-lg border p-3 text-sm">Linked resource: {t.resource.title} · Preview only; student download is not enabled here.</p>
                  )}
                  {t.resource && !previewId && (
                    <div className="my-4 flex flex-wrap gap-4 text-sm">
                      <a
                        className="underline"
                        href={`/api/study-plans/${slug}/tasks/${t.id}/resource`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Read: {t.resource.title}
                      </a>
                      <a
                        className="underline"
                        href={`/api/study-plans/${slug}/tasks/${t.id}/resource?download=1`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Download permitted PDF
                      </a>
                    </div>
                  )}
                  {t.mock_id && previewId && (
                    <p className="my-3 rounded-lg border p-3 text-sm">Linked mock: {t.mock_id} · Preview only; availability is checked before publication.</p>
                  )}
                  {t.mock_id && !previewId && (
                    <Link
                      className="my-3 inline-block text-sm underline"
                      href={`/exampro?test=${encodeURIComponent(t.mock_id)}`}
                    >
                      Open assigned mock / quiz
                    </Link>
                  )}
                  {t.questions.map((q) => (
                    <Question
                      key={q.id}
                      q={q}
                      path={`/${slug}/tasks/${t.id}/questions/${q.id}/answer`}
                      preview={!!previewId}
                    />
                  ))}
                  {!previewId && plan.progress && plan.access && (
                    <label className="mt-4 flex min-h-11 items-center gap-3 text-sm font-semibold">
                      <input
                        type="checkbox"
                        disabled={busy}
                        checked={plan.progress.completions.some(
                          (c) => c.task_id === t.id,
                        )}
                        onChange={(e) =>
                          mutate(`/${slug}/tasks/${t.id}/complete`, "PUT", {
                            completed: e.target.checked,
                          })
                        }
                      />
                      Mark task complete
                    </label>
                  )}
                </article>
              ))}
              <nav className="flex justify-between">
                {day && day > 1 ? (
                  <Button variant="outline" asChild>
                    <Link href={link(day - 1)}>Previous day</Link>
                  </Button>
                ) : (
                  <span />
                )}
                {day && day < plan.duration && (
                  <Button asChild>
                    <Link href={link(day + 1)}>Next day</Link>
                  </Button>
                )}
              </nav>
            </section>
          )}
        </>
      )}
    </div>
  );
}
function Question({
  q,
  path,
  preview,
}: {
  q: StudyQuestion;
  path: string;
  preview: boolean;
}) {
  const [answer, setAnswer] = useState<number | null>(null),
    [result, setResult] = useState<{
      correct: boolean;
      answer: number;
      explanation: string;
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <fieldset className="my-4 rounded-xl border p-4">
      <legend className="px-2 text-sm font-semibold">Practice question</legend>
      <p className="mb-3">{q.question}</p>
      {q.options.map((o, i) => (
        <label key={i} className="flex min-h-10 items-center gap-3 text-sm">
          <input
            type="radio"
            name={q.id}
            checked={answer === i}
            onChange={() => {
              setAnswer(i);
              setResult(null);
            }}
          />
          {o}
        </label>
      ))}
      <Button
        className="mt-3"
        disabled={preview || answer === null || busy}
        onClick={async () => {
          setBusy(true);
          try {
            setResult(await study(path, "POST", { answer }));
          } catch (e) {
            setError(e instanceof Error ? e.message : "Unable to check answer");
          } finally {
            setBusy(false);
          }
        }}
      >
        Check answer
      </Button>
      {result && (
        <p className="mt-3 text-sm" role="status">
          {result.correct
            ? "Correct."
            : `Correct answer: ${q.options[result.answer]}.`}{" "}
          {result.explanation}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </fieldset>
  );
}

const catalogueTracks: { id: StudyTrack; title: string; description: string }[] = [
  { id: "government-exams", title: "Government Exams", description: "Structured preparation for competitive and recruitment examinations." },
  { id: "it-certifications", title: "IT Certifications", description: "Build job-ready skills in cloud, endpoint administration, AI-assisted development, project management and information security." },
];

function StudyCatalogueView({ catalogue }: { catalogue: StudyCatalogue }) {
  const [track, setTrack] = useState<StudyTrack>("government-exams");
  const matches = (item: { track?: StudyTrack }, id: StudyTrack) =>
    (item.track || "government-exams") === id;
  const plans = catalogue.plans.filter((p) => matches(p, track));
  const upcoming = catalogue.upcoming.filter((p) => matches(p, track));
  const selected = catalogueTracks.find((item) => item.id === track)!;
  return (
    <div className="space-y-6">
      <nav aria-label="Study plan categories" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {catalogueTracks.map((item) => {
          const count = catalogue.plans.filter((p) => matches(p, item.id)).length +
            catalogue.upcoming.filter((p) => matches(p, item.id)).length;
          return (
            <button key={item.id} type="button" aria-pressed={track === item.id}
              onClick={() => setTrack(item.id)}
              className={"rounded-xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring " +
                (track === item.id ? "border-accent-ink bg-primary text-primary-foreground shadow-sm" : "bg-card hover:border-accent-ink")}>
              <span className="block text-lg font-bold">{item.title}</span>
              <span className="mt-1 block text-sm">{count} {count === 1 ? "programme" : "programmes"}</span>
            </button>
          );
        })}
      </nav>
      <section aria-labelledby="study-track-heading" className="space-y-4">
        <div>
          <h2 id="study-track-heading" className="text-2xl font-bold">{selected.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{selected.description}</p>
        </div>
        {plans.length + upcoming.length === 0 ? (
          <p className={card}>No programmes are available in this category yet.</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
          {plans.map((p) => (
            <article key={p.id} className={card}>
              <BookOpen className="mb-4 text-accent-ink" />
              <p className="text-sm text-muted-foreground">{p.name}</p>
              <h3 className="text-xl font-bold">{p.title}</h3>
              <p className="my-3 text-sm">{p.description}</p>
              <p className="text-sm">
                {p.duration} days · {p.modules} published tasks ·{" "}
                {p.daily_minutes} min/day
              </p>
              <p className="my-2 text-sm text-muted-foreground">
                {p.subjects
                  .map((s) => (typeof s === "string" ? s : s.name))
                  .join(" · ")}
              </p>
              <p className="mb-4 text-sm">
                {p.preview ? "Free preview available" : "No free preview"} ·{" "}
                {p.access_policy === "pro" ? "Pro required" : "Free plan"}
              </p>
              <Button asChild>
                <Link href={"/study-plans/" + p.slug}>Open plan</Link>
              </Button>
              {!p.access && (
                <Link className="ml-4 text-sm underline" href="/pricing">
                  View Pro plans
                </Link>
              )}
            </article>
          ))}
          {upcoming.map((p) => (
            <article key={p.id} className={card}>
              <p className="mb-4 inline-block rounded-full bg-muted px-3 py-1 text-xs font-semibold">
                Upcoming
              </p>
              {p.provider && <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{p.provider}</p>}
              <h3 className="text-xl font-bold">{p.name}</h3>
              <p className="mt-3 text-sm text-muted-foreground">
                {p.description}
              </p>
              <p className="mt-4 text-sm">
                Duration, subjects and free preview will be announced after
                content review.
              </p>
            </article>
          ))}

          </div>
        )}
      </section>
    </div>
  );
}
