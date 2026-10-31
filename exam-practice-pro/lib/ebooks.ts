import { api } from "./api";
import type { MockTest } from "./mocks";

export type EbookVisibility = "admin_only" | "invite_only" | "public";
export const EBOOK_CATEGORIES = [
  "Python",
  "AI with Copilot",
  "Python & Cheatcodes",
  "Machine Learning",
  "LLMs & Hugging Face",
  "GitHub Copilot (GH-300)",
  "Endpoint Admin (MD-102)",
  "Java",
  "Cloud & DevOps",
] as const;
export type EbookCategory = (typeof EBOOK_CATEGORIES)[number];
export type EbookQuestion = {
  domain?: string;
  id?: string;
  question: string;
  options: string[];
  answer: number;
  explanation: string;
};
export interface EbookChapter {
  id: string;
  order: number;
  title: string;
  durationMinutes: number;
  summary: string;
  contentMarkdown: string;
  codeSnippet?: {
    language: "python" | "java" | "typescript" | "bash" | "powershell" | "json";
    code: string;
    expectedOutput: string;
  };
  keyTakeaways: string[];
  conceptChecks: EbookQuestion[];
}
export type EbookPermissions = {
  canRead: boolean;
  canEdit: boolean;
  canManageAccess: boolean;
};
export interface EbookTrack {
  slug: string;
  title: string;
  subtitle: string;
  category: EbookCategory;
  level: "Beginner to Pro" | "Intermediate" | "Advanced" | "Certification Cram";
  visibility: EbookVisibility;
  allowPdfDownload?: boolean;
  pdfUrl?: string;
  pdfFileName?: string;
  isCheatSheet?: boolean;
  examBadgeCode?: string;
  version?: string;
  passPercent?: number;
  marksPerCorrect?: number;
  negativeMarks?: number;
  chapters: EbookChapter[];
  finalExamQuestions?: EbookQuestion[];
  linkedMockTestId?: string;
  examId: string;
  examTitle?: string;
  examMinutes: number;
  draftBulk?: string;
  questionCount?: number;
  updatedAt: string;
  revision?: number;
  references?: string[];
  permissions?: EbookPermissions;
}
export type EbookSummary = Omit<
  EbookTrack,
  "chapters" | "finalExamQuestions"
> & { chapterCount: number; durationMinutes: number };
export interface EbookAccessRequest {
  slug: string;
  title: string;
  email: string;
  role: "reader" | "editor";
  status: "pending" | "approved" | "revoked";
  note: string;
  requested_at: string;
}
export interface EbookProgress {
  completed: string[];
  bookmark: string | null;
}
export interface EbookExam {
  id: string;
  slug: string;
  title: string;
  startedAt: string;
  expiresAt: string;
  serverNow: string;
  submittedAt: string | null;
  passPercent?: number;
  marksPerCorrect?: number;
  negativeMarks: number;
  questions: Array<{ id: string; question: string; options: string[] }>;
  answers: Record<string, number>;
  result: {
    maxScore?: number;
    passPercent?: number;
    domains?: Array<{ domain: string; correct: number; total: number }>;
    score: number;
    total: number;
    percentage: number;
    passed: boolean;
    correct: number;
    wrong: number;
    unanswered: number;
    review: Array<EbookQuestion & { id: string; selected: number }>;
  } | null;
}
export type SkillCertificate = {
  id: string;
  name: string;
  title: string;
  percentage: number;
  completedAt: string;
  issuer: string;
  credential: string;
};
export async function ebookApi<T>(
  path: string,
  options: { method?: string; body?: unknown; public?: boolean } = {},
) {
  return api<T>(`/api/v1${path}`, {
    optionalAuth: !options.public,
    signal: AbortSignal.timeout(12000),
    ...options,
  });
}
// The API's per-book permissions are UI hints; the backend authorizes every mutation.
export const isOwnerAdmin = (capabilities: { isOwnerAdmin?: boolean } | null) =>
  capabilities?.isOwnerAdmin === true;
export const canViewEbook = (book: EbookTrack) =>
  book.visibility === "public" || book.permissions?.canRead === true;
export const canEditEbook = (book: EbookTrack) =>
  book.permissions?.canEdit === true;
export function summarize(book: EbookTrack): EbookSummary {
  const { chapters, finalExamQuestions, ...summary } = book;
  void finalExamQuestions; // Question keys are deliberately excluded from catalogue summaries.
  return {
    ...summary,
    chapterCount: chapters.length,
    durationMinutes: chapters.reduce((sum, c) => sum + c.durationMinutes, 0),
  };
}
export function progressKey(slug: string, identity: string) {
  return `exampro:ebook:progress:v1:${encodeURIComponent(identity)}:${slug}`;
}
export function readProgress(slug: string, identity: string): EbookProgress {
  try {
    const value = JSON.parse(
      localStorage.getItem(progressKey(slug, identity)) || "null",
    );
    return {
      completed: Array.isArray(value?.completed)
        ? value.completed.filter((id: unknown) => typeof id === "string")
        : [],
      bookmark: typeof value?.bookmark === "string" ? value.bookmark : null,
    };
  } catch {
    return { completed: [], bookmark: null };
  }
}
export function writeProgress(
  slug: string,
  identity: string,
  progress: EbookProgress,
) {
  try {
    localStorage.setItem(progressKey(slug, identity), JSON.stringify(progress));
  } catch {
    /* storage unavailable */
  }
}
export function draftKey(identity: string) {
  return `exampro:ebook:draft:v1:${encodeURIComponent(identity)}`;
}
export function saveDraft(identity: string, draft: EbookTrack) {
  try {
    localStorage.setItem(draftKey(identity), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}
export function loadDraft(identity: string): EbookTrack | null {
  try {
    const raw = JSON.parse(localStorage.getItem(draftKey(identity)) || "null");
    return raw && Array.isArray(raw.chapters) ? raw : null;
  } catch {
    return null;
  }
}
export function practiceTest(
  book: EbookTrack,
  questions: EbookQuestion[],
): MockTest {
  return {
    id: book.examId,
    name: `${book.title} · Practice`,
    exam: book.category,
    kind: "topic",
    tier: "free",
    level: book.level,
    minutes: book.examMinutes,
    questionCount: questions.length,
    marksPerCorrect: book.marksPerCorrect ?? 1,
    negativeMarks: book.negativeMarks ?? 0,
    sections: [{ name: "Ebook practice", from: 0, to: questions.length }],
    questions: questions.map((q, index) => ({
      ...q,
      id: q.id || `${book.slug}-q${index}`,
      topic: book.slug,
      topicName: book.title,
      section: 0,
    })),
  };
}
export function ebookLink(slug: string, chapter?: string) {
  const url = new URL(
    `/certifications/learn/${encodeURIComponent(slug)}`,
    window.location.origin,
  );
  if (chapter) url.searchParams.set("chapter", chapter);
  return url.toString();
}
