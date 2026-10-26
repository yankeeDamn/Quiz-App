import { api } from '@/lib/api';
import type { Question, QuizMeta } from '@/lib/types';

export interface PracticeOverride {
  source: 'homepage' | 'certification';
  id: string;
  question: unknown;
  updatedAt?: string;
}

/** Legacy free practice ships with the frontend. These are optional DB edits. */
export async function fetchPracticeOverrides(): Promise<PracticeOverride[]> {
  const response = await api<{overrides: PracticeOverride[]}>('/api/v1/practice/overrides', { public: true });
  if (!response.success || !response.data) {
    throw new Error(response.error?.message || 'Cannot load practice changes from the API');
  }
  return response.data.overrides;
}

export function homepageQuestion(base: Question, overrides: PracticeOverride[]): Question {
  const saved = overrides.find(x => x.source === 'homepage' && x.id === base.id);
  // API data is validated on write. Keep stable question IDs as a safeguard.
  const candidate = saved?.question as Question | undefined;
  return candidate?.id === base.id ? candidate : base;
}

export function applyHomepageOverrides<T extends QuizMeta>(quiz: T, overrides: PracticeOverride[]): T {
  const questions = quiz.questions.map(q => homepageQuestion(q, overrides));
  return {...quiz, questions, questionCount: questions.length};
}
