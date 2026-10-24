import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'ExamPro | Exam Practice Pro',
  description: 'Explore the ExamPro mock-test and coaching portal demo.',
};

export default function ExamProPage() {
  return (
    <main className="flex min-h-screen flex-col bg-white">
      <div className="flex items-center justify-between gap-4 border-b px-4 py-3 text-sm text-slate-800">
        <strong>ExamPro</strong>
        <Link href="/" className="underline underline-offset-4">Back to Exam Practice Pro</Link>
      </div>
      <iframe
        title="ExamPro mock-test portal"
        src="/exampro/demo"
        className="h-[calc(100dvh-49px)] min-h-[600px] w-full flex-1 border-0"
        allow="clipboard-write"
      />
    </main>
  );
}
