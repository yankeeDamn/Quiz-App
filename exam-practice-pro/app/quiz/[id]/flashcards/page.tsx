'use client';

import { useState, useEffect, useMemo, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  RotateCcw,
  Eye,
  EyeOff,
  ThumbsUp,
  ThumbsDown,
  Shuffle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { FullPageLoader } from '@/components/shared/full-page-loader';
import { getAnyQuizById } from '@/data/quizzes';
import { getDifficultyColor, shuffleArray } from '@/lib/quiz-utils';
import { Question } from '@/lib/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function FlashcardsPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const quiz = getAnyQuizById(id);

  const [cards, setCards] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [knownIds, setKnownIds] = useState<Set<string>>(new Set());
  const [unknownIds, setUnknownIds] = useState<Set<string>>(new Set());
  const [isComplete, setIsComplete] = useState(false);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    if (quiz) {
      setCards(shuffleArray([...quiz.questions]));
    }
  }, [quiz]);

  const currentCard = cards[currentIndex];
  const totalCards = cards.length;
  const reviewed = knownIds.size + unknownIds.size;
  const progressPercent = totalCards > 0 ? (reviewed / totalCards) * 100 : 0;

  const goNext = useCallback(() => {
    setShowAnswer(false);
    setDirection(1);
    if (currentIndex < totalCards - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setIsComplete(true);
    }
  }, [currentIndex, totalCards]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setShowAnswer(false);
      setDirection(-1);
      setCurrentIndex((i) => i - 1);
    }
  }, [currentIndex]);

  const markKnown = useCallback(() => {
    if (!currentCard) return;
    setKnownIds((prev) => new Set(prev).add(currentCard.id));
    setUnknownIds((prev) => {
      const next = new Set(prev);
      next.delete(currentCard.id);
      return next;
    });
    goNext();
  }, [currentCard, goNext]);

  const markUnknown = useCallback(() => {
    if (!currentCard) return;
    setUnknownIds((prev) => new Set(prev).add(currentCard.id));
    setKnownIds((prev) => {
      const next = new Set(prev);
      next.delete(currentCard.id);
      return next;
    });
    goNext();
  }, [currentCard, goNext]);

  const handleReset = useCallback(() => {
    setCards(shuffleArray([...(quiz?.questions || [])]));
    setCurrentIndex(0);
    setShowAnswer(false);
    setKnownIds(new Set());
    setUnknownIds(new Set());
    setIsComplete(false);
    setDirection(0);
  }, [quiz]);

  const handleStudyUnknown = useCallback(() => {
    const unknownQuestions = cards.filter((c) => unknownIds.has(c.id));
    if (unknownQuestions.length === 0) return;
    setCards(shuffleArray(unknownQuestions));
    setCurrentIndex(0);
    setShowAnswer(false);
    setKnownIds(new Set());
    setUnknownIds(new Set());
    setIsComplete(false);
    setDirection(0);
  }, [cards, unknownIds]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case ' ':
        case 'Enter':
          e.preventDefault();
          setShowAnswer((prev) => !prev);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (showAnswer) markKnown();
          else goNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (showAnswer) markUnknown();
          else goPrev();
          break;
        case '1':
          if (showAnswer) markKnown();
          break;
        case '2':
          if (showAnswer) markUnknown();
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showAnswer, markKnown, markUnknown, goNext, goPrev]);

  if (!quiz) {
    return (
      <>
        <Header />
        <main className="flex-1 container mx-auto px-4 py-12 text-center">
          <h1 className="text-2xl font-bold">Quiz not found</h1>
          <Button asChild className="mt-4">
            <Link href="/">Go back home</Link>
          </Button>
        </main>
        <Footer />
      </>
    );
  }

  if (cards.length === 0) {
    return <FullPageLoader message="Preparing flashcards..." />;
  }

  return (
    <>
      <Header />
      <main className="flex-1 bg-gray-50 dark:bg-background">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          {/* Back */}
          <Button variant="ghost" asChild className="mb-6">
            <Link href={`/quiz/${id}/setup`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Setup
            </Link>
          </Button>

          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{quiz.title} — Flashcards</h1>
            <p className="text-muted-foreground mt-1">
              Tap a card to reveal the answer, then rate your knowledge
            </p>
          </div>

          {/* Progress */}
          <div className="mb-6 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>
                Card {currentIndex + 1} of {totalCards}
              </span>
              <span className="text-muted-foreground">
                <span className="text-green-600 font-medium">{knownIds.size} known</span>
                {' · '}
                <span className="text-red-600 font-medium">{unknownIds.size} learning</span>
              </span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>

          {/* Flashcard */}
          {!isComplete ? (
            <>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={currentCard.id}
                  initial={{ opacity: 0, x: direction * 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -50 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card
                    className="min-h-[320px] cursor-pointer transition-shadow hover:shadow-lg"
                    onClick={() => setShowAnswer((prev) => !prev)}
                  >
                    <CardContent className="p-8 flex flex-col justify-center min-h-[320px]">
                      {/* Badges */}
                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        <Badge variant="outline" className="text-xs">
                          {currentCard.subject}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {currentCard.topic}
                        </Badge>
                        <Badge className={getDifficultyColor(currentCard.difficulty)}>
                          {currentCard.difficulty}
                        </Badge>
                      </div>

                      {/* Question */}
                      <p className="text-lg font-medium leading-relaxed mb-6">
                        {currentCard.question}
                      </p>

                      {/* Answer */}
                      <AnimatePresence>
                        {showAnswer && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="border-t pt-4 space-y-3">
                              <div className="space-y-2">
                                <p className="text-sm font-semibold text-green-600">
                                  Correct Answer{currentCard.correctAnswers.length > 1 ? 's' : ''}:
                                </p>
                                {currentCard.options
                                  .filter((opt) =>
                                    currentCard.correctAnswers.includes(opt.id)
                                  )
                                  .map((opt) => (
                                    <div
                                      key={opt.id}
                                      className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-900/20"
                                    >
                                      <span className="text-sm">{opt.text}</span>
                                    </div>
                                  ))}
                              </div>
                              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-900 dark:bg-indigo-900/20">
                                <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 mb-1">
                                  Explanation
                                </p>
                                <p className="text-sm text-indigo-800 dark:text-indigo-200">
                                  {currentCard.explanation}
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Show/Hide hint */}
                      {!showAnswer && (
                        <div className="text-center text-sm text-muted-foreground mt-4">
                          <Eye className="inline h-4 w-4 mr-1" />
                          Click or press Space to reveal answer
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </AnimatePresence>

              {/* Action buttons */}
              <div className="flex items-center justify-between mt-6">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={goPrev}
                  disabled={currentIndex === 0}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous
                </Button>

                {showAnswer ? (
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={markUnknown}
                      className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-900/20"
                    >
                      <ThumbsDown className="mr-2 h-4 w-4" />
                      Still Learning
                    </Button>
                    <Button
                      size="lg"
                      onClick={markKnown}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <ThumbsUp className="mr-2 h-4 w-4" />
                      Got It
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => setShowAnswer(true)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Show Answer
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="lg"
                  onClick={goNext}
                  disabled={currentIndex >= totalCards - 1}
                >
                  Skip
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            /* Completion Screen */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card>
                <CardContent className="p-8 text-center space-y-6">
                  <div className="text-6xl">🎉</div>
                  <h2 className="text-2xl font-bold">Session Complete!</h2>
                  <p className="text-muted-foreground">
                    You reviewed all {totalCards} flashcards
                  </p>

                  <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
                    <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-4">
                      <p className="text-3xl font-bold text-green-600">
                        {knownIds.size}
                      </p>
                      <p className="text-sm text-muted-foreground">Known</p>
                    </div>
                    <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4">
                      <p className="text-3xl font-bold text-red-600">
                        {unknownIds.size}
                      </p>
                      <p className="text-sm text-muted-foreground">Learning</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 justify-center pt-4">
                    {unknownIds.size > 0 && (
                      <Button
                        size="lg"
                        onClick={handleStudyUnknown}
                        className="bg-indigo-600 hover:bg-indigo-700"
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Study Unknown ({unknownIds.size})
                      </Button>
                    )}
                    <Button variant="outline" size="lg" onClick={handleReset}>
                      <Shuffle className="mr-2 h-4 w-4" />
                      Restart All
                    </Button>
                    <Button variant="outline" size="lg" asChild>
                      <Link href={`/quiz/${id}/setup`}>Back to Setup</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Keyboard shortcuts hint */}
          <div className="mt-8 text-center text-xs text-muted-foreground">
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">Space</kbd> flip ·{' '}
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">←</kbd> still learning ·{' '}
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">→</kbd> got it
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
