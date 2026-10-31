"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { ebookApi } from "@/lib/ebooks";
type History = {
  id: string;
  slug: string;
  title: string;
  submitted_at: string | null;
  result: {
    score: number;
    total: number;
    percentage: number;
    passed: boolean;
  } | null;
};
export function EbookResults() {
  const { data: session } = useSession();
  const identity = session?.user?.email || "";
  const [state, setState] = useState<{
    identity: string;
    attempts: History[];
    error: string;
  }>({ identity: "", attempts: [], error: "" });
  useEffect(() => {
    if (!identity) return;
    let active = true;
    void ebookApi<{ attempts: History[] }>("/ebooks/attempts").then(
      (result) => {
        if (active)
          setState({
            identity,
            attempts: result.data?.attempts || [],
            error: result.success
              ? ""
              : result.error?.message || "Could not load ebook assessments.",
          });
      },
    );
    return () => {
      active = false;
    };
  }, [identity]);
  return (
    <section className="mb-8 rounded-2xl border bg-card p-5">
      <h2 className="text-xl font-bold">Learning & skill assessments</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Server-graded ebook results and unfinished assessments follow your
        account across devices.
      </p>
      {!identity ? (
        <Link
          className="mt-3 inline-block text-sm underline"
          href="/auth/signin?callbackUrl=/dashboard"
        >
          Sign in to view your results
        </Link>
      ) : state.identity !== identity ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Loading assessments…
        </p>
      ) : (
        <>
          {state.error && (
            <p
              role="status"
              className="mt-3 text-sm text-amber-700 dark:text-amber-300"
            >
              {state.error}
            </p>
          )}
          <ul className="mt-3 divide-y">
            {state.attempts.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm"
              >
                <span className="font-semibold">{item.title}</span>
                <span>
                  {item.result
                    ? `${item.result.percentage}% · ${item.result.passed ? "Passed" : "Completed"}`
                    : "In progress"}
                  <Link
                    className="ml-3 font-semibold text-indigo-600 underline dark:text-indigo-300"
                    href={`/certifications/learn/${item.slug}?attempt=${item.id}`}
                  >
                    {item.submitted_at ? "Review result" : "Resume"}
                  </Link>
                </span>
              </li>
            ))}
          </ul>
          {!state.error && state.attempts.length === 0 && (
            <Link
              href="/certifications?tab=start-learning"
              className="mt-3 inline-block text-sm font-semibold text-indigo-600 underline dark:text-indigo-300"
            >
              Start your first learning track →
            </Link>
          )}
        </>
      )}
    </section>
  );
}
