// Question Types
export type QuestionType = 'single' | 'multiple' | 'true-false';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type QuestionStatus = 'unanswered' | 'answered' | 'current' | 'marked';

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Question {
  id: string;
  subject: string;
  topic: string;
  difficulty: Difficulty;
  type: QuestionType;
  question: string;
  options: QuestionOption[];
  correctAnswers: string[];
  explanation: string;
  imageUrl?: string;
}

// Quiz Metadata
export interface QuizMeta {
  id: string;
  title: string;
  subject: string;
  description: string;
  questions: Question[];
  difficulty: Difficulty;
  duration: number; // in minutes
  tags: string[];
  questionCount: number;
}

// Quiz Settings for Setup
export interface QuizSettings {
  questionCount: number;
  difficulty: Difficulty | 'all';
  timed: boolean;
  timeLimit: number; // in minutes
  shuffleQuestions: boolean;
  shuffleAnswers: boolean;
  showExplanationsMode: 'immediate' | 'end';
  mode: 'practice' | 'exam';
}

// User Answer for a Question
export interface UserAnswer {
  questionId: string;
  selectedAnswers: string[];
  timeSpent: number; // in seconds
  isMarked: boolean;
  answeredAt?: number; // timestamp
}

// Quiz Session State
export interface QuizSession {
  id: string;
  quizId: string;
  settings: QuizSettings;
  startTime: number;
  endTime?: number;
  answers: Record<string, UserAnswer>;
  markedForReview: string[];
  currentQuestionIndex: number;
  questionOrder: string[]; // ordered question IDs (possibly shuffled)
  isPaused: boolean;
  pausedAt?: number;
  totalPausedTime: number;
}

// Topic Performance
export interface TopicPerformance {
  topic: string;
  correct: number;
  total: number;
  percentage: number;
}

// Difficulty Performance
export interface DifficultyPerformance {
  difficulty: Difficulty;
  correct: number;
  total: number;
  percentage: number;
}

// Quiz Result
export interface QuizResult {
  id: string;
  sessionId: string;
  quizId: string;
  quizTitle: string;
  score: number;
  percentage: number;
  correct: number;
  incorrect: number;
  skipped: number;
  timeTaken: number; // in seconds
  totalQuestions: number;
  passed: boolean;
  passingScore: number;
  topicPerformance: TopicPerformance[];
  difficultyPerformance: DifficultyPerformance[];
  completedAt: number;
}

// Dashboard Stats
export interface DashboardStats {
  totalAttempts: number;
  averageScore: number;
  strongestTopic: string | null;
  weakestTopic: string | null;
  streak: number;
  lastAttemptDate: string | null;
  recentQuizzes: QuizResult[];
  topicStats: Record<string, { correct: number; total: number }>;
}

// App Settings
export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  timerVisible: boolean;
  soundEnabled: boolean;
  confirmBeforeSubmit: boolean;
  compactMode: boolean;
  keyboardShortcutsEnabled: boolean;
}

// Filter State for Landing Page
export interface QuizFilters {
  search: string;
  subjects: string[];
  difficulties: Difficulty[];
  questionTypes: QuestionType[];
}

// Review Filter
export type ReviewFilter = 'all' | 'incorrect' | 'skipped' | 'marked' | 'correct';

// Default Settings
export const DEFAULT_QUIZ_SETTINGS: QuizSettings = {
  questionCount: 10,
  difficulty: 'all',
  timed: true,
  timeLimit: 30,
  shuffleQuestions: true,
  shuffleAnswers: true,
  showExplanationsMode: 'end',
  mode: 'exam',
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'system',
  fontSize: 'medium',
  timerVisible: true,
  soundEnabled: false,
  confirmBeforeSubmit: true,
  compactMode: false,
  keyboardShortcutsEnabled: true,
};

export const PASSING_SCORE = 70; // percentage

// Exam Provider (like Microsoft, AWS, Google, CompTIA)
export interface ExamProvider {
  id: string;
  name: string;
  logo?: string;
  description: string;
  examCount: number;
  color: string; // brand color for UI
}

// Enhanced Quiz Meta with provider info
export interface ExamMeta extends QuizMeta {
  provider: string;
  examCode: string; // e.g., "AZ-900", "AWS-SAA-C03"
  lastUpdated: string;
  questionCountTotal: number;
  passRate?: number;
  estimatedTime: number;
  prerequisites?: string[];
  relatedExams?: string[];
  popularity: number; // for sorting
}

// Bookmark/Favorite
export interface Bookmark {
  questionId: string;
  quizId: string;
  createdAt: number;
  note?: string;
}

// Question Note
export interface QuestionNote {
  questionId: string;
  quizId: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

// Report Question
export interface QuestionReport {
  questionId: string;
  quizId: string;
  type: 'incorrect-answer' | 'outdated' | 'unclear' | 'typo' | 'other';
  description: string;
  createdAt: number;
}

// Flashcard Study Mode
export interface FlashcardSession {
  id: string;
  quizId: string;
  questionIds: string[];
  currentIndex: number;
  knownCount: number;
  unknownCount: number;
  startedAt: number;
  completedAt?: number;
}

// Achievement/Badge
export type AchievementType = 
  | 'first-quiz'
  | 'perfect-score'
  | 'streak-3'
  | 'streak-7'
  | 'streak-30'
  | 'quiz-master-10'
  | 'quiz-master-50'
  | 'speed-demon'
  | 'studious'
  | 'bookworm';

export interface Achievement {
  id: AchievementType;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: number;
  progress?: number;
  target?: number;
}

// Study Plan
export interface StudyPlan {
  id: string;
  examId: string;
  targetDate: string;
  dailyGoal: number; // questions per day
  createdAt: number;
  completedDays: string[]; // ISO date strings
}

// Extended Dashboard Stats
export interface ExtendedDashboardStats extends DashboardStats {
  bookmarkCount: number;
  noteCount: number;
  achievements: Achievement[];
  studyPlans: StudyPlan[];
  totalStudyTime: number; // in seconds
  questionsAttempted: number;
  examProgress: Record<string, { completed: number; total: number }>;
}
