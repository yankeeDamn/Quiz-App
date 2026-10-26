import starter from '@/data/it-certification-questions.json';
import type { MockQuestion, MockTest } from '@/lib/mocks';
import type { PracticeOverride } from '@/lib/practice-overrides';

/**
 * Free starter practice for three IT certifications.
 * The questions ship with the site (data/it-certification-questions.json), so they are
 * not in the database and cannot be edited on /admin yet. They are marked "needs review".
 */
export const IT_CERTS = [
  { id: 'az-900', code: 'AZ-900', name: 'Microsoft AZ-900' },
  { id: 'aws-cloud-practitioner', code: 'AWS-CLF-C02', name: 'AWS Cloud Practitioner' },
  { id: 'comptia-a-plus', code: 'CompTIA-A+', name: 'CompTIA A+' },
] as const;

const LETTERS = ['A', 'B', 'C', 'D'];

/** Build a test the exam engine can run, or null when the id is not a certification. */
export function buildCertTest(id: string, overrides: PracticeOverride[] = []): MockTest | null {
  const cert = IT_CERTS.find((c) => c.id === id);
  if (!cert) return null;

  const questions: MockQuestion[] = starter
    .filter((q) => q.exam_code === cert.code)
    .map((original) => {
      const saved = overrides.find(o => o.source === 'certification' && o.id === original.id);
      const candidate = saved?.question as typeof original | undefined;
      return candidate?.id === original.id && candidate.exam_code === original.exam_code ? candidate : original;
    })
    .map((q) => ({
      id: q.id,
      topic: `${cert.id}:${q.subject}`,
      topicName: q.subject,
      section: 0,
      question: q.question,
      options: q.options,
      answer: LETTERS.indexOf(q.correct_option),
      explanation: q.explanation,
    }))
    .filter((q) => q.answer >= 0 && q.options.length === 4);
  if (questions.length === 0) return null;

  return {
    id: cert.id,
    name: `${cert.name} Starter Practice`,
    exam: 'IT Certification',
    kind: 'topic',
    tier: 'free',
    level: 'Practice',
    minutes: 10,
    questionCount: questions.length,
    marksPerCorrect: 1,
    negativeMarks: 0,
    sections: [{ name: cert.name, from: 0, to: questions.length }],
    questions,
  };
}
