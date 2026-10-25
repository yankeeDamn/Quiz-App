import { api } from '@/lib/api';

export interface AdminTopic { id: string; name: string; category: string; active: boolean; total: number; live: number }
export interface AdminQuestion { id: string; position: number; question: string; options: string[]; answer: number; explanation: string; difficulty: string; active: boolean }
export interface QuestionInput { question: string; options: string[]; answer: number; explanation: string; difficulty?: string }
export interface TestPart { topic: string; from: number; to: number }
export interface TestSection { name: string; parts: TestPart[] }
export interface AdminTest {
  id: string; name: string; exam: string; minutes: number; marksPerCorrect: number; negativeMarks: number;
  level: string; tier: 'free' | 'premium'; passPercent: number; sections: TestSection[]; active: boolean; questionCount?: number;
}
export interface AdminUser { email: string; name: string | null; plan: string; plan_expires_at: string | null; planActive: boolean }
export interface AdminGrant { plan: string; months: number; amount_inr: number | null; note: string | null; expires_at: string; granted_at: string; email: string }

export type Call<T> = { ok: true; data: T } | { ok: false; message: string; status?: number };

/** Calls the admin API as the signed-in user. */
export async function admin<T = unknown>(path: string, method = 'GET', body?: unknown): Promise<Call<T>> {
  try {
    const res = await api<T>(`/api/v1/admin${path}`, { method, body });
    if (res.success) return { ok: true, data: res.data as T };
    return { ok: false, message: res.error?.message || 'Something went wrong' };
  } catch {
    return { ok: false, message: 'Cannot reach the ExamPro API. Verify its address and deployment status.' };
  }
}

const LETTERS = ['A', 'B', 'C', 'D'];

/**
 * Pasted lines to questions. One question per line, parts split by a pipe:
 *   question | option A | option B | option C | option D | right answer (A-D) | explanation
 */
export function parseBulk(text: string): { rows: QuestionInput[]; errors: string[] } {
  const rows: QuestionInput[] = [];
  const errors: string[] = [];
  text.split('\n').forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const parts = line.split('|').map((p) => p.trim());
    if (parts.length !== 7) {
      errors.push(`Line ${i + 1}: expected 7 parts split by "|", found ${parts.length}.`);
      return;
    }
    const answer = LETTERS.indexOf(parts[5].toUpperCase());
    if (answer < 0) {
      errors.push(`Line ${i + 1}: the right answer must be A, B, C or D.`);
      return;
    }
    rows.push({ question: parts[0], options: parts.slice(1, 5), answer, explanation: parts[6] });
  });
  return { rows, errors };
}
