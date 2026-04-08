import { QuizSession, QuizResult, DashboardStats, Bookmark, QuestionNote, QuestionReport, Achievement, AchievementType } from '@/lib/types';
import { getStoragePrefix } from '@/components/layout/user-storage-provider';

const BASE_KEYS = {
  SESSION: 'exam-practice-session',
  RESULTS: 'exam-practice-results',
  DASHBOARD_STATS: 'exam-practice-dashboard-stats',
  BOOKMARKS: 'exam-practice-bookmarks',
  NOTES: 'exam-practice-notes',
  REPORTS: 'exam-practice-reports',
  ACHIEVEMENTS: 'exam-practice-achievements',
} as const;

/** Returns user-scoped storage keys */
const STORAGE_KEYS = new Proxy(BASE_KEYS, {
  get(target, prop: string) {
    const base = target[prop as keyof typeof BASE_KEYS];
    if (!base) return undefined;
    const prefix = getStoragePrefix();
    return `${prefix}${base}`;
  },
}) as typeof BASE_KEYS;

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Safe JSON parse with validation
function safeJsonParse<T>(data: string | null, fallback: T): T {
  if (!data) return fallback;
  try {
    return JSON.parse(data);
  } catch {
    return fallback;
  }
}

// Check if localStorage is available and has space
function isStorageAvailable(): boolean {
  if (!isBrowser) return false;
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

// Handle storage quota exceeded
function handleStorageError(error: unknown): void {
  if (error instanceof DOMException) {
    if (error.name === 'QuotaExceededError' || error.code === 22) {
      console.warn('localStorage quota exceeded, clearing old data...');
      // Clear old sessions to make space
      clearOldSessions();
    }
  }
  console.error('Storage error:', error);
}

// Clear sessions older than 7 days
function clearOldSessions(): void {
  if (!isBrowser) return;
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const sessionPrefix = STORAGE_KEYS.SESSION;
  const keysToRemove: string[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(sessionPrefix)) {
      try {
        const data = localStorage.getItem(key);
        const session = safeJsonParse<{ startTime?: number } | null>(data, null);
        if (session?.startTime && session.startTime < oneWeekAgo) {
          keysToRemove.push(key);
        }
      } catch {
        keysToRemove.push(key);
      }
    }
  }
  
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

// Session Storage
export function saveSession(session: QuizSession): void {
  if (!isStorageAvailable()) return;
  try {
    localStorage.setItem(
      `${STORAGE_KEYS.SESSION}-${session.quizId}`,
      JSON.stringify(session)
    );
  } catch (error) {
    handleStorageError(error);
  }
}

export function loadSession(quizId: string): QuizSession | null {
  if (!isBrowser) return null;
  try {
    const data = localStorage.getItem(`${STORAGE_KEYS.SESSION}-${quizId}`);
    const session = safeJsonParse<QuizSession | null>(data, null);
    // Validate session structure
    if (session && typeof session.id === 'string' && Array.isArray(session.questionOrder)) {
      return session;
    }
    return null;
  } catch (error) {
    console.error('Failed to load session:', error);
    return null;
  }
}

export function clearSession(quizId: string): void {
  if (!isBrowser) return;
  try {
    localStorage.removeItem(`${STORAGE_KEYS.SESSION}-${quizId}`);
  } catch (error) {
    console.error('Failed to clear session:', error);
  }
}

// Quiz Results Storage
export function saveQuizResult(result: QuizResult): void {
  if (!isStorageAvailable()) return;
  try {
    const existingResults = loadQuizHistory();
    const updatedResults = [result, ...existingResults].slice(0, 50); // Keep last 50 results
    localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(updatedResults));
  } catch (error) {
    handleStorageError(error);
  }
}

export function loadQuizHistory(): QuizResult[] {
  if (!isBrowser) return [];
  try {
    const data = localStorage.getItem(STORAGE_KEYS.RESULTS);
    return safeJsonParse<QuizResult[]>(data, []);
  } catch (error) {
    console.error('Failed to load quiz history:', error);
    return [];
  }
}

