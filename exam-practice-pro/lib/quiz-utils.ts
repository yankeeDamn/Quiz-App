import {
  Question,
  QuizMeta,
  QuizSession,
  QuizResult,
  QuestionStatus,
  TopicPerformance,
  DifficultyPerformance,
  Difficulty,
  PASSING_SCORE,
} from '@/lib/types';

// Fisher-Yates shuffle algorithm
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Check if an answer is correct
export function isAnswerCorrect(
  question: Question,
  selectedAnswers: string[]
): boolean {
  if (selectedAnswers.length === 0) return false;
  if (selectedAnswers.length !== question.correctAnswers.length) return false;
  
  const sortedSelected = [...selectedAnswers].sort();
  const sortedCorrect = [...question.correctAnswers].sort();
  
  return sortedSelected.every((answer, index) => answer === sortedCorrect[index]);
}

// Calculate quiz results
export function calculateResults(
  session: QuizSession,
  quiz: QuizMeta,
  endTime: number
): QuizResult {
  const questions = quiz.questions.filter((q) =>
    session.questionOrder.includes(q.id)
  );
  
  let correct = 0;
  let incorrect = 0;
  let skipped = 0;

  // Topic and difficulty tracking
  const topicMap: Record<string, { correct: number; total: number }> = {};
  const difficultyMap: Record<Difficulty, { correct: number; total: number }> = {
    Easy: { correct: 0, total: 0 },
    Medium: { correct: 0, total: 0 },
    Hard: { correct: 0, total: 0 },
  };

  questions.forEach((question) => {
    const userAnswer = session.answers[question.id];
    
    // Initialize topic tracking
    if (!topicMap[question.topic]) {
      topicMap[question.topic] = { correct: 0, total: 0 };
    }
    topicMap[question.topic].total += 1;
    difficultyMap[question.difficulty].total += 1;

    if (!userAnswer || userAnswer.selectedAnswers.length === 0) {
      skipped += 1;
    } else if (isAnswerCorrect(question, userAnswer.selectedAnswers)) {
      correct += 1;
      topicMap[question.topic].correct += 1;
      difficultyMap[question.difficulty].correct += 1;
    } else {
      incorrect += 1;
    }
  });

  const totalQuestions = questions.length;
  const percentage = totalQuestions > 0 ? (correct / totalQuestions) * 100 : 0;
  const timeTaken = Math.floor((endTime - session.startTime - session.totalPausedTime) / 1000);

  // Calculate topic performance
  const topicPerformance: TopicPerformance[] = Object.entries(topicMap).map(
    ([topic, data]) => ({
      topic,
      correct: data.correct,
      total: data.total,
      percentage: data.total > 0 ? (data.correct / data.total) * 100 : 0,
    })
  );

  // Calculate difficulty performance
  const difficultyPerformance: DifficultyPerformance[] = (
    Object.entries(difficultyMap) as [Difficulty, { correct: number; total: number }][]
  )
    .filter(([, data]) => data.total > 0)
    .map(([difficulty, data]) => ({
      difficulty,
      correct: data.correct,
      total: data.total,
      percentage: data.total > 0 ? (data.correct / data.total) * 100 : 0,
    }));

  return {
    id: `result-${Date.now()}`,
    sessionId: session.id,
    quizId: quiz.id,
    quizTitle: quiz.title,
    score: correct,
    percentage: Math.round(percentage * 100) / 100,
    correct,
    incorrect,
    skipped,
    timeTaken,
    totalQuestions,
    passed: percentage >= PASSING_SCORE,
    passingScore: PASSING_SCORE,
    topicPerformance,
    difficultyPerformance,
    completedAt: Date.now(),
  };
}

// Get question status for navigator
export function getQuestionStatus(
  questionId: string,
  session: QuizSession,
  currentIndex: number
): QuestionStatus {
  const questionIndex = session.questionOrder.indexOf(questionId);
  
  if (questionIndex === currentIndex) {
    return 'current';
  }
  
  if (session.markedForReview.includes(questionId)) {
    return 'marked';
  }
  
  const answer = session.answers[questionId];
  if (answer && answer.selectedAnswers.length > 0) {
    return 'answered';
  }
  
  return 'unanswered';
}

// Format time display
export function formatTime(seconds: number): string {
  if (seconds < 0) seconds = 0;
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Format duration for display
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// Get difficulty color
export function getDifficultyColor(difficulty: Difficulty): string {
  switch (difficulty) {
    case 'Easy':
      return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30';
    case 'Medium':
      return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30';
    case 'Hard':
      return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30';
    default:
      return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30';
  }
}

// Get question type label
export function getQuestionTypeLabel(type: string): string {
  switch (type) {
    case 'single':
      return 'Single Choice';
    case 'multiple':
      return 'Multiple Select';
    case 'true-false':
      return 'True/False';
    default:
      return type;
  }
}

// Calculate progress percentage
export function calculateProgress(session: QuizSession): number {
  const answered = Object.values(session.answers).filter(
    (a) => a.selectedAnswers.length > 0
  ).length;
  return (answered / session.questionOrder.length) * 100;
}

// Get remaining time in seconds
export function getRemainingTime(session: QuizSession): number {
  if (!session.settings.timed) return -1;
  
  const timeLimit = session.settings.timeLimit * 60; // Convert to seconds
  const elapsed = Math.floor(
    (Date.now() - session.startTime - session.totalPausedTime) / 1000
  );
  
  return Math.max(0, timeLimit - elapsed);
}

// Check if time is expired
export function isTimeExpired(session: QuizSession): boolean {
  if (!session.settings.timed) return false;
  return getRemainingTime(session) <= 0;
}

// Get answer label (A, B, C, D)
export function getAnswerLabel(index: number): string {
  return String.fromCharCode(65 + index); // A = 65 in ASCII
}

// Generate a unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Get status badge color classes (reduces duplication across components)
export type StatusType = 'correct' | 'incorrect' | 'skipped' | 'marked' | 'answered' | 'unanswered';

export function getStatusColor(status: StatusType): string {
  switch (status) {
    case 'correct':
    case 'answered':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'incorrect':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    case 'skipped':
    case 'marked':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    case 'unanswered':
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  }
}

// Get count of answered questions in a session
export function getAnsweredCount(session: QuizSession): number {
  return Object.values(session.answers).filter(
    (a) => a.selectedAnswers.length > 0
  ).length;
}

// Validate session data integrity
export function isValidSession(session: unknown): session is QuizSession {
  if (!session || typeof session !== 'object') return false;
  const s = session as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    typeof s.quizId === 'string' &&
    Array.isArray(s.questionOrder) &&
    typeof s.answers === 'object' &&
    typeof s.startTime === 'number'
  );
}

// Get timezone-aware date string for streak calculation
export function getLocalDateString(date: Date = new Date()): string {
  return date.toLocaleDateString('en-CA'); // Returns YYYY-MM-DD format
}
