"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, GraduationCap } from "lucide-react";
import { StartLearningHub } from "./start-learning-hub";
export function CertificationTabs({ children }: { children: React.ReactNode }) {
  const query = useSearchParams(),
    router = useRouter();
  const learning = query.get("tab") === "start-learning";
  const change = (tab: string) => {
    const next = new URLSearchParams(query.toString());
    next.set("tab", tab);
    router.replace(`/certifications?${next.toString()}`, { scroll: false });
  };
  return (
    <>
      <div
        role="tablist"
        aria-label="IT career tracks"
        className="mt-8 flex w-fit max-w-full gap-1 rounded-2xl border bg-muted/50 p-1.5"
      >
        {(
          [
            {
              id: "practice",
              label: "Certification Practice",
              icon: GraduationCap,
            },
            { id: "start-learning", label: "Start Learning", icon: BookOpen },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={learning === (tab.id === "start-learning")}
            aria-controls={`panel-${tab.id}`}
            onClick={() => change(tab.id)}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                change(learning ? "practice" : "start-learning");
                document
                  .getElementById(
                    `tab-${learning ? "practice" : "start-learning"}`,
                  )
                  ?.focus();
              }
            }}
            className={`flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors sm:px-5 ${learning === (tab.id === "start-learning") ? "bg-card text-indigo-700 shadow-sm dark:text-indigo-300" : "text-muted-foreground hover:text-foreground"}`}
          >
            <tab.icon className="hidden h-4 w-4 sm:block" />
            {tab.label}
          </button>
        ))}
      </div>
      <section
        role="tabpanel"
        id={`panel-${learning ? "start-learning" : "practice"}`}
        aria-labelledby={`tab-${learning ? "start-learning" : "practice"}`}
        className="mt-8"
      >
        {learning ? <StartLearningHub /> : children}
      </section>
    </>
  );
}
