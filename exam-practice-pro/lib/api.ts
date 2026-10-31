/**
 * Backend API client for Exam Practice Pro.
 *
 * All calls go through the Express backend at NEXT_PUBLIC_API_URL.
 * Authentication uses a short-lived JWT minted by `/api/auth/backend-token`.
 */

// A production Vercel build must never call the visitor's localhost when the
// public API environment variable is missing or accidentally left at localhost.
// The deployed Render service is the stable default for this ExamPro project.
const configuredApi = (process.env.NEXT_PUBLIC_API_URL || '').trim();
const productionFallback = 'https://quiz-app-regd.onrender.com';
const developmentFallback = 'http://localhost:3001';
function pointsToLocalHost(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1';
  } catch { return false; }
}
const candidateApi = process.env.NODE_ENV === 'production' &&
    (!configuredApi || pointsToLocalHost(configuredApi))
  ? productionFallback
  : configuredApi || (process.env.NODE_ENV === 'production' ? productionFallback : developmentFallback);
export const API_BASE_URL = candidateApi.endsWith('/') ? candidateApi.slice(0, -1) : candidateApi;

// Do not cache bearer tokens across account switches in a browser tab.

/**
 * Get a fresh backend access token from the NextAuth bridge route.
 * Caches the token for 50 minutes (tokens are valid for 1 hour).
 */
export async function getBackendToken(signal?: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/backend-token', {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return data.token;
  } catch {
    return null;
  }
}

/** Clear the cached token (call on sign-out). */
export function clearTokenCache(): void {
  // No token cache. Kept for backwards compatibility with sign-out handlers.
}

interface ApiOptions {
  signal?: AbortSignal;
  method?: string;
  body?: unknown;
  /** Skip authentication (for public endpoints). */
  public?: boolean;
  /** Permit an anonymous request while attaching identity if available (public mocks). */
  optionalAuth?: boolean;
}

/**
 * Make an authenticated request to the backend API.
 */
export async function api<T = unknown>(
  path: string,
  options: ApiOptions = {}
): Promise<{ success: boolean; data?: T; error?: { message: string; code?: string; status?: number } }> {
  const { method = 'GET', body, public: isPublic = false, optionalAuth = false, signal } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (!isPublic) {
    const token = await getBackendToken(signal);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    } else if (!optionalAuth) {
      return {success:false,error:{code:'VERIFIED_OAUTH_REQUIRED',message:'Verified Google or GitHub login is required. If already signed in, check OAuth provider email verification and Vercel AUTH_SECRET.'}};
    }
  }

  const url = `${API_BASE_URL}${path}`;

  let res: Response;
  try { res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    signal,
  }); } catch { return {success:false,error:{code:'API_UNAVAILABLE',message:'ExamPro API unavailable. Check the Render service and NEXT_PUBLIC_API_URL.'}}; }
  let json;
  try { json = await res.json(); } catch { return {success:false,error:{code:'INVALID_API_RESPONSE',message:'The configured API returned a non-JSON response. Check which service runs on Render.'}}; }
  if (!res.ok) return {success:false,error:{...json.error,status:res.status,message:json.error?.message||'API request failed ('+res.status+')'}};
  return json;
}

// ─── Typed API helpers ──────────────────────────────────

export interface BackendQuizAttempt {
  id: string;
  quiz_id: string;
  quiz_title: string;
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  time_spent_s: number | null;
  completed_at: string;
}

export interface BackendStats {
  totalAttempts: number;
  averageScore: number;
  strongestTopic: string | null;
  weakestTopic: string | null;
  streak: number;
  lastAttemptDate: string | null;
  topicStats: Record<string, { correct: number; total: number }>;
  recentQuizzes: Array<{
    quizId: string;
    quizTitle: string;
    score: number;
    totalQuestions: number;
    percentage: number;
    passed: boolean;
    timeTaken: number | null;
    completedAt: string;
  }>;
}

export interface BackendBookmark {
  id: string;
  quizId: string;
  questionId: string;
  note: string | null;
  createdAt: string;
}

export interface BackendNote {
  id: string;
  quizId: string;
  questionId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackendUserProfile {
  user: {
    id: string;
    email: string | null;
    name: string | null;
    image: string | null;
    role: string;
    paymentStatus: string;
    plan?: string;
    planActive?: boolean;
    planExpiresAt?: string | null;
    createdAt: string;
  };
  isGuest: boolean;
}

// ── Quiz attempts ──────────────────────────────────────

export async function submitQuizAttempt(attempt: {
  quizId: string;
  quizTitle: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  passed: boolean;
  timeTaken: number;
  answers: Record<string, unknown>;
  topicPerformance: unknown[];
  difficultyPerformance: unknown[];
  startedAt: number;
  completedAt: number;
}) {
  return api<BackendQuizAttempt>('/api/v1/quiz/attempts', {
    method: 'POST',
    body: attempt,
  });
}

export async function getQuizAttempts(limit = 50, offset = 0) {
  return api<BackendQuizAttempt[]>(
    `/api/v1/quiz/attempts?limit=${limit}&offset=${offset}`
  );
}

export async function getQuizStats() {
  return api<BackendStats>('/api/v1/quiz/stats');
}

// ── Bookmarks ──────────────────────────────────────────

export async function getBookmarksFromAPI() {
  return api<BackendBookmark[]>('/api/v1/user/bookmarks');
}

export async function addBookmarkToAPI(quizId: string, questionId: string, note?: string) {
  return api<BackendBookmark>('/api/v1/user/bookmarks', {
    method: 'POST',
    body: { quizId, questionId, note },
  });
}

export async function removeBookmarkFromAPI(quizId: string, questionId: string) {
  return api(`/api/v1/user/bookmarks/${encodeURIComponent(quizId)}/${encodeURIComponent(questionId)}`, {
    method: 'DELETE',
  });
}

// ── Notes ──────────────────────────────────────────────

export async function getNotesFromAPI() {
  return api<BackendNote[]>('/api/v1/user/notes');
}

export async function saveNoteToAPI(quizId: string, questionId: string, content: string) {
  return api<BackendNote>('/api/v1/user/notes', {
    method: 'POST',
    body: { quizId, questionId, content },
  });
}

export async function deleteNoteFromAPI(quizId: string, questionId: string) {
  return api(`/api/v1/user/notes/${encodeURIComponent(quizId)}/${encodeURIComponent(questionId)}`, {
    method: 'DELETE',
  });
}

// ── User ───────────────────────────────────────────────

export async function getUserProfile() {
  return api<BackendUserProfile>('/api/v1/user/profile');
}
