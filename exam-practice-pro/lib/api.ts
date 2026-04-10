/**
 * Backend API client for Exam Practice Pro.
 *
 * All calls go through the Express backend at NEXT_PUBLIC_API_URL.
 * Authentication uses a short-lived JWT minted by `/api/auth/backend-token`.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * Get a fresh backend access token from the NextAuth bridge route.
 * Caches the token for 50 minutes (tokens are valid for 1 hour).
 */
async function getBackendToken(): Promise<string | null> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  try {
    const res = await fetch('/api/auth/backend-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      cachedToken = null;
      return null;
    }

    const data = await res.json();
    cachedToken = data.token;
    // Cache for 50 minutes (tokens last 1 hour)
    tokenExpiresAt = Date.now() + 50 * 60 * 1000;
    return cachedToken;
  } catch {
    cachedToken = null;
    return null;
  }
}

/** Clear the cached token (call on sign-out). */
export function clearTokenCache(): void {
  cachedToken = null;
  tokenExpiresAt = 0;
}

interface ApiOptions {
  method?: string;
  body?: unknown;
  /** Skip authentication (for public endpoints). */
  public?: boolean;
}

/**
 * Make an authenticated request to the backend API.
 */
export async function api<T = unknown>(
  path: string,
  options: ApiOptions = {}
): Promise<{ success: boolean; data?: T; error?: { message: string } }> {
  const { method = 'GET', body, public: isPublic = false } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (!isPublic) {
    const token = await getBackendToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const url = `${API_BASE_URL}${path}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json();
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

// ── News ───────────────────────────────────────────────

export interface NewsArticle {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceDomain: string;
  description: string;
  imageUrl: string;
  author: string;
  publishedAt: string;
  category: string;
  region: string;
}

export interface NewsPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface NewsResponse {
  articles: NewsArticle[];
  pagination: NewsPagination;
  sources: Record<string, number>;
}

export async function getNews(params: {
  page?: number;
  pageSize?: number;
  query?: string;
  region?: string;
  category?: string;
} = {}) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));
  if (params.query) searchParams.set('query', params.query);
  if (params.region) searchParams.set('region', params.region);
  if (params.category) searchParams.set('category', params.category);

  return api<NewsResponse>(`/api/v1/news?${searchParams.toString()}`, { public: true });
}

export async function getTopNews(region?: string) {
  const params = region ? `?region=${region}` : '';
  return api<NewsResponse>(`/api/v1/news/top${params}`, { public: true });
}

// ── Sokal Bela ─────────────────────────────────────────

export async function createBooking(data: {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  serviceType: string;
  preferredDate: string;
  preferredTime?: string;
  notes?: string;
}) {
  return api('/api/v1/sokal-bela/book', {
    method: 'POST',
    body: data,
    public: true,
  });
}

export async function createOrder(data: {
  customerName: string;
  customerEmail: string;
  items: Array<{ itemName: string; quantity: number; pricePerUnit: number }>;
  deliveryAddress?: string;
  notes?: string;
}) {
  return api('/api/v1/sokal-bela/order', {
    method: 'POST',
    body: data,
    public: true,
  });
}