export function getResultById(resultId: string): QuizResult | null {
  const results = loadQuizHistory();
  return results.find((r) => r.id === resultId) || null;
}

export function getResultBySessionId(sessionId: string): QuizResult | null {
  const results = loadQuizHistory();
  return results.find((r) => r.sessionId === sessionId) || null;
}

// Dashboard Stats Storage
const DEFAULT_DASHBOARD_STATS: DashboardStats = {
  totalAttempts: 0,
  averageScore: 0,
  strongestTopic: null,
  weakestTopic: null,
  streak: 0,
  lastAttemptDate: null,
  recentQuizzes: [],
  topicStats: {},
};

export function loadDashboardStats(): DashboardStats {
  if (!isBrowser) return DEFAULT_DASHBOARD_STATS;
  try {
    const data = localStorage.getItem(STORAGE_KEYS.DASHBOARD_STATS);
    return data ? { ...DEFAULT_DASHBOARD_STATS, ...JSON.parse(data) } : DEFAULT_DASHBOARD_STATS;
  } catch (error) {
    console.error('Failed to load dashboard stats:', error);
    return DEFAULT_DASHBOARD_STATS;
  }
}

export function saveDashboardStats(stats: DashboardStats): void {
  if (!isBrowser) return;
  try {
    localStorage.setItem(STORAGE_KEYS.DASHBOARD_STATS, JSON.stringify(stats));
  } catch (error) {
    console.error('Failed to save dashboard stats:', error);
  }
}

export function updateTopicStats(
  topic: string,
  correct: number,
  total: number
): void {
  if (!isBrowser) return;
  try {
    const stats = loadDashboardStats();
    const existingTopicStats = stats.topicStats[topic] || { correct: 0, total: 0 };
    
    stats.topicStats[topic] = {
      correct: existingTopicStats.correct + correct,
      total: existingTopicStats.total + total,
    };

    // Calculate strongest and weakest topics
    const topicEntries = Object.entries(stats.topicStats);
    if (topicEntries.length > 0) {
      let strongest = { topic: '', percentage: 0 };
      let weakest = { topic: '', percentage: 100 };

      topicEntries.forEach(([topicName, data]) => {
        const percentage = data.total > 0 ? (data.correct / data.total) * 100 : 0;
        if (percentage > strongest.percentage) {
          strongest = { topic: topicName, percentage };
        }
        if (percentage < weakest.percentage) {
          weakest = { topic: topicName, percentage };
        }
      });

      stats.strongestTopic = strongest.topic;
      stats.weakestTopic = weakest.topic;
    }

    saveDashboardStats(stats);
  } catch (error) {
    console.error('Failed to update topic stats:', error);
  }
}

// Streak Calculation with timezone-aware dates
export function updateStreak(): void {
  if (!isBrowser) return;
  try {
    const stats = loadDashboardStats();
    // Use locale date string for timezone awareness
    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA');

    if (stats.lastAttemptDate === today) {
      // Already played today, no change
      return;
    } else if (stats.lastAttemptDate === yesterday) {
      // Consecutive day, increment streak
      stats.streak += 1;
    } else {
      // Streak broken, reset to 1
      stats.streak = 1;
    }

    stats.lastAttemptDate = today;
    saveDashboardStats(stats);
  } catch (error) {
    console.error('Failed to update streak:', error);
  }
}

// Clear all data (fixed iteration mutation issue)
export function clearAllData(): void {
  if (!isBrowser) return;
  try {
    // Collect all keys first to avoid mutation during iteration
    const allKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) allKeys.push(key);
    }
    
    // Get current user-scoped prefixes
    const prefixes = Object.keys(BASE_KEYS).map(
      (k) => STORAGE_KEYS[k as keyof typeof BASE_KEYS]
    );
    
    // Now safely remove keys matching current user's scope
    allKeys.forEach((key) => {
      if (prefixes.some((prefix) => key.startsWith(prefix))) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.error('Failed to clear all data:', error);
  }
}

// ============ BOOKMARKS ============

