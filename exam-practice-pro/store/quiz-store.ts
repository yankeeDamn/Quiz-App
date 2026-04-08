'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  QuizMeta,
  QuizSession,
  QuizSettings,
  UserAnswer,
  AppSettings,
  DEFAULT_QUIZ_SETTINGS,
  DEFAULT_APP_SETTINGS,
  QuizResult,
} from '@/lib/types';
import { getAnyQuizById } from '@/data/quizzes';
import { shuffleArray, calculateResults } from '@/lib/quiz-utils';
import { saveQuizResult, loadDashboardStats, saveDashboardStats, updateStreak, checkQuizAchievements } from '@/lib/storage';

interface QuizState {
  // Current Quiz State
  currentQuiz: QuizMeta | null;
  session: QuizSession | null;
  lastResult: QuizResult | null;

  // App Settings
  appSettings: AppSettings;

  // Actions
  startQuiz: (quizId: string, settings: QuizSettings) => void;
  answerQuestion: (questionId: string, answers: string[]) => void;
  toggleMarkForReview: (questionId: string) => void;
  clearAnswer: (questionId: string) => void;
  goToQuestion: (index: number) => void;
  nextQuestion: () => void;
  previousQuestion: () => void;
  submitQuiz: () => QuizResult | null;
  pauseQuiz: () => void;
  resumeQuiz: () => void;
  resetQuiz: () => void;
  updateAppSettings: (settings: Partial<AppSettings>) => void;
  restoreSession: (quizId: string) => boolean;
}

