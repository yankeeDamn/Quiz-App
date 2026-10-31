"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Award, Clock3, X } from "lucide-react";
import { ExamEngine } from "@/components/mocks/exam-engine";
import { buildCertTest } from "@/lib/it-certs";
import {
  ebookApi,
  practiceTest,
  type EbookTrack,
  type EbookQuestion,
  type EbookExam,
} from "@/lib/ebooks";
export function EbookAssessment({
  book,
  resumeId,
  onClose,
}: {
  book: EbookTrack;
  resumeId?: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    queue = useRef<Promise<void>>(Promise.resolve());
  const { data: session } = useSession();
  const [attempt, setAttempt] = useState<EbookExam | null>(null),
    [practice, setPractice] = useState<EbookQuestion[] | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [negative, setNegative] = useState((book.negativeMarks ?? 0) > 0),
    [index, setIndex] = useState(0),
    [remaining, setRemaining] = useState(0),
    [answers, setAnswers] = useState<Record<string, number>>({}),
    [shared, setShared] = useState("");
  const offset = useRef(0),
    sent = useRef(false),
    submitRef = useRef<() => void>(() => {});
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const accept = (value: EbookExam) => {
    setAttempt(value);
    setAnswers(value.answers);
    offset.current = Date.parse(value.serverNow) - Date.now();
    setRemaining(
      Math.max(
        0,
        Math.ceil(
          (Date.parse(value.expiresAt) - Date.now() - offset.current) / 1000,
        ),
      ),
    );
  };
  useEffect(() => {
    if (!resumeId) return;
    let active = true;
    void ebookApi<{ attempt: EbookExam }>(`/ebooks/attempts/${resumeId}`).then(
      (result) => {
        if (!active) return;
        if (result.data) accept(result.data.attempt);
        else setError(result.error?.message || "Could not resume exam.");
      },
    );
    return () => {
      active = false;
    };
  }, [resumeId]);
  useEffect(() => {
    if (!attempt || attempt.result) return;
    const tick = () => {
      const seconds = Math.max(
        0,
        Math.ceil(
          (Date.parse(attempt.expiresAt) - Date.now() - offset.current) / 1000,
        ),
      );
      setRemaining(seconds);
      if (seconds === 0 && !sent.current) {
        sent.current = true;
        submitRef.current();
      }
    };
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [attempt]);
  const submit = async () => {
    if (!attempt || busy) return;
    setBusy(true);
    setError("");
    await queue.current;
    const result = await ebookApi<{ attempt: EbookExam }>(
      `/ebooks/attempts/${attempt.id}/submit`,
      { method: "POST", body: { answers } },
    );
    if (result.data) accept(result.data.attempt);
    else
      setError(
        result.error?.message ||
          "Submission failed. Retry to retrieve the saved server result.",
      );
    setBusy(false);
  };
  useEffect(() => {
    submitRef.current = () => {
      void submit();
    };
  });
  const choose = (option: number) => {
    if (!attempt || attempt.result || remaining <= 0 || busy) return;
    const id = attempt.questions[index].id,
      next = { ...answers, [id]: option };
    setAnswers(next);
    queue.current = queue.current.then(async () => {
      const result = await ebookApi(`/ebooks/attempts/${attempt.id}`, {
        method: "PUT",
        body: { answers: { [id]: option } },
      });
      if (!result.success)
        setError(
          result.error?.message ||
            "Answer sync failed. Keep the page open and retry submission.",
        );
    });
  };
  const start = async () => {
    setBusy(true);
    setError("");
    const result = await ebookApi<{ attempt: EbookExam }>(
      `/ebooks/${book.slug}/attempts`,
      { method: "POST", body: { negativeMarking: negative } },
    );
    if (result.data) accept(result.data.attempt);
    else
      setError(
        result.error?.message ||
          "The verified exam requires an online API and verified sign-in.",
      );
    setBusy(false);
  };
  const startPractice = async () => {
    if (book.finalExamQuestions?.length) {
      setPractice(book.finalExamQuestions);
      return;
    }
    setBusy(true);
    const result = await ebookApi<{ questions: EbookQuestion[] }>(
      `/ebooks/${book.slug}/practice`,
    );
    setBusy(false);
    if (result.data) setPractice(result.data.questions);
    else
      setError(
        result.error?.message || "Practice questions could not be loaded.",
      );
  };
  const close = () => {
    if (
      attempt &&
      !attempt.result &&
      !window.confirm(
        "Leave this exam? The server timer will continue. Saved answers can be resumed from your dashboard.",
      )
    )
      return;
    onClose();
  };
  const result = attempt?.result;
  return (
    <dialog
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      className="m-auto max-h-[94dvh] w-[min(96vw,76rem)] overflow-y-auto rounded-2xl border bg-card p-0 text-foreground shadow-2xl backdrop:bg-slate-950/65"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-card p-5">
        <h2 className="text-lg font-bold">
          {practice
            ? "Ebook practice"
            : book.examTitle || "Final skill assessment"}
        </h2>
        <button
          type="button"
          aria-label="Close assessment"
          className="rounded-lg p-2 hover:bg-muted"
          onClick={close}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="p-5 sm:p-8">
        {error && (
          <p
            role="alert"
            className="mb-5 rounded-xl border border-amber-400 p-4 text-sm"
          >
            {error}
          </p>
        )}
        {practice ? (
          <>
            <p className="mb-4 rounded-xl border bg-muted/30 p-4 text-sm">
              Self-check practice with the existing ExamPro practice engine.
              This mode does not issue a verified certificate.
            </p>
            <ExamEngine test={practiceTest(book, practice)} mode="practice" />
          </>
        ) : !attempt ? (
          <div className="mx-auto max-w-2xl space-y-5">
            <Award className="h-10 w-10 text-indigo-600" />
            <h3 className="text-2xl font-bold">
              Put your new skills to the test.
            </h3>
            <p className="text-sm leading-7 text-muted-foreground">
              The final exam has{" "}
              {book.questionCount || book.finalExamQuestions?.length || 15}{" "}
              questions and a {book.examMinutes}-minute server timer. Passing
              requires {book.passPercent ?? 70}%. Each correct answer earns{" "}
              {book.marksPerCorrect ?? 1} mark(s). Signed-in results are saved
              to your dashboard. This is an ExamPro skill assessment, not a
              vendor certification or proctored credential.
            </p>
            <label className="flex items-center gap-3 rounded-xl border p-4 text-sm">
              <input
                type="checkbox"
                checked={negative}
                onChange={(event) => setNegative(event.target.checked)}
              />
              Use negative marking: −0.25 per incorrect answer
            </label>
            <div className="flex flex-wrap gap-3">
              {session?.user?.email ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void start()}
                  className="min-h-11 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {busy ? "Connecting…" : "Start timed assessment"}
                </button>
              ) : (
                <Link
                  className="inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white"
                  href={`/auth/signin?callbackUrl=${encodeURIComponent("/certifications/learn/" + book.slug)}`}
                >
                  Sign in for a saved assessment
                </Link>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => void startPractice()}
                className="min-h-11 rounded-xl border px-5 text-sm font-semibold"
              >
                Self-check practice
              </button>
            </div>
            {book.linkedMockTestId && (
              <div className="rounded-xl border bg-muted/30 p-4">
                <h4 className="font-semibold">Linked certification test</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Published mocks retain their existing sign-in and plan
                  requirements. Starter certification banks open in practice
                  mode.
                </p>
                <Link
                  className="mt-3 inline-block text-sm font-semibold text-indigo-600 underline"
                  href={`/india-mocks/${encodeURIComponent(book.linkedMockTestId)}${buildCertTest(book.linkedMockTestId) ? "?mode=practice" : ""}`}
                >
                  Open linked test →
                </Link>
              </div>
            )}
          </div>
        ) : result ? (
          <div className="mx-auto max-w-3xl space-y-6">
            <div
              className={`rounded-2xl border p-6 sm:p-8 ${result.passed ? "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20" : "bg-muted/30"}`}
            >
              <Award className="h-10 w-10 text-indigo-600" />
              <p className="mt-4 text-xs font-bold uppercase tracking-widest">
                {result.passed
                  ? "ExamPro Skill Completion Certificate"
                  : "Assessment complete"}
              </p>
              <h3 className="mt-2 text-2xl font-bold">
                {session?.user?.name || "ExamPro learner"}
              </h3>
              <p className="mt-2 font-semibold">{attempt.title}</p>
              <p className="mt-4 text-4xl font-bold tabular-nums">
                {result.percentage}%
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {result.correct} correct · {result.wrong} incorrect ·{" "}
                {result.unanswered} unanswered
              </p>
              <p className="mt-3 text-xs leading-6 text-muted-foreground">
                Server-graded result saved to your account.{" "}
                {result.passed
                  ? "Recognizes completion of this ExamPro assessment; not an accredited or vendor-issued qualification."
                  : `A score of ${attempt.passPercent ?? 70}% is required to pass. Review explanations and try again.`}
              </p>
              <Link
                href="/dashboard"
                className="mt-4 inline-block text-sm font-semibold underline"
              >
                View saved attempts in dashboard →
              </Link>
            </div>
            {result.passed && book.visibility === "public" && (
              <div className="rounded-xl border p-4">
                <p className="text-xs leading-6 text-muted-foreground">
                  Creating a public achievement link shares your display name,
                  ebook title and score with anyone who has the link.
                </p>
                {!shared ? (
                  <button
                    type="button"
                    className="mt-3 min-h-10 rounded-lg border px-4 text-sm font-semibold"
                    onClick={async () => {
                      const response = await ebookApi<{ id: string }>(
                        `/ebooks/attempts/${attempt.id}/share`,
                        { method: "POST", body: {} },
                      );
                      if (response.data)
                        setShared(
                          new URL(
                            `/certifications/achievements/${response.data.id}`,
                            window.location.origin,
                          ).toString(),
                        );
                      else
                        setError(
                          response.error?.message ||
                            "Could not create achievement link.",
                        );
                    }}
                  >
                    Create public achievement link
                  </button>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-4 text-sm font-semibold">
                    <a
                      target="_blank"
                      rel="noopener noreferrer"
                      href={`https://wa.me/?text=${encodeURIComponent(`I completed an ExamPro skill assessment: ${attempt.title} (${result.percentage}%). ${shared}`)}`}
                    >
                      Share on WhatsApp ↗
                    </a>
                    <a
                      target="_blank"
                      rel="noopener noreferrer"
                      href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shared)}`}
                    >
                      Share on LinkedIn ↗
                    </a>
                    <button
                      type="button"
                      className="underline"
                      onClick={() =>
                        navigator.clipboard
                          .writeText(shared)
                          .catch(() => setError(shared))
                      }
                    >
                      Copy achievement link
                    </button>
                  </div>
                )}
              </div>
            )}
            {!!result.domains?.length && (
              <section className="rounded-xl border p-5">
                <h3 className="font-bold">Domain breakdown</h3>
                <div className="mt-3 space-y-3">
                  {result.domains.map((d) => (
                    <div
                      key={d.domain}
                      className="flex justify-between gap-4 text-sm"
                    >
                      <span>{d.domain}</span>
                      <strong className="shrink-0">
                        {d.correct} / {d.total}
                      </strong>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <div className="space-y-4">
              <h3 className="text-xl font-bold">Answer explanations</h3>
              {result.review.map((q, index) => (
                <article key={q.id} className="rounded-xl border p-5">
                  <h4 className="font-semibold">
                    {index + 1}. {q.question}
                  </h4>
                  <p className="mt-2 text-sm">
                    Your answer:{" "}
                    {q.selected >= 0 ? q.options[q.selected] : "Unanswered"}
                  </p>
                  <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
                    Correct: {q.options[q.answer]}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {q.explanation}
                  </p>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
            <section>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-semibold">
                  Question {index + 1} of {attempt.questions.length}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-2 text-sm font-bold tabular-nums text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  <Clock3 className="h-4 w-4" />
                  {Math.floor(remaining / 60)}:
                  {String(remaining % 60).padStart(2, "0")}
                </span>
              </div>
              <h3 className="whitespace-pre-wrap text-xl font-semibold leading-8">
                {attempt.questions[index].question}
              </h3>
              <fieldset
                disabled={busy || remaining <= 0}
                className="mt-6 space-y-3"
              >
                <legend className="sr-only">Choose an answer</legend>
                {attempt.questions[index].options.map((option, oi) => (
                  <label
                    key={oi}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm leading-6 ${answers[attempt.questions[index].id] === oi ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50" : ""}`}
                  >
                    <input
                      type="radio"
                      name="ebook-answer"
                      className="mt-1.5"
                      checked={answers[attempt.questions[index].id] === oi}
                      onChange={() => choose(oi)}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </fieldset>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="min-h-11 rounded-xl border px-4 text-sm disabled:opacity-40"
                  disabled={index === 0}
                  onClick={() => setIndex(index - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-xl border px-4 text-sm disabled:opacity-40"
                  disabled={index === attempt.questions.length - 1}
                  onClick={() => setIndex(index + 1)}
                >
                  Next →
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="min-h-11 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white disabled:opacity-50"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Submit your saved answers and finish this assessment?",
                      )
                    )
                      void submit();
                  }}
                >
                  {busy
                    ? "Submitting…"
                    : remaining === 0
                      ? "Retrieve final result"
                      : "Submit assessment"}
                </button>
              </div>
              <p className="mt-4 text-xs leading-6 text-muted-foreground">
                Answers sync as you choose them. At expiry, the server grades
                previously saved answers; late changes are ignored. Connection
                problems do not stop the server timer.
              </p>
            </section>
            <aside className="h-fit rounded-2xl border p-4">
              <h3 className="text-sm font-bold">Question palette</h3>
              <div className="mt-4 grid grid-cols-5 gap-2">
                {attempt.questions.map((q, i) => (
                  <button
                    key={q.id}
                    type="button"
                    aria-label={`Question ${i + 1}${answers[q.id] >= 0 ? ", answered" : ""}`}
                    aria-current={index === i ? "step" : undefined}
                    className={`min-h-10 rounded-lg border text-xs font-semibold ${index === i ? "ring-2 ring-indigo-500" : answers[q.id] >= 0 ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200" : ""}`}
                    onClick={() => setIndex(i)}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                {Object.values(answers).filter((value) => value >= 0).length}{" "}
                answered · −{attempt.negativeMarks} for incorrect answers
              </p>
            </aside>
          </div>
        )}
      </div>
    </dialog>
  );
}
