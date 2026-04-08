'use client';

import { useState, useEffect, useCallback, useMemo, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  Trash2,
  Send,
  Pause,
  Play,
  Maximize,
  Menu,
  AlertTriangle,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Timer } from '@/components/quiz/timer';
import { ProgressBar } from '@/components/quiz/progress-bar';
import { QuestionPanel } from '@/components/quiz/question-panel';
import { QuestionNavigator } from '@/components/quiz/question-navigator';
import { SettingsPanel } from '@/components/quiz/settings-panel';
import { FullPageLoader } from '@/components/shared/full-page-loader';
import { useQuizStore } from '@/store/quiz-store';
import { useTimer } from '@/hooks/use-timer';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { getQuestionStatus, shuffleArray, isAnswerCorrect } from '@/lib/quiz-utils';
import { QuestionOption } from '@/lib/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function QuizTakePage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const {
    currentQuiz,
    session,
    appSettings,
    answerQuestion,
    toggleMarkForReview,
    clearAnswer,
    goToQuestion,
    nextQuestion,
    previousQuestion,
    submitQuiz,
    pauseQuiz,
    resumeQuiz,
    updateAppSettings,
    resetQuiz,
  } = useQuizStore();

  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [shuffledOptionsMap, setShuffledOptionsMap] = useState<
    Record<string, QuestionOption[]>
  >({});

  // Calculate time limit in seconds
  const timeLimitSeconds = session?.settings.timed
    ? session.settings.timeLimit * 60
    : 0;

  // Calculate elapsed time and remaining time
  const getElapsedSeconds = useCallback(() => {
    if (!session) return 0;
    const elapsed = Math.floor(
      (Date.now() - session.startTime - session.totalPausedTime) / 1000
    );
    return elapsed;
  }, [session]);

  const initialTimeLeft = useMemo(() => {
    if (!session?.settings.timed) return 0;
    const elapsed = getElapsedSeconds();
    return Math.max(0, timeLimitSeconds - elapsed);
  }, [session?.settings.timed, timeLimitSeconds, getElapsedSeconds]);

  // Timer hook
  const { timeLeft, isWarning, isDanger, isExpired } = useTimer({
    initialTime: initialTimeLeft,
    onTimeUp: () => {
      handleSubmit();
    },
    isPaused: session?.isPaused || !session?.settings.timed,
  });

  // Shuffle options on mount if enabled
  useEffect(() => {
    if (currentQuiz && session?.settings.shuffleAnswers) {
      const optionsMap: Record<string, QuestionOption[]> = {};
      currentQuiz.questions.forEach((q) => {
        optionsMap[q.id] = shuffleArray([...q.options]);
      });
      setShuffledOptionsMap(optionsMap);
    }
  }, [currentQuiz, session?.settings.shuffleAnswers]);

  // Get current question
  const currentQuestion = useMemo(() => {
    if (!currentQuiz || !session) return null;
    const questionId = session.questionOrder[session.currentQuestionIndex];
    return currentQuiz.questions.find((q) => q.id === questionId) || null;
  }, [currentQuiz, session]);

  // Get current answer
  const currentAnswer = useMemo(() => {
    if (!currentQuestion || !session) return [];
    return session.answers[currentQuestion.id]?.selectedAnswers || [];
  }, [currentQuestion, session]);

  // Count answered questions
  const answeredCount = useMemo(() => {
    if (!session) return 0;
    return Object.values(session.answers).filter(
      (a) => a.selectedAnswers.length > 0
    ).length;
  }, [session]);

  // Handle answer selection
  const handleSelectAnswer = useCallback(
    (answerId: string) => {
      if (!currentQuestion || !session) return;

      let newAnswers: string[];
      if (currentQuestion.type === 'multiple') {
        // Multiple select - toggle the answer
        if (currentAnswer.includes(answerId)) {
          newAnswers = currentAnswer.filter((id) => id !== answerId);
        } else {
          newAnswers = [...currentAnswer, answerId];
        }
      } else {
        // Single select or true/false - replace the answer
        newAnswers = [answerId];
      }

      answerQuestion(currentQuestion.id, newAnswers);
    },
    [currentQuestion, session, currentAnswer, answerQuestion]
  );

  // Handle keyboard answer selection
  const handleKeyboardAnswer = useCallback(
    (index: number) => {
      if (!currentQuestion) return;
      const options =
        shuffledOptionsMap[currentQuestion.id] || currentQuestion.options;
      if (index < options.length) {
        handleSelectAnswer(options[index].id);
      }
    },
    [currentQuestion, shuffledOptionsMap, handleSelectAnswer]
  );

  // Get question status
  const getStatus = useCallback(
    (questionId: string) => {
      if (!session) return 'unanswered' as const;
      return getQuestionStatus(questionId, session, session.currentQuestionIndex);
    },
    [session]
  );

  // Handle submit
  const handleSubmit = useCallback(() => {
    const result = submitQuiz();
    if (result) {
      router.push(`/quiz/${id}/result`);
    }
  }, [submitQuiz, router, id]);

  // Submit dialog trigger
  const openSubmitDialog = useCallback(() => {
    if (appSettings.confirmBeforeSubmit) {
      setShowSubmitDialog(true);
    } else {
      handleSubmit();
    }
  }, [appSettings.confirmBeforeSubmit, handleSubmit]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNext: nextQuestion,
    onPrevious: previousQuestion,
    onMarkForReview: () =>
      currentQuestion && toggleMarkForReview(currentQuestion.id),
    onSelectAnswer: handleKeyboardAnswer,
    onSubmit: openSubmitDialog,
    enabled: appSettings.keyboardShortcutsEnabled && !showSubmitDialog && !showExitDialog,
  });

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  // Handle exit
  const handleExit = useCallback(() => {
    setShowExitDialog(false);
    router.push('/');
  }, [router]);

  // Redirect if no session
  useEffect(() => {
    if (!session || !currentQuiz || session.quizId !== id) {
      router.push(`/quiz/${id}/setup`);
    }
  }, [session, currentQuiz, id, router]);

  if (!session || !currentQuiz || !currentQuestion) {
    return <FullPageLoader message="Loading quiz..." />;
  }

  const isMarked = session.markedForReview.includes(currentQuestion.id);
  const showImmediateFeedback =
    session.settings.mode === 'practice' &&
    session.settings.showExplanationsMode === 'immediate' &&
    currentAnswer.length > 0;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-background">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center justify-between gap-4 px-4">
          {/* Left: Quiz Title */}
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => setShowExitDialog(true)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Exit</span>
            </Button>
            <h1 className="font-semibold truncate hidden sm:block">
              {currentQuiz.title}
            </h1>
          </div>

          {/* Center: Progress and Timer */}
          <div className="flex items-center gap-4">
            <ProgressBar
              current={session.currentQuestionIndex + 1}
              total={session.questionOrder.length}
              answered={answeredCount}
            />
            {session.settings.timed && (
              <Timer
                timeLeft={timeLeft}
                isWarning={isWarning}
                isDanger={isDanger}
                visible={appSettings.timerVisible}
              />
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 hidden sm:flex"
              onClick={toggleFullscreen}
            >
              <Maximize className="h-4 w-4" />
              <span className="sr-only">Fullscreen</span>
            </Button>

            <SettingsPanel
              settings={appSettings}
              onUpdateSettings={updateAppSettings}
            />

            {session.settings.timed && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={session.isPaused ? resumeQuiz : pauseQuiz}
              >
                {session.isPaused ? (
                  <Play className="h-4 w-4" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
                <span className="sr-only">
                  {session.isPaused ? 'Resume' : 'Pause'}
                </span>
              </Button>
            )}

            <Button
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 hidden sm:flex"
              onClick={openSubmitDialog}
            >
              <Send className="mr-2 h-4 w-4" />
              Submit
            </Button>

            {/* Mobile Nav Toggle */}
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Question Navigator</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px]">
                <SheetHeader>
                  <SheetTitle>Questions</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <QuestionNavigator
                    questions={session.questionOrder}
                    currentIndex={session.currentQuestionIndex}
                    getStatus={getStatus}
                    onNavigate={(index) => {
                      goToQuestion(index);
                      setMobileNavOpen(false);
                    }}
                  />
                </div>
                <div className="mt-6">
                  <Button
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                    onClick={() => {
                      setMobileNavOpen(false);
                      openSubmitDialog();
                    }}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Submit Quiz
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1">
        {/* Sidebar - Desktop */}
        <aside className="hidden w-64 shrink-0 border-r bg-background p-4 lg:block">
          <QuestionNavigator
            questions={session.questionOrder}
            currentIndex={session.currentQuestionIndex}
            getStatus={getStatus}
            onNavigate={goToQuestion}
          />
        </aside>

        {/* Question Area */}
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto max-w-3xl px-4 py-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentQuestion.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="p-6">
                  <QuestionPanel
                    question={currentQuestion}
                    questionNumber={session.currentQuestionIndex + 1}
                    totalQuestions={session.questionOrder.length}
                    selectedAnswers={currentAnswer}
                    onSelectAnswer={handleSelectAnswer}
                    showFeedback={showImmediateFeedback}
                    shuffledOptions={shuffledOptionsMap[currentQuestion.id]}
                    quizId={id}
                  />

                  {/* Immediate Feedback - Practice Mode */}
                  {showImmediateFeedback && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-6 rounded-lg border p-4"
                    >
                      <div
                        className={`mb-2 font-medium ${
                          isAnswerCorrect(currentQuestion, currentAnswer)
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {isAnswerCorrect(currentQuestion, currentAnswer)
                          ? '✓ Correct!'
                          : '✗ Incorrect'}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {currentQuestion.explanation}
                      </p>
                    </motion.div>
                  )}

                  {/* Action Buttons */}
                  <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleMarkForReview(currentQuestion.id)}
                        className={isMarked ? 'bg-yellow-50 border-yellow-300' : ''}
                      >
                        <Flag
                          className={`mr-2 h-4 w-4 ${
                            isMarked ? 'fill-yellow-500 text-yellow-500' : ''
                          }`}
                        />
                        {isMarked ? 'Marked' : 'Mark for Review'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => clearAnswer(currentQuestion.id)}
                        disabled={currentAnswer.length === 0}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Clear
                      </Button>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={previousQuestion}
                        disabled={session.currentQuestionIndex === 0}
                      >
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        onClick={nextQuestion}
                        disabled={
                          session.currentQuestionIndex ===
                          session.questionOrder.length - 1
                        }
                        className="bg-indigo-600 hover:bg-indigo-700"
                      >
                        Next
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Submit Confirmation Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Quiz?</DialogTitle>
            <DialogDescription>
              Are you sure you want to submit your quiz?
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Questions:</span>
                <span className="font-medium">
                  {session.questionOrder.length}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Answered:</span>
                <span className="font-medium text-green-600">
                  {answeredCount}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Unanswered:</span>
                <span className="font-medium text-yellow-600">
                  {session.questionOrder.length - answeredCount}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Marked for Review:</span>
                <span className="font-medium text-blue-600">
                  {session.markedForReview.length}
                </span>
              </div>
            </div>

            {session.questionOrder.length - answeredCount > 0 && (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900 dark:bg-yellow-900/20">
                <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-600" />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  You have {session.questionOrder.length - answeredCount}{' '}
                  unanswered question(s). Unanswered questions will be marked as
                  skipped.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Continue Quiz
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700"
              onClick={handleSubmit}
            >
              Submit Quiz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exit Confirmation Dialog */}
      <Dialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exit Quiz?</DialogTitle>
            <DialogDescription>
              Your progress will be saved. You can continue later from where you
              left off.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExitDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleExit}>
              Exit Quiz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
