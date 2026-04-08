'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Trophy,
  Target,
  Flame,
  TrendingUp,
  TrendingDown,
  BookOpen,
  ArrowRight,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatsCard } from '@/components/dashboard/stats-card';
import { PerformanceChart } from '@/components/dashboard/performance-chart';
import { RecentQuizzes } from '@/components/dashboard/recent-quizzes';
import { AchievementGrid } from '@/components/dashboard/achievement-badge';
import { loadDashboardStats, loadQuizHistory, loadAchievements } from '@/lib/storage';
import { DashboardStats, QuizResult, Achievement } from '@/lib/types';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [history, setHistory] = useState<QuizResult[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadedStats = loadDashboardStats();
    const loadedHistory = loadQuizHistory();
    const loadedAchievements = loadAchievements();
    setStats(loadedStats);
    setHistory(loadedHistory);
    setAchievements(loadedAchievements);
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <>
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
        </main>
        <Footer />
      </>
    );
  }

  const hasActivity = stats && (stats.totalAttempts > 0 || history.length > 0);

  return (
    <>
      <Header />
      <main className="flex-1 bg-gray-50 dark:bg-background">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Track your progress and performance
            </p>
          </div>

          {!hasActivity ? (
            /* Empty State */
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-16"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/50">
                <BookOpen className="h-10 w-10 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="mt-6 text-xl font-semibold">No activity yet</h2>
              <p className="mt-2 text-center text-muted-foreground max-w-md">
                Start practicing quizzes to see your statistics, track your
                progress, and identify areas for improvement.
              </p>
              <Button
                asChild
                size="lg"
                className="mt-6 bg-indigo-600 hover:bg-indigo-700"
              >
                <Link href="/">
                  Start Your First Quiz
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </motion.div>
          ) : (
            <>
              {/* Stats Grid */}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0 }}
                >
                  <StatsCard
                    title="Total Attempts"
                    value={stats?.totalAttempts || 0}
                    description="Quizzes completed"
                    icon={Target}
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <StatsCard
                    title="Average Score"
                    value={`${Math.round(stats?.averageScore || 0)}%`}
                    description="Across all quizzes"
                    icon={Trophy}
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <StatsCard
                    title="Current Streak"
                    value={`${stats?.streak || 0} days`}
                    description="Keep it going!"
                    icon={Flame}
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <StatsCard
                    title="Last Activity"
                    value={
                      stats?.lastAttemptDate
                        ? new Date(stats.lastAttemptDate).toLocaleDateString(
                            'en-US',
                            { month: 'short', day: 'numeric' }
                          )
                        : 'N/A'
                    }
                    description="Most recent quiz"
                    icon={BookOpen}
                  />
                </motion.div>
              </div>

              {/* Charts and Topics Row */}
              <div className="grid gap-6 lg:grid-cols-3 mb-8">
                {/* Performance Trend */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="lg:col-span-2"
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Performance Trend</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {history.length > 0 ? (
                        <PerformanceChart data={history} />
                      ) : (
                        <div className="flex h-[250px] items-center justify-center text-muted-foreground">
                          Complete more quizzes to see your trend
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Strengths & Weaknesses */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                >
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle className="text-lg">Topic Analysis</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {stats?.strongestTopic ? (
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                            <TrendingUp className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">
                              Strongest Topic
                            </p>
                            <p className="font-semibold text-green-600">
                              {stats.strongestTopic}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                            <TrendingUp className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">
                              Strongest Topic
                            </p>
                            <p className="text-muted-foreground">
                              Complete more quizzes
                            </p>
                          </div>
                        </div>
                      )}

                      {stats?.weakestTopic && stats.weakestTopic !== stats.strongestTopic ? (
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
                            <TrendingDown className="h-5 w-5 text-red-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">
                              Needs Improvement
                            </p>
                            <p className="font-semibold text-red-600">
                              {stats.weakestTopic}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                            <TrendingDown className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">
                              Needs Improvement
                            </p>
                            <p className="text-muted-foreground">
                              Keep practicing
                            </p>
                          </div>
                        </div>
                      )}

                      <Button
                        asChild
                        variant="outline"
                        className="w-full mt-4"
                      >
                        <Link href="/">
                          Practice More
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* Recent Quizzes */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">Recent Quizzes</CardTitle>
                    {history.length > 5 && (
                      <Button variant="ghost" size="sm">
                        View All
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <RecentQuizzes quizzes={history.slice(0, 5)} />
                  </CardContent>
                </Card>
              </motion.div>

              {/* Achievements */}
              {achievements.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                >
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-yellow-500" />
                        Achievements
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <AchievementGrid achievements={achievements} />
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
