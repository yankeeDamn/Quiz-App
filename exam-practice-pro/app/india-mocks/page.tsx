'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Clock, FileText, Lock } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { WhatsAppButton } from '@/components/mocks/whatsapp-button';
import { usePlan } from '@/hooks/use-plan';
import { IT_CERTS, buildCertTest } from '@/lib/it-certs';
import { fetchCatalog, negativeLabel, type MockSummary } from '@/lib/mocks';

const FILTERS: { id: string; label: string }[] = [
  { id: 'all', label: 'All tests' },
  { id: 'SSC', label: 'SSC' },
  { id: 'Banking', label: 'Banking' },
  { id: 'Railways', label: 'Railways' },
  { id: 'UPSC / PSC', label: 'UPSC / PSC' },
  { id: 'Placements', label: 'Campus' },
  { id: 'topic', label: 'Topic tests' },
];

function Catalogue() {
  const router = useRouter();
  const params = useSearchParams();
  const filter = params.get('exam') || 'all';
  const plan = usePlan();
  const [tests, setTests] = useState<MockSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchCatalog()
      .then((t) => !cancelled && setTests(t))
      .catch(() => !cancelled && setError('Could not reach the ExamPro API. Check the backend URL and deployment status, then retry.'));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const shown = useMemo(() => {
    if (!tests) return [];
    if (filter === 'all') return tests;
    if (filter === 'topic') return tests.filter((t) => t.kind === 'topic');
    return tests.filter((t) => t.kind === 'mock' && t.exam === filter);
  }, [tests, filter]);

  const setFilter = (id: string) => router.replace(id === 'all' ? '/india-mocks' : `/india-mocks?exam=${encodeURIComponent(id)}`, { scroll: false });
  const premiumCount = tests?.filter((t) => t.tier === 'premium').length ?? 0;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
      <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">India exam practice</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Mock tests for India&apos;s top exams</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Full mocks for SSC, Banking, Railways, UPSC and campus placements, plus short topic tests. Every question has an explanation, and any doubt can go straight to a mentor on WhatsApp.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <WhatsAppButton text="Hi, I want coaching guidance for my exam preparation." label="Get coaching on WhatsApp" />
        {plan.loaded && !plan.active && premiumCount > 0 && (
          <Button variant="outline" asChild>
            <Link href="/pricing">Unlock {premiumCount} premium mocks</Link>
          </Button>
        )}
        {plan.active && <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">Pro plan active</span>}
      </div>

      <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Filter tests">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`min-h-10 rounded-full border px-4 text-sm font-medium ${filter === f.id ? 'border-foreground bg-foreground text-background' : 'bg-card hover:border-foreground/50'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-8 rounded-xl border bg-card p-6" role="alert">
          <p>{error}</p>
          <Button
            className="mt-3"
            onClick={() => {
              setError(null);
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </Button>
        </div>
      )}

      {!tests && !error && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading tests">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl border bg-muted/50" />
          ))}
        </div>
      )}

      {tests && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((t) => {
            const locked = t.tier === 'premium' && !plan.active;
            return (
              <article key={t.id} className="flex flex-col gap-3 rounded-xl border bg-card p-5">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-semibold leading-snug">{t.name}</h2>
                  {t.tier === 'premium' ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-950/50 dark:text-amber-300">
                      <Lock className="h-3 w-3" aria-hidden="true" />
                      Pro
                    </span>
                  ) : (
                    <span className="shrink-0 rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">Free</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    {t.questionCount} questions
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-4 w-4" aria-hidden="true" />
                    {t.minutes} min
                  </span>
                  <span>{t.level}</span>
                </div>
                <p className="text-sm text-muted-foreground">{t.sections.join(' · ')}</p>
                <p className="text-xs text-muted-foreground">
                  +{t.marksPerCorrect} per correct, {negativeLabel(t.negativeMarks)}
                </p>
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  {locked ? (
                    <Button asChild>
                      <Link href={`/india-mocks/${t.id}`}>See what is included</Link>
                    </Button>
                  ) : (
                    <>
                      <Button asChild>
                        <Link href={`/india-mocks/${t.id}`}>Start test</Link>
                      </Button>
                      {t.kind === 'topic' && (
                        <Button variant="outline" asChild>
                          <Link href={`/india-mocks/${t.id}?mode=practice`}>Practice</Link>
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="mt-8 text-sm text-muted-foreground">These are original practice questions written for this site. They are not official previous-year papers.</p>
    </main>
  );
}

function StarterCertifications() {
  return <section className="mx-auto w-full max-w-6xl px-4 py-8" aria-label="IT certification practice">
    <h2 className="text-2xl font-bold">IT Certification Starter Practice</h2>
    <p className="mt-2 text-sm text-muted-foreground">Original introductory questions with explanations; pending expert review, not official exams.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      {IT_CERTS.map(cert => (
        <Link key={cert.id} href={`/india-mocks/${cert.id}?mode=practice`} className="rounded-lg border p-4 font-semibold hover:bg-muted">
          {cert.name} — Start practice →
          <span className="mt-1 block text-xs font-normal text-muted-foreground">{buildCertTest(cert.id)?.questionCount ?? 0} questions · free</span>
        </Link>
      ))}
    </div>
  </section>;
}

export default function IndiaMocksPage() {
  return (
    <>
      <Header />
      <Suspense fallback={<main className="flex-1" />}>
        <Catalogue />
        <StarterCertifications />
      </Suspense>
      <Footer />
    </>
  );
}
