import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { ApiReadiness } from '@/components/status/api-readiness';

export const dynamic = 'force-dynamic';
export const metadata = {title:'Deployment & API status | ExamPro',robots:{index:false,follow:false}};

export default async function ExamProStatusPage(){
  const commit=process.env.VERCEL_GIT_COMMIT_SHA||process.env.GITHUB_SHA||'not provided by this deployment';
  return <>
    <Header/>
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-12">
      <div>
        <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">ExamPro operations</p>
        <h1 className="mt-2 text-3xl font-extrabold">Deployment and API status</h1>
        <p className="mt-3 text-muted-foreground">Use this page to confirm whether your Vercel production domain has the new frontend code and whether the Render API is available.</p>
      </div>
      <div className="grid gap-4">
        <section className="rounded-xl border p-5">
          <h2 className="font-bold">Frontend deployment</h2>
          <p className="mt-2 text-sm text-muted-foreground">Vercel Git commit:</p>
          <p className="mt-1 break-all font-mono text-sm">{commit}</p>
          <p className="mt-3 text-sm text-muted-foreground">Compare this with GitHub's current main SHA. If they differ, redeploy and check Vercel Production Domains.</p>
        </section>
        <ApiReadiness/>
        <section className="rounded-xl border p-5">
          <h2 className="font-bold">What is and isn't live</h2>
          <p className="mt-2 text-sm text-muted-foreground">Published mock sharing, EN/हिं/বাং interface controls and topic practice require a working API and current frontend. Translation of question content additionally needs Azure Translator credentials on Render. The public branded practice portal is not a private institute dashboard. Cashfree payments are not enabled.</p>
        </section>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href="/exampro" className="rounded-lg bg-indigo-700 px-5 py-3 font-semibold text-white">Open ExamPro</Link>
        <Link href="/india-mocks" className="rounded-lg border px-5 py-3 font-semibold">Browse mocks</Link>
      </div>
    </main>
    <Footer/>
  </>;
}
