'use client';

import { useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Clock,
  RotateCcw,
  FileSearch,
  Home,
  Trophy,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ScoreDisplay } from '@/components/results/score-display';
import { TopicBreakdown } from '@/components/results/topic-breakdown';
import { DifficultyBreakdown } from '@/components/results/difficulty-breakdown';
import { FullPageLoader } from '@/components/shared/full-page-loader';
import { useQuizStore } from '@/store/quiz-store';
import { formatTime } from '@/lib/quiz-utils';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function QuizResultPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { lastResult, currentQuiz, session, resetQuiz } = useQuizStore();

  // Redirect if no result
  useEffect(() => {
    if (!lastResult) {
      router.push(`/quiz/${id}/setup`);
    }
  }, [lastResult, id, router]);

  if (!lastResult) {
    return <FullPageLoader message="Loading results..." />;
  }

  const handleRetake = () => {
    resetQuiz();
    router.push(`/quiz/${id}/setup`);
  };

  return (
    <>
      <Header />
      <main className="flex-1 bg-gray-50 dark:bg-background">
        <div className="container mx-auto px-4 py-8">
          {/* Back Button */}
          <Button variant="ghost" asChild className="mb-6">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Quizzes
            </Link>
          </Button>

          <div className="grid gap-8 lg:grid-cols-3">
            {/* Score Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-1"
            >
              <Card className="sticky top-24">
                <CardHeader className="text-center">
                  <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/50">
                    <Trophy className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <CardTitle>{lastResult.quizTitle}</CardTitle>
                  <p className="text-sm text-muted-foreground">Quiz Complete!</p>
                </CardHeader>
                <CardContent>
                  <ScoreDisplay result={lastResult} />

                  <Separator className="my-6" />

                  {/* Summary Stats */}
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="flex items-center justify-center gap-1 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-xl font-bold">
                          {lastResult.correct}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">Correct</p>
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-1 text-red-600">
                        <XCircle className="h-4 w-4" />
                        <span className="text-xl font-bold">
                          {lastResult.incorrect}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">Incorrect</p>
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-1 text-yellow-600">
                        <MinusCircle className="h-4 w-4" />
                        <span className="text-xl font-bold">
                          {lastResult.skipped}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">Skipped</p>
                    </div>
                  </div>

                  <Separator className="my-6" />

                  {/* Time Taken */}
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Time: {formatTime(lastResult.timeTaken)}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Performance Details */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-2 space-y-6"
            >
              {/* Topic Performance */}
              <Card>
                <CardContent className="pt-6">
                  <TopicBreakdown data={lastResult.topicPerformance} />
                </CardContent>
              </Card>

              {/* Difficulty Performance */}
              <Card>
                <CardContent className="pt-6">
                  <DifficultyBreakdown data={lastResult.difficultyPerformance} />
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="grid gap-4 sm:grid-cols-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-auto py-4"
                  asChild
                >
                  <Link href={`/quiz/${id}/review`}>
                    <div className="flex flex-col items-center gap-2">
                      <FileSearch className="h-5 w-5" />
                      <span>Review Answers</span>
                    </div>
                  </Link>
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  className="h-auto py-4"
                  onClick={handleRetake}
                >
                  <div className="flex flex-col items-center gap-2">
                    <RotateCcw className="h-5 w-5" />
                    <span>Retake Quiz</span>
                  </div>
                </Button>

                <Button
                  size="lg"
                  className="h-auto py-4 bg-indigo-600 hover:bg-indigo-700"
                  asChild
                >
                  <Link href="/">
                    <div className="flex flex-col items-center gap-2">
                      <Home className="h-5 w-5" />
                      <span>Back to Home</span>
                    </div>
                  </Link>
                </Button>
              </div>

              {/* Quick Stats for Desktop */}
              <Card className="hidden lg:block">
                <CardHeader>
                  <CardTitle className="text-lg">Quick Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-indigo-600">
                        {lastResult.totalQuestions}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Total Questions
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-green-600">
                        {Math.round(
                          (lastResult.correct / lastResult.totalQuestions) * 100
                        )}
                        %
                      </p>
                      <p className="text-sm text-muted-foreground">Accuracy</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-blue-600">
                        {formatTime(lastResult.timeTaken)}
                      </p>
                      <p className="text-sm text-muted-foreground">Time Spent</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-purple-600">
                        {lastResult.topicPerformance.length}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Topics Covered
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
