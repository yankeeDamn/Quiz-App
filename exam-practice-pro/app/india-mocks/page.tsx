import Link from 'next/link';
import Image from 'next/image';
import { indiaExams } from '@/data/india-exams';
export default function IndiaMocksPage() {
 return <main className="mx-auto max-w-6xl px-5 py-12">
  <Link href="/" className="text-sm text-blue-700 hover:underline">← Back to home</Link>
  <div className="mt-8 flex items-center gap-4"><Image src="/testguru-logo.svg" width={180} height={48} alt="TestGuru" /><span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">India exam practice</span></div>
  <h1 className="mt-8 text-4xl font-bold tracking-tight">Explore Indian competitive exam mocks</h1>
  <p className="mt-3 max-w-2xl text-gray-600 dark:text-gray-300">Practice short starter quizzes across eight exam categories. These are original practice samples, not official previous-year papers or full-length mocks.</p>
  <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{indiaExams.map(exam=><article key={exam.id} className="rounded-2xl border bg-white p-6 shadow-sm dark:bg-zinc-900">
   <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">{exam.category}</span>
   <h2 className="mt-3 text-xl font-semibold">{exam.title}</h2><p className="mt-2 text-sm text-gray-500">{exam.questions.length} questions · 10-minute timer · Instant review</p>
   <Link className="mt-5 inline-flex rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700" href={`/india-mocks/${exam.id}`}>Start mock test →</Link>
  </article>)}</div>
 </main>;
}