export function loadBookmarks(): Bookmark[] {
  if (!isBrowser) return [];
  try {
    const data = localStorage.getItem(STORAGE_KEYS.BOOKMARKS);
    return safeJsonParse<Bookmark[]>(data, []);
  } catch {
    return [];
  }
}

export function saveBookmark(bookmark: Bookmark): void {
  if (!isStorageAvailable()) return;
  try {
    const bookmarks = loadBookmarks();
    const exists = bookmarks.some(
      (b) => b.questionId === bookmark.questionId && b.quizId === bookmark.quizId
    );
    if (!exists) {
      bookmarks.push(bookmark);
      localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));
    }
  } catch (error) {
    handleStorageError(error);
  }
}

export function removeBookmark(questionId: string, quizId: string): void {
  if (!isBrowser) return;
  try {
    const bookmarks = loadBookmarks().filter(
      (b) => !(b.questionId === questionId && b.quizId === quizId)
    );
    localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks));
  } catch (error) {
    console.error('Failed to remove bookmark:', error);
  }
}

export function isBookmarked(questionId: string, quizId: string): boolean {
  const bookmarks = loadBookmarks();
  return bookmarks.some(
    (b) => b.questionId === questionId && b.quizId === quizId
  );
}

// ============ QUESTION NOTES ============

export function loadNotes(): QuestionNote[] {
  if (!isBrowser) return [];
  try {
    const data = localStorage.getItem(STORAGE_KEYS.NOTES);
    return safeJsonParse<QuestionNote[]>(data, []);
  } catch {
    return [];
  }
}

export function saveNote(note: QuestionNote): void {
  if (!isStorageAvailable()) return;
  try {
    const notes = loadNotes();
    const existingIndex = notes.findIndex(
      (n) => n.questionId === note.questionId && n.quizId === note.quizId
    );
    if (existingIndex >= 0) {
      notes[existingIndex] = { ...note, updatedAt: Date.now() };
    } else {
      notes.push(note);
    }
    localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
  } catch (error) {
    handleStorageError(error);
  }
}

export function deleteNote(questionId: string, quizId: string): void {
  if (!isBrowser) return;
  try {
    const notes = loadNotes().filter(
      (n) => !(n.questionId === questionId && n.quizId === quizId)
    );
    localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
  } catch (error) {
    console.error('Failed to delete note:', error);
  }
}

export function getNote(questionId: string, quizId: string): QuestionNote | null {
  const notes = loadNotes();
  return notes.find(
    (n) => n.questionId === questionId && n.quizId === quizId
  ) || null;
}

// ============ QUESTION REPORTS ============

export function loadReports(): QuestionReport[] {
  if (!isBrowser) return [];
  try {
    const data = localStorage.getItem(STORAGE_KEYS.REPORTS);
    return safeJsonParse<QuestionReport[]>(data, []);
  } catch {
    return [];
  }
}

export function saveReport(report: QuestionReport): void {
  if (!isStorageAvailable()) return;
  try {
    const reports = loadReports();
    reports.push(report);
    localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(reports));
  } catch (error) {
    handleStorageError(error);
  }
}

// ============ ACHIEVEMENTS ============

const ACHIEVEMENT_DEFINITIONS: Record<AchievementType, Omit<Achievement, 'id' | 'unlockedAt' | 'progress'>> = {
  'first-quiz': {
    name: 'First Steps',
    description: 'Complete your first quiz',
    icon: '🎯',
    target: 1,
  },
  'perfect-score': {
    name: 'Perfect Score',
    description: 'Score 100% on any quiz',
    icon: '💯',
  },
  'streak-3': {
    name: 'Getting Started',
    description: 'Maintain a 3-day streak',
    icon: '🔥',
    target: 3,
  },
  'streak-7': {
    name: 'Week Warrior',
    description: 'Maintain a 7-day streak',
    icon: '⚡',
    target: 7,
  },
  'streak-30': {
    name: 'Monthly Master',
    description: 'Maintain a 30-day streak',
    icon: '🏆',
    target: 30,
  },
  'quiz-master-10': {
    name: 'Quiz Enthusiast',
    description: 'Complete 10 quizzes',
    icon: '📚',
    target: 10,
  },
  'quiz-master-50': {
    name: 'Quiz Master',
    description: 'Complete 50 quizzes',
    icon: '🎓',
    target: 50,
  },
  'speed-demon': {
    name: 'Speed Demon',
    description: 'Complete a quiz with 80%+ in under 5 minutes',
    icon: '⚡',
  },
  'studious': {
    name: 'Studious',
    description: 'Add 10 notes to questions',
    icon: '📝',
    target: 10,
  },
  'bookworm': {
    name: 'Bookworm',
    description: 'Bookmark 20 questions',
    icon: '📖',
    target: 20,
  },
};