export const useQuizStore = create<QuizState>()(
  persist(
    (set, get) => ({
      currentQuiz: null,
      session: null,
      lastResult: null,
      appSettings: DEFAULT_APP_SETTINGS,

      startQuiz: (quizId, settings) => {
        const quiz = getAnyQuizById(quizId);
        if (!quiz) return;

        // Filter questions by difficulty if specified
        let filteredQuestions = quiz.questions;
        if (settings.difficulty !== 'all') {
          filteredQuestions = quiz.questions.filter(
            (q) => q.difficulty === settings.difficulty
          );
        }

        // Limit number of questions
        let selectedQuestions = filteredQuestions.slice(0, settings.questionCount);

        // Shuffle questions if enabled
        if (settings.shuffleQuestions) {
          selectedQuestions = shuffleArray([...selectedQuestions]);
        }

        // Create question order
        const questionOrder = selectedQuestions.map((q) => q.id);

        // Create new session
        const session: QuizSession = {
          id: `session-${Date.now()}`,
          quizId,
          settings,
          startTime: Date.now(),
          answers: {},
          markedForReview: [],
          currentQuestionIndex: 0,
          questionOrder,
          isPaused: false,
          totalPausedTime: 0,
        };

        // Update quiz with selected questions
        const activeQuiz = {
          ...quiz,
          questions: selectedQuestions,
          questionCount: selectedQuestions.length,
        };

        set({ currentQuiz: activeQuiz, session, lastResult: null });
      },

      answerQuestion: (questionId, answers) => {
        const { session } = get();
        if (!session) return;

        const existingAnswer = session.answers[questionId];
        const newAnswer: UserAnswer = {
          questionId,
          selectedAnswers: answers,
          timeSpent: existingAnswer?.timeSpent || 0,
          isMarked: existingAnswer?.isMarked || false,
          answeredAt: Date.now(),
        };

        set({
          session: {
            ...session,
            answers: {
              ...session.answers,
              [questionId]: newAnswer,
            },
          },
        });
      },

      toggleMarkForReview: (questionId) => {
        const { session } = get();
        if (!session) return;

        const isMarked = session.markedForReview.includes(questionId);
        const markedForReview = isMarked
          ? session.markedForReview.filter((id) => id !== questionId)
          : [...session.markedForReview, questionId];

        // Update answer if exists
        const existingAnswer = session.answers[questionId];
        const updatedAnswers = existingAnswer
          ? {
              ...session.answers,
              [questionId]: { ...existingAnswer, isMarked: !isMarked },
            }
          : session.answers;

        set({
          session: {
            ...session,
            markedForReview,
            answers: updatedAnswers,
          },
        });
      },

      clearAnswer: (questionId) => {
        const { session } = get();
        if (!session) return;

        const { [questionId]: _, ...remainingAnswers } = session.answers;

        set({
          session: {
            ...session,
            answers: remainingAnswers,
          },
        });
      },

      goToQuestion: (index) => {
        const { session, currentQuiz } = get();
        if (!session || !currentQuiz) return;

        const maxIndex = session.questionOrder.length - 1;
        const validIndex = Math.max(0, Math.min(index, maxIndex));

        set({
          session: {
            ...session,
            currentQuestionIndex: validIndex,
          },
        });
      },

      nextQuestion: () => {
        const { session, currentQuiz } = get();
        if (!session || !currentQuiz) return;

        const nextIndex = Math.min(
          session.currentQuestionIndex + 1,
          session.questionOrder.length - 1
        );

        set({
          session: {
            ...session,
            currentQuestionIndex: nextIndex,
          },
        });
      },

      previousQuestion: () => {
        const { session } = get();
        if (!session) return;

        const prevIndex = Math.max(session.currentQuestionIndex - 1, 0);

        set({
          session: {
            ...session,
            currentQuestionIndex: prevIndex,
          },
        });
      },

      submitQuiz: () => {
        const { session, currentQuiz } = get();
        if (!session || !currentQuiz) return null;

        const endTime = Date.now();
        const result = calculateResults(session, currentQuiz, endTime);

        // Save result to localStorage
        saveQuizResult(result);

        // Update dashboard stats
        const stats = loadDashboardStats();
        const updatedStats = {
          ...stats,
          totalAttempts: stats.totalAttempts + 1,
          averageScore:
            (stats.averageScore * stats.totalAttempts + result.percentage) /
            (stats.totalAttempts + 1),
          lastAttemptDate: new Date().toISOString().split('T')[0],
          recentQuizzes: [result, ...stats.recentQuizzes].slice(0, 10),
        };
        saveDashboardStats(updatedStats);

        // Update streak and check achievements
        updateStreak();
        const reloadedStats = loadDashboardStats();
        checkQuizAchievements(result, reloadedStats.streak);

        set({
          session: {
            ...session,
            endTime,
          },
          lastResult: result,
        });

        return result;
      },

      pauseQuiz: () => {
        const { session } = get();
        if (!session || session.isPaused) return;

        set({
          session: {
            ...session,
            isPaused: true,
            pausedAt: Date.now(),
          },
        });
      },

      resumeQuiz: () => {
        const { session } = get();
        if (!session || !session.isPaused || !session.pausedAt) return;

        const pauseDuration = Date.now() - session.pausedAt;

        set({
          session: {
            ...session,
            isPaused: false,
            pausedAt: undefined,
            totalPausedTime: session.totalPausedTime + pauseDuration,
          },
        });
      },

      resetQuiz: () => {
        set({
          currentQuiz: null,
          session: null,
          lastResult: null,
        });
      },

      updateAppSettings: (settings) => {
        const { appSettings } = get();
        set({
          appSettings: {
            ...appSettings,
            ...settings,
          },
        });
      },

      restoreSession: (quizId) => {
        const { session, currentQuiz } = get();
        // Check if there's an existing session for this quiz
        if (session && session.quizId === quizId && !session.endTime) {
          // Session exists and is not completed
          return true;
        }
        return false;
      },
    }),
    {
      name: 'exam-practice-pro-storage',
      partialize: (state) => ({
        session: state.session,
        currentQuiz: state.currentQuiz,
        appSettings: state.appSettings,
        lastResult: state.lastResult,
      }),
    }
  )
);
