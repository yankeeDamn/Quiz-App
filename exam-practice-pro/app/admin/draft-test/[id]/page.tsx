'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { SecureExam } from '@/components/mocks/secure-exam';

/**
 * Staging-only private test runner. This URL is NOT a capability token:
 * every backend start/recover/save/submit request requires an authenticated,
 * verified OAuth ADMIN_EMAILS member and the strict staging environment gate.
 */
export default function AdminDraftTestPage() {
  const {id} = useParams<{id:string}>();
  return <>
    <Header />
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <nav className="mb-5 text-sm"><Link className="underline" href="/admin">Back to Admin</Link></nav>
      <div className="mb-5 rounded-lg border border-amber-400 bg-amber-50 p-4 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100" role="status">
        <strong>Private staging QA.</strong> This draft is not published. Only verified admins can start or resume it.
        Your timed answers are stored in the isolated staging database.
      </div>
      {id ? <SecureExam testId={id} draftMode /> : <p role="alert">Invalid draft test ID.</p>}
    </main>
    <Footer />
  </>;
}
