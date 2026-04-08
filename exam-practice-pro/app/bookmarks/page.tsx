'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  BookmarkCheck,
  Bookmark,
  Trash2,
  Search,
  GraduationCap,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { loadBookmarks, removeBookmark } from '@/lib/storage';
import { getAnyQuizById } from '@/data/quizzes';
import { Bookmark as BookmarkType, Question } from '@/lib/types';
import { getDifficultyColor } from '@/lib/quiz-utils';

interface BookmarkWithQuestion extends BookmarkType {
  question?: Question;
  quizTitle?: string;
}

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<BookmarkWithQuestion[]>([]);
  const [search, setSearch] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    refreshBookmarks();
  }, []);

  const refreshBookmarks = () => {
    const saved = loadBookmarks();
    const enriched: BookmarkWithQuestion[] = saved.map((bm) => {
      const quiz = getAnyQuizById(bm.quizId);
      const question = quiz?.questions.find((q) => q.id === bm.questionId);
      return {
        ...bm,
        question,
        quizTitle: quiz?.title,
      };
    });
    setBookmarks(enriched);
  };

  const handleRemoveBookmark = (questionId: string, quizId: string) => {
    removeBookmark(questionId, quizId);
    refreshBookmarks();
  };

  const filtered = useMemo(() => {
    if (!search) return bookmarks;
    const lower = search.toLowerCase();
    return bookmarks.filter(
      (bm) =>
        bm.question?.question.toLowerCase().includes(lower) ||
        bm.quizTitle?.toLowerCase().includes(lower) ||
        bm.question?.topic.toLowerCase().includes(lower) ||
        bm.question?.subject.toLowerCase().includes(lower)
    );
  }, [bookmarks, search]);

  if (!mounted) return null;

  return (
    <>
      <Header />
      <main className="flex-1 bg-gray-50 dark:bg-background">
        <div className="container mx-auto px-4 py-8">
          {/* Back */}
          <Button variant="ghost" asChild className="mb-6">
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>

          {/* Header */}
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BookmarkCheck className="h-6 w-6 text-yellow-500" />
                Bookmarked Questions
              </h1>
              <p className="text-muted-foreground mt-1">
                {bookmarks.length} {bookmarks.length === 1 ? 'question' : 'questions'} saved for review
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-6 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search bookmarks..."
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Bookmarks List */}
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Bookmark className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-1">
                  {bookmarks.length === 0
                    ? 'No bookmarks yet'
                    : 'No matches found'}
                </h3>
                <p className="text-sm text-muted-foreground text-center max-w-sm">
                  {bookmarks.length === 0
                    ? 'Bookmark questions during quizzes or review to save them here for later study.'
                    : 'Try adjusting your search query.'}
                </p>
                {bookmarks.length === 0 && (
                  <Button asChild className="mt-4" variant="outline">
                    <Link href="/">Browse Quizzes</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {filtered.map((bm) => (
                  <motion.div
                    key={`${bm.quizId}-${bm.questionId}`}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className="group hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <BookmarkCheck className="h-5 w-5 mt-0.5 shrink-0 text-yellow-500" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium leading-snug mb-2">
                              {bm.question?.question || 'Question not found'}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              {bm.quizTitle && (
                                <Badge variant="outline" className="text-xs">
                                  <GraduationCap className="mr-1 h-3 w-3" />
                                  {bm.quizTitle}
                                </Badge>
                              )}
                              {bm.question?.subject && (
                                <Badge variant="outline" className="text-xs">
                                  {bm.question.subject}
                                </Badge>
                              )}
                              {bm.question?.topic && (
                                <Badge variant="secondary" className="text-xs">
                                  {bm.question.topic}
                                </Badge>
                              )}
                              {bm.question?.difficulty && (
                                <Badge
                                  className={getDifficultyColor(
                                    bm.question.difficulty
                                  )}
                                >
                                  {bm.question.difficulty}
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                Saved{' '}
                                {new Date(bm.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              handleRemoveBookmark(bm.questionId, bm.quizId)
                            }
                            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            aria-label="Remove bookmark"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
