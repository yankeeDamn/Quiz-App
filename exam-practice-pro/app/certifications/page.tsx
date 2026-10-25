import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { IT_CERTS, buildCertTest } from '@/lib/it-certs';
export const metadata:Metadata={title:'IT Certifications | ExamPro',description:'Original IT certification starter practice'};
export default function CertificationsPage(){return <><Header/><main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12">
 <p className="text-sm font-semibold text-indigo-600">ExamPro certifications</p><h1 className="mt-2 text-3xl font-bold">IT certification practice</h1>
 <p className="mt-3 max-w-2xl text-muted-foreground">Original starter questions for Azure, AWS and CompTIA. They are free, unscored practice previews pending subject-matter review; not official certification papers. Scored published tests are in the ExamPro catalogue.</p>
 <div className="mt-8 grid gap-4 md:grid-cols-3">{IT_CERTS.map(cert=><article key={cert.id} className="rounded-xl border bg-card p-6">
 <h2 className="text-lg font-semibold">{cert.name}</h2><p className="mt-2 text-sm text-muted-foreground">{buildCertTest(cert.id)?.questionCount ?? 0} practice questions · explanations available</p>
 <Link className="mt-4 inline-block font-semibold text-indigo-600 underline" href={`/india-mocks/${cert.id}?mode=practice`}>Start free practice</Link></article>)}</div>
 <Link href="/india-mocks" className="mt-8 inline-block underline">Explore published exams</Link>
 </main><Footer/></>}
