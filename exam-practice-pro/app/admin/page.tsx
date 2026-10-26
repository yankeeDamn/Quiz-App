/* eslint-disable react-hooks/set-state-in-effect -- these effects load data from the API when the page opens */
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { PlansTab } from '@/components/admin/plans-tab';
import { QuestionsTab } from '@/components/admin/questions-tab';
import { TestsTab } from '@/components/admin/tests-tab';
import { PracticeLibraryTab } from '@/components/admin/practice-library-tab';
import { admin } from '@/lib/admin';

type Tab = 'questions' | 'tests' | 'practice' | 'plans';
const TABS: { id: Tab; label: string }[] = [
  { id: 'questions', label: 'Questions' },
  { id: 'tests', label: 'Mock tests' },
  { id: 'practice', label: 'Practice Library' },
  { id: 'plans', label: 'Plans and payments' },
];

type Gate = { state: 'loading' } | { state: 'signin' } | { state: 'denied'; email: string | null } | { state: 'error'; message: string } | { state: 'ok' };

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [gate, setGate] = useState<Gate>({ state: 'loading' });
  const [tab, setTab] = useState<Tab>('questions');
  const [attempt, setAttempt] = useState(0);

  const check = useCallback(async () => {
    const r = await admin('/me');
    if (r.ok) setGate({ state: 'ok' });
    else if (/verified|OAuth provider|AUTH_SECRET/i.test(r.message)) setGate({state:'error',message:r.message});
    else if (r.status === 401 || /sign|token|authentication/i.test(r.message)) setGate({ state: 'signin' });
    else if (/not an admin/i.test(r.message)) setGate({ state: 'denied', email: null });
    else setGate({ state: 'error', message: r.message });
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user) {
      setGate({ state: 'signin' });
      return;
    }
    void check();
  }, [status, session?.user, attempt, check]);

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold">Admin</h1>

        {gate.state === 'loading' && <p className="mt-6 text-muted-foreground" aria-busy="true">Checking your account…</p>}

        {gate.state === 'signin' && (
          <div className="mt-6 max-w-lg rounded-xl border bg-card p-6">
            <p>Sign in with the Google or GitHub account that is listed as admin.</p>
            <Button className="mt-4" asChild>
              <Link href="/auth/signin?callbackUrl=/admin">Sign in</Link>
            </Button>
          </div>
        )}

        {gate.state === 'denied' && (
          <div className="mt-6 max-w-lg rounded-xl border bg-card p-6" role="alert">
            <p className="font-semibold">This account is not an admin.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              You are signed in as {session?.user?.email ?? 'a guest'}. Add this email to <code>ADMIN_EMAILS</code> on the API service in Render, redeploy, then reload this page.
            </p>
          </div>
        )}

        {gate.state === 'error' && (
          <div className="mt-6 max-w-lg rounded-xl border bg-card p-6" role="alert">
            <p>{gate.message}</p>
            <Button className="mt-3" onClick={() => setAttempt((n) => n + 1)}>Try again</Button>
          </div>
        )}

        {gate.state === 'ok' && (
          <>
            <p className="mt-1 text-sm text-muted-foreground">Signed in as {session?.user?.email}. Changes go live on the site within 30 seconds.</p>
            <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Admin sections">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`min-h-11 rounded-lg border px-4 text-sm font-semibold ${tab === t.id ? 'border-foreground bg-foreground text-background' : 'bg-card hover:border-foreground/50'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="mt-6">
              {tab === 'questions' && <QuestionsTab />}
              {tab === 'tests' && <TestsTab />}
              {tab === 'practice' && <PracticeLibraryTab />}
              {tab === 'plans' && <PlansTab />}
            </div>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
