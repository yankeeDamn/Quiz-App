import { api, getUserProfile } from '@/lib/api';
import { buildCertTest } from '@/lib/it-certs';
import { fetchPracticeOverrides } from '@/lib/practice-overrides';

export interface MockSummary {
  id: string;
  name: string;
  exam: string;
  kind: 'mock' | 'topic';
  tier: 'free' | 'premium';
  level: string;
  minutes: number;
  questionCount: number;
  marksPerCorrect: number;
  negativeMarks: number;
  sections: string[];
}

export interface MockQuestion {
  id: string;
  topic: string;
  topicName: string;
  section: number;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface MockTest extends Omit<MockSummary, 'sections'> {
  sections: { name: string; from: number; to: number }[];
  questions: MockQuestion[];
}

export type MockLoad =
  | { status: 'ok'; test: MockTest }
  | { status: 'sign-in'; test?: MockSummary }
  | { status: 'plan'; test?: MockSummary }
  | { status: 'missing' }
  | { status: 'error'; message: string };

export async function fetchCatalog(): Promise<MockSummary[]> {
  const res = await api<{ tests: MockSummary[] }>('/api/v1/mocks', { public: true });
  if (!res.success || !res.data) throw new Error(res.error?.message || 'Could not load the tests');
  return res.data.tests;
}

export async function fetchMock(id: string, mode: 'test' | 'practice' = 'test'): Promise<MockLoad> {
  // Free IT certification starters ship with the site and do not need the API.
  const cert = buildCertTest(id);
  if (cert && mode === 'practice') {
    try {
      const overrides = await fetchPracticeOverrides();
      return { status: 'ok', test: buildCertTest(id, overrides) || cert };
    } catch {
      // Bundled questions remain available when Render/Neon is offline.
      return { status: 'ok', test: cert };
    }
  }
  if (cert) return { status: 'error', message: 'These introductory certification questions are practice-only. Choose Practice to view explanations.' };
  try {
    const endpoint = `/api/v1/mocks/${encodeURIComponent(id)}${mode === 'practice' ? '/practice' : ''}`;
    const res = (await api<{ test: MockTest }>(endpoint, {optionalAuth:true})) as {
      success: boolean;
      data?: { test: MockTest | MockSummary };
      error?: { message: string; code?: string };
    };
    if (res.success && res.data) return { status: 'ok', test: res.data.test as MockTest };
    const code = res.error?.code;
    if (code === 'SIGN_IN_REQUIRED') return { status: 'sign-in', test: res.data?.test as MockSummary | undefined };
    if (code === 'PLAN_REQUIRED') return { status: 'plan', test: res.data?.test as MockSummary | undefined };
    if (res.error?.message === 'Test not found') return { status: 'missing' };
    return { status: 'error', message: res.error?.message || 'Could not load this test' };
  } catch {
    return { status: 'error', message: 'Cannot reach the ExamPro API. Check the API URL and connection, then retry.' };
  }
}

export interface PlanState {
  signedIn: boolean;
  active: boolean;
  plan: string;
  expiresAt: string | null;
  loaded: boolean;
}

export async function fetchPlanState(): Promise<PlanState> {
  try {
    const res = await getUserProfile();
    if (res.success && res.data && !res.data.isGuest) {
      return {
        signedIn: true,
        active: Boolean(res.data.user.planActive),
        plan: res.data.user.plan || 'free',
        expiresAt: res.data.user.planExpiresAt || null,
        loaded: true,
      };
    }
  } catch {
    /* fall through */
  }
  return { signedIn: false, active: false, plan: 'free', expiresAt: null, loaded: true };
}

// ── Engine helpers ─────────────────────────────────────

export interface Shuffled {
  question: MockQuestion;
  /** order[i] is the original option index shown in position i */
  order: number[];
}

export function shuffleTest(test: MockTest, shuffleQuestions: boolean): Shuffled[] {
  const items: Shuffled[] = test.questions.map((question) => {
    const order = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
    return { question, order };
  });
  if (!shuffleQuestions) return items;
  // Shuffle inside each section so section ranges stay valid.
  test.sections.forEach((s) => {
    const part = items.slice(s.from, s.to).sort(() => Math.random() - 0.5);
    items.splice(s.from, part.length, ...part);
  });
  return items;
}

export interface Result {
  correct: number;
  wrong: number;
  skipped: number;
  score: number;
  total: number;
  accuracy: number;
  percent: number;
  sections: { name: string; correct: number; wrong: number; skipped: number; score: number }[];
  topics: { name: string; correct: number; attempted: number }[];
}

/** answers[i] is the shown position picked (or -1). */
export function scoreTest(test: MockTest, items: Shuffled[], answers: number[]): Result {
  const sections = test.sections.map((s) => ({ name: s.name, correct: 0, wrong: 0, skipped: 0, score: 0 }));
  const topics = new Map<string, { name: string; correct: number; attempted: number }>();
  let correct = 0;
  let wrong = 0;
  let skipped = 0;
  let score = 0;

  items.forEach((item, i) => {
    const q = item.question;
    const sec = sections[q.section];
    const picked = answers[i];
    const topic = topics.get(q.topic) || { name: q.topicName, correct: 0, attempted: 0 };
    if (picked < 0) {
      skipped += 1;
      sec.skipped += 1;
    } else {
      topic.attempted += 1;
      if (item.order[picked] === q.answer) {
        correct += 1;
        sec.correct += 1;
        score += test.marksPerCorrect;
        sec.score += test.marksPerCorrect;
        topic.correct += 1;
      } else {
        wrong += 1;
        sec.wrong += 1;
        score -= test.negativeMarks;
        sec.score -= test.negativeMarks;
      }
    }
    topics.set(q.topic, topic);
  });

  const total = items.length * test.marksPerCorrect;
  const attempted = correct + wrong;
  return {
    correct,
    wrong,
    skipped,
    score: Math.round(score * 100) / 100,
    total,
    accuracy: attempted ? Math.round((correct / attempted) * 100) : 0,
    percent: total ? Math.max(0, Math.round((score / total) * 100)) : 0,
    sections: sections.map((s) => ({ ...s, score: Math.round(s.score * 100) / 100 })),
    topics: Array.from(topics.values()),
  };
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export function negativeLabel(n: number): string {
  if (!n) return 'no negative marking';
  if (Math.abs(n - 1 / 3) < 0.001) return '−1/3 per wrong answer';
  if (Math.abs(n - 2 / 3) < 0.001) return '−2/3 per wrong answer';
  return `−${n} per wrong answer`;
}
