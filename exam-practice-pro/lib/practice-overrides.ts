import { api } from '@/lib/api';
import type { Question, QuizMeta } from '@/lib/types';

export interface PracticeOverride {
  source: 'homepage' | 'certification';
  id: string;
  question: unknown;
  updatedAt?: string;
}

export interface PracticeAddition {
  source: 'homepage' | 'certification';
  groupId: string;
  id: string;
  question: unknown;
}
export interface PracticeLibraryData {
  overrides: PracticeOverride[];
  additions: PracticeAddition[];
}
export async function fetchPracticeLibrary(): Promise<PracticeLibraryData> {
  const response = await api<PracticeLibraryData>('/api/v1/practice/overrides', {public: true});
  if (!response.success || !response.data) throw new Error(response.error?.message || 'Could not load practice questions');
  return {overrides: response.data.overrides || [], additions: response.data.additions || []};
}

/** Legacy free practice ships with the frontend. These are optional DB edits. */
export async function fetchPracticeOverrides(): Promise<PracticeOverride[]> {
  return (await fetchPracticeLibrary()).overrides;
}

export function homepageQuestion(base: Question, overrides: PracticeOverride[]): Question {
  const saved = overrides.find(x => x.source === 'homepage' && x.id === base.id);
  // API data is validated on write. Keep stable question IDs as a safeguard.
  const candidate = saved?.question as Question | undefined;
  return candidate?.id === base.id ? candidate : base;
}

export function applyHomepageOverrides<T extends QuizMeta>(
  quiz: T, overrides: PracticeOverride[], additions: PracticeAddition[] = []
): T {
  const original = quiz.questions.map(q => homepageQuestion(q, overrides));
  const extras = additions
    .filter(a => a.source === 'homepage' && a.groupId === quiz.id)
    .filter(a => !original.some(q => q.id === a.id))
    .map(a => homepageQuestion(a.question as Question, overrides))
    .filter(q => q && typeof q.id === 'string' && Array.isArray(q.options));
  const questions = [...original, ...extras];
  return {...quiz, questions, questionCount: questions.length};
}
