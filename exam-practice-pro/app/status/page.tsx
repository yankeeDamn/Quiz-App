import Link from 'next/link';
import { API_BASE_URL } from '@/lib/api';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

export const dynamic = 'force-dynamic';
export const metadata = {title:'Deployment & API status | ExamPro',robots:{index:false,follow:false}};

export default async function ExamProStatusPage(){
  const backend=API_BASE_URL;
  const commit=process.env.VERCEL_GIT_COMMIT_SHA||process.env.GITHUB_SHA||'not provided by this deployment';
  let apiReady=false;
  let details='API unavailable or asleep';
  try {
    if (!backend) throw new Error('API not configured');
    const response=await fetch(backend+'/api/v1/health/ready',{
      cache:'no-store',
      signal:AbortSignal.timeout(8000),
    });
    apiReady=response.ok;
    details=response.ok?'Ready — database connected and API responding':'HTTP '+response.status+' — open Render health logs';
  }catch{
    details='Could not reach Render API in eight seconds; it may be waking or misconfigured';
  }
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
        <section className="rounded-xl border p-5">
          <h2 className="font-bold">Backend API connection</h2>
          <p className="mt-2 break-all font-mono text-xs">{backend}</p>
          <p className={'mt-3 font-semibold '+(apiReady?'text-emerald-700 dark:text-emerald-300':'text-amber-700 dark:text-amber-300')}>
            {apiReady?'Ready':'Not ready'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{details}</p>
        </section>
        <section className="rounded-xl border p-5">
          <h2 className="font-bold">What is and isn't live</h2>
          <p className="mt-2 text-sm text-muted-foreground">Published mock sharing, EN/हिं/বাং interface controls and topic practice require a working API and current frontend. Translation of question content additionally needs Azure Translator credentials on Render. The public branded practice portal is not a private institute dashboard. Payment availability depends on the separately configured checkout mode; this page does not verify billing readiness.</p>
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
