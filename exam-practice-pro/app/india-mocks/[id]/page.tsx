import { notFound } from 'next/navigation';
import { indiaExams, type IndiaExam, type IndiaQuestion } from '@/data/india-exams';
import { PracticeClient } from './practice-client';

const CERTS: Record<string, { code: string; label: string }> = {
  'az-900': { code: 'AZ-900', label: 'Microsoft Azure Fundamentals (AZ-900)' },
  'aws-cloud-practitioner': { code: 'AWS-CLF-C02', label: 'AWS Cloud Practitioner (CLF-C02)' },
  'comptia-a-plus': { code: 'CompTIA-A+', label: 'CompTIA A+ Foundations' },
};

// The source CSV lives in the repository root, outside the Next.js Vercel root.
// A checked-in JSON snapshot is used at runtime and can be regenerated with the import script.
import questionBank from '@/data/it-certification-questions.json';

type QuestionRecord = { id: string; exam_code: string; subject: string; question: string; options: string[]; correct_option: string; explanation: string; review_status: string };

export function generateStaticParams() {
  return [...indiaExams.map(e => ({ id: e.id })), ...Object.keys(CERTS).map(id => ({ id }))];
}

export default async function MockPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (CERTS[id]) {
    const { code, label } = CERTS[id];
    const questions: IndiaQuestion[] = (questionBank as QuestionRecord[])
      .filter(q => q.exam_code === code)
      .map(q => ({
        id: q.id,
        question: q.question,
        options: q.options,
        answer: 'ABCD'.indexOf(q.correct_option),
        explanation: q.explanation,
      }));
    if (!questions.length) notFound();
    const exam: IndiaExam = { id, category: 'IT Certifications', subject: code, title: `${label} Starter Practice`, questions };
    return <PracticeClient exam={exam} />;
  }
  const exam = indiaExams.find(e => e.id === id);
  if (!exam) notFound();
  return <PracticeClient exam={exam} />;
}
