'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Lock } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { ExamEngine } from '@/components/mocks/exam-engine';
import { WhatsAppButton } from '@/components/mocks/whatsapp-button';
import { fetchMock, negativeLabel, type MockLoad } from '@/lib/mocks';

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-16">
      <div className="rounded-xl border bg-card p-6">
        <h1 className="text-xl font-bold">{title}</h1>
        <div className="mt-3 space-y-4 text-sm">{children}</div>
      </div>
    </main>
  );
}

function MockPage() {
  const { id } = useParams<{ id: string }>();
  const mode = useSearchParams().get('mode') === 'practice' ? 'practice' : 'test';
  const [attempt, setAttempt] = useState(0);
  const [started, setStarted] = useState(false);
  const key = `${id}#${attempt}`;
  const [loaded, setLoaded] = useState<{ key: string; load: MockLoad } | null>(null);
  const load = loaded?.key === key ? loaded.load : null;

  useEffect(() => {
    let cancelled = false;
    fetchMock(id).then((r) => !cancelled && setLoaded({ key, load: r }));
    return () => {
      cancelled = true;
    };
  }, [id, key]);

  if (!load) {
    return (
      <main className="flex-1 px-4 py-16 text-center text-muted-foreground" aria-busy="true">
        Loading the test…
      </main>
    );
  }

  if (load.status === 'missing') {
    return (
      <Notice title="Test not found">
        <p>This test does not exist or was removed.</p>
        <Button asChild>
          <Link href="/india-mocks">See all mock tests</Link>
        </Button>
      </Notice>
    );
  }

  if (load.status === 'error') {
    return (
      <Notice title="Could not load the test">
        <p>{load.message}</p>
        <Button onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
      </Notice>
    );
  }

  if (load.status === 'sign-in' || load.status === 'plan') {
    const name = load.test?.name ?? 'this mock';
    return (
      <Notice title={name}>
        <p className="flex items-center gap-2 font-semibold">
          <Lock className="h-4 w-4" aria-hidden="true" />
          {load.status === 'sign-in' ? 'Sign in to open this Pro mock.' : 'This mock is part of the Pro plan.'}
        </p>
        {load.test && (
          <p className="text-muted-foreground">
            {load.test.questionCount} questions · {load.test.minutes} minutes · {negativeLabel(load.test.negativeMarks)}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {load.status === 'sign-in' ? (
            <Button asChild>
              <Link href={`/auth/signin?callbackUrl=${encodeURIComponent(`/india-mocks/${id}`)}`}>Sign in</Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href="/pricing">See plans</Link>
            </Button>
          )}
          <WhatsAppButton text={`Hi, I want access to "${name}" on Exam Practice Pro.`} label="Ask on WhatsApp" variant="outline" />
        </div>
        <p className="text-muted-foreground">Already paid on WhatsApp? Sign in with the same email you gave us and refresh this page.</p>
      </Notice>
    );
  }

  const test = load.test;

  if (!started && mode === 'test') {
    return (
      <Notice title={test.name}>
        <ul className="space-y-1">
          <li>{test.questions.length} questions in {test.minutes} minutes</li>
          <li>
            +{test.marksPerCorrect} per correct answer, {negativeLabel(test.negativeMarks)}
          </li>
          <li>Sections: {test.sections.map((s) => s.name).join(', ')}</li>
        </ul>
        <p className="text-muted-foreground">The timer starts when you press Start. The test submits itself when time runs out.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setStarted(true)}>Start test</Button>
          <Button variant="outline" asChild>
            <Link href="/india-mocks">Back</Link>
          </Button>
        </div>
      </Notice>
    );
  }

  return <ExamEngine test={test} mode={mode} />;
}

export default function MockTestPage() {
  return (
    <>
      <Header />
      <Suspense fallback={<main className="flex-1" />}>
        <MockPage />
      </Suspense>
      <Footer />
    </>
  );
}