export function loadAchievements(): Achievement[] {
  if (!isBrowser) return [];
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ACHIEVEMENTS);
    const saved = safeJsonParse<Achievement[]>(data, []);
    
    // Merge with definitions to ensure all achievements exist
    return Object.entries(ACHIEVEMENT_DEFINITIONS).map(([id, def]) => {
      const existing = saved.find((a) => a.id === id);
      return {
        id: id as AchievementType,
        ...def,
        progress: existing?.progress || 0,
        unlockedAt: existing?.unlockedAt,
      };
    });
  } catch {
    return [];
  }
}

export function unlockAchievement(achievementId: AchievementType): boolean {
  if (!isStorageAvailable()) return false;
  try {
    const achievements = loadAchievements();
    const achievement = achievements.find((a) => a.id === achievementId);
    
    if (achievement && !achievement.unlockedAt) {
      achievement.unlockedAt = Date.now();
      localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(achievements));
      return true; // Newly unlocked
    }
    return false;
  } catch {
    return false;
  }
}

export function updateAchievementProgress(achievementId: AchievementType, progress: number): boolean {
  if (!isStorageAvailable()) return false;
  try {
    const achievements = loadAchievements();
    const achievement = achievements.find((a) => a.id === achievementId);
    
    if (achievement) {
      achievement.progress = progress;
      if (achievement.target && progress >= achievement.target && !achievement.unlockedAt) {
        achievement.unlockedAt = Date.now();
        localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(achievements));
        return true; // Achievement unlocked
      }
      localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(achievements));
    }
    return false;
  } catch {
    return false;
  }
}

// Check and unlock achievements after quiz completion
export function checkQuizAchievements(result: QuizResult, streak: number): AchievementType[] {
  const unlocked: AchievementType[] = [];
  const history = loadQuizHistory();
  
  // First quiz
  if (history.length === 1 && unlockAchievement('first-quiz')) {
    unlocked.push('first-quiz');
  }
  
  // Perfect score
  if (result.percentage === 100 && unlockAchievement('perfect-score')) {
    unlocked.push('perfect-score');
  }
  
  // Speed demon (80%+ in under 5 minutes)
  if (result.percentage >= 80 && result.timeTaken < 300 && unlockAchievement('speed-demon')) {
    unlocked.push('speed-demon');
  }
  
  // Quiz count achievements
  if (updateAchievementProgress('quiz-master-10', history.length)) {
    unlocked.push('quiz-master-10');
  }
  if (updateAchievementProgress('quiz-master-50', history.length)) {
    unlocked.push('quiz-master-50');
  }
  
  // Streak achievements
  if (updateAchievementProgress('streak-3', streak)) {
    unlocked.push('streak-3');
  }
  if (updateAchievementProgress('streak-7', streak)) {
    unlocked.push('streak-7');
  }
  if (updateAchievementProgress('streak-30', streak)) {
    unlocked.push('streak-30');
  }
  
  // Check bookmark count
  const bookmarks = loadBookmarks();
  if (updateAchievementProgress('bookworm', bookmarks.length)) {
    unlocked.push('bookworm');
  }
  
  // Check notes count
  const notes = loadNotes();
  if (updateAchievementProgress('studious', notes.length)) {
    unlocked.push('studious');
  }
  
  return unlocked;
}
