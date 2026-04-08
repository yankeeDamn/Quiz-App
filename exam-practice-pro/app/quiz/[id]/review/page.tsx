'use client';

import { useState, useMemo, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Flag,
  Filter,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FullPageLoader } from '@/components/shared/full-page-loader';
import { QuestionActions } from '@/components/quiz/question-actions';
import { useQuizStore } from '@/store/quiz-store';
import { ReviewFilter, Question } from '@/lib/types';
import { isAnswerCorrect, getAnswerLabel, getDifficultyColor, getStatusColor } from '@/lib/quiz-utils';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function QuizReviewPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { lastResult, currentQuiz, session } = useQuizStore();

  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [currentIndex, setCurrentIndex] = useState(0);

  // Redirect if no result
  useEffect(() => {
    if (!lastResult || !currentQuiz || !session) {
      router.push(`/quiz/${id}/result`);
    }
  }, [lastResult, currentQuiz, session, id, router]);

  // Filter questions based on selected filter
  const filteredQuestions = useMemo(() => {
    if (!currentQuiz || !session) return [];

    return session.questionOrder
      .map((qId) => {
        const question = currentQuiz.questions.find((q) => q.id === qId);
        if (!question) return null;

        const userAnswer = session.answers[qId];
        const isCorrect = userAnswer
          ? isAnswerCorrect(question, userAnswer.selectedAnswers)
          : false;
        const isSkipped = !userAnswer || userAnswer.selectedAnswers.length === 0;
        const isMarked = session.markedForReview.includes(qId);

        return {
          question,
          userAnswer,
          isCorrect,
          isSkipped,
          isMarked,
        };
      })
      .filter((item): item is NonNullable<typeof item> => {
        if (!item) return false;

        switch (filter) {
          case 'correct':
            return item.isCorrect;
          case 'incorrect':
            return !item.isCorrect && !item.isSkipped;
          case 'skipped':
            return item.isSkipped;
          case 'marked':
            return item.isMarked;
          default:
            return true;
        }
      });
  }, [currentQuiz, session, filter]);

  // Reset index when filter changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [filter]);

  if (!lastResult || !currentQuiz || !session) {
    return <FullPageLoader message="Loading review..." />;
  }

  const currentItem = filteredQuestions[currentIndex];

  const getStatusIcon = (isCorrect: boolean, isSkipped: boolean) => {
    if (isSkipped)
      return <MinusCircle className="h-5 w-5 text-yellow-500" aria-hidden="true" />;
    if (isCorrect)
      return <CheckCircle2 className="h-5 w-5 text-green-500" aria-hidden="true" />;
    return <XCircle className="h-5 w-5 text-red-500" aria-hidden="true" />;
  };

  const getStatusBadge = (isCorrect: boolean, isSkipped: boolean) => {
    const status = isSkipped ? 'skipped' : isCorrect ? 'correct' : 'incorrect';
    const labels = { skipped: 'Skipped', correct: 'Correct', incorrect: 'Incorrect' };
    return (
      <Badge className={getStatusColor(status)}>
        {labels[status]}
      </Badge>
    );
  };

  return (
    <>
      <Header />
      <main className="flex-1 bg-gray-50 dark:bg-background">
        <div className="container mx-auto px-4 py-8">
          {/* Back Button */}
          <Button variant="ghost" asChild className="mb-6">
            <Link href={`/quiz/${id}/result`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Results
            </Link>
          </Button>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold">Review Answers</h1>
            <p className="text-muted-foreground mt-1">
              Review your answers and learn from explanations
            </p>
          </div>

          {/* Filters */}
          <div className="mb-6">
            <Tabs
              value={filter}
              onValueChange={(v) => setFilter(v as ReviewFilter)}
            >
              <TabsList className="grid w-full max-w-lg grid-cols-5">
                <TabsTrigger value="all">
                  All ({session.questionOrder.length})
                </TabsTrigger>
                <TabsTrigger value="correct">
                  <CheckCircle2 className="mr-1 h-3 w-3 text-green-500" />
                  {lastResult.correct}
                </TabsTrigger>
                <TabsTrigger value="incorrect">
                  <XCircle className="mr-1 h-3 w-3 text-red-500" />
                  {lastResult.incorrect}
                </TabsTrigger>
                <TabsTrigger value="skipped">
                  <MinusCircle className="mr-1 h-3 w-3 text-yellow-500" />
                  {lastResult.skipped}
                </TabsTrigger>
                <TabsTrigger value="marked">
                  <Flag className="mr-1 h-3 w-3 text-blue-500" />
                  {session.markedForReview.length}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Question Review */}
          {filteredQuestions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Filter className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No questions match this filter</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try selecting a different filter
                </p>
              </CardContent>
            </Card>
          ) : currentItem ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentItem.question.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <Card>
                  <CardContent className="pt-6">
                    {/* Question Header */}
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(
                          currentItem.isCorrect,
                          currentItem.isSkipped
                        )}
                        <span className="font-semibold">
                          Question {currentIndex + 1} of{' '}
                          {filteredQuestions.length}
                        </span>
                        {getStatusBadge(
                          currentItem.isCorrect,
                          currentItem.isSkipped
                        )}
                        {currentItem.isMarked && (
                          <Badge variant="outline" className="border-blue-300">
                            <Flag className="mr-1 h-3 w-3 text-blue-500" />
                            Marked
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <QuestionActions
                          questionId={currentItem.question.id}
                          quizId={id}
                          compact
                        />
                        <Badge variant="outline">
                          {currentItem.question.subject}
                        </Badge>
                        <Badge variant="outline">
                          {currentItem.question.topic}
                        </Badge>
                        <Badge
                          className={getDifficultyColor(
                            currentItem.question.difficulty
                          )}
                        >
                          {currentItem.question.difficulty}
                        </Badge>
                      </div>
                    </div>

                    {/* Question Text */}
                    <div className="rounded-xl bg-gray-50 p-6 dark:bg-gray-900/50 mb-6">
                      <p className="text-lg">{currentItem.question.question}</p>
                    </div>

                    {/* Answer Options */}
                    <div className="space-y-3 mb-6">
                      {currentItem.question.options.map((option, index) => {
                        const isSelected =
                          currentItem.userAnswer?.selectedAnswers.includes(
                            option.id
                          );
                        const isCorrectAnswer =
                          currentItem.question.correctAnswers.includes(option.id);

                        let optionClass =
                          'border-gray-200 dark:border-gray-700';
                        if (isCorrectAnswer) {
                          optionClass =
                            'border-green-500 bg-green-50 dark:bg-green-900/20';
                        } else if (isSelected && !isCorrectAnswer) {
                          optionClass =
                            'border-red-500 bg-red-50 dark:bg-red-900/20';
                        }

                        return (
                          <div
                            key={option.id}
                            className={`flex items-start gap-4 rounded-xl border-2 p-4 ${optionClass}`}
                          >
                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-medium ${
                                isCorrectAnswer
                                  ? 'bg-green-600 text-white'
                                  : isSelected
                                  ? 'bg-red-600 text-white'
                                  : 'bg-gray-100 dark:bg-gray-800'
                              }`}
                            >
                              {getAnswerLabel(index)}
                            </span>
                            <span className="flex-1 pt-1">{option.text}</span>
                            {isCorrectAnswer && (
                              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                            )}
                            {isSelected && !isCorrectAnswer && (
                              <XCircle className="h-5 w-5 shrink-0 text-red-600" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Explanation */}
                    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-900/20">
                      <h4 className="font-semibold text-indigo-900 dark:text-indigo-300 mb-2">
                        Explanation
                      </h4>
                      <p className="text-sm text-indigo-800 dark:text-indigo-200">
                        {currentItem.question.explanation}
                      </p>
                    </div>

                    {/* Navigation */}
                    <div className="flex items-center justify-between mt-8">
                      <Button
                        variant="outline"
                        onClick={() =>
                          setCurrentIndex((i) => Math.max(0, i - 1))
                        }
                        disabled={currentIndex === 0}
                      >
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Previous
                      </Button>

                      <span className="text-sm text-muted-foreground">
                        {currentIndex + 1} / {filteredQuestions.length}
                      </span>

                      <Button
                        onClick={() =>
                          setCurrentIndex((i) =>
                            Math.min(filteredQuestions.length - 1, i + 1)
                          )
                        }
                        disabled={currentIndex === filteredQuestions.length - 1}
                        className="bg-indigo-600 hover:bg-indigo-700"
                      >
                        Next
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </AnimatePresence>
          ) : null}

          {/* Question Navigator */}
          {filteredQuestions.length > 0 && (
            <Card className="mt-6">
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-4">Jump to Question</h3>
                <div className="flex flex-wrap gap-2">
                  {filteredQuestions.map((item, index) => (
                    <Button
                      key={item.question.id}
                      variant={index === currentIndex ? 'default' : 'outline'}
                      size="sm"
                      className={`w-10 h-10 p-0 ${
                        index === currentIndex
                          ? 'bg-indigo-600 hover:bg-indigo-700'
                          : item.isSkipped
                          ? 'border-yellow-300'
                          : item.isCorrect
                          ? 'border-green-300'
                          : 'border-red-300'
                      }`}
                      onClick={() => setCurrentIndex(index)}
                    >
                      {index + 1}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
