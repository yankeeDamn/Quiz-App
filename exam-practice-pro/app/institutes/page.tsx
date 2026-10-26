import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, Palette, Users, ClipboardList, ShieldCheck } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
export const metadata: Metadata = { title: 'For Institutes | ExamPro' };

export default function InstitutesPage() {
  return <>
    <Header/>
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-14">
      <p className="font-semibold text-indigo-700 dark:text-indigo-400">ExamPro for coaching institutes</p>
      <h1 className="mt-3 text-4xl font-extrabold">Your institute. Your identity. One exam platform.</h1>
      <p className="mt-4 max-w-3xl text-lg text-muted-foreground">
        Try the branding and batch-preview features from the original Exampro.html without maintaining a separate site.
        The live mock tests continue to run on the existing secure Render and Neon services.
      </p>
      <div className="mt-7 flex flex-wrap gap-3">
        <Link href="/exampro#portal" className="rounded-lg bg-indigo-600 px-5 py-3 font-bold text-white">Open portal builder preview</Link>
        <Link href="/institute-admin" className="rounded-lg border px-5 py-3 font-semibold">Institute dashboard preview</Link>
        <Link href="/auth/signin?callbackUrl=/admin" className="rounded-lg border px-5 py-3 font-semibold">Owner sign-in</Link>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {[
          { icon: Palette, title: 'Branding preview', details: 'Choose institute name, logo, colour and tagline. Changes stay in your browser.' },
          { icon: Building2, title: 'Batch preview', details: 'Show batch labels and links in a sample portal without creating real student accounts.' },
          { icon: ClipboardList, title: 'Live exam catalogue', details: 'Open the actual ExamPro India mocks and certification tests from the preview.' },
          { icon: Users, title: 'Institute management — planned', details: 'Secure multi-tenant accounts, role-based student management, batch results and subscriptions need a separate backend milestone.' },
        ].map(item=><article key={item.title} className="rounded-xl border p-5">
          <item.icon className="h-7 w-7 text-indigo-700 dark:text-indigo-400"/><h2 className="mt-3 text-lg font-bold">{item.title}</h2><p className="mt-2 text-sm text-muted-foreground">{item.details}</p>
        </article>)}
      </div>
      <p className="mt-8 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        <ShieldCheck className="h-5 w-5 shrink-0"/> The portal builder is a public design preview, not a secure institute account.
        Never enter private student information in preview fields.
      </p>
    </main>
    <Footer/>
  </>;
}
