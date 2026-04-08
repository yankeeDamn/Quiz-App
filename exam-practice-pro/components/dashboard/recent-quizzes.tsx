'use client';

import Link from 'next/link';
import { QuizResult } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatTime } from '@/lib/quiz-utils';
import { CheckCircle2, XCircle, RotateCcw, FileSearch } from 'lucide-react';

interface RecentQuizzesProps {
  quizzes: QuizResult[];
}

export function RecentQuizzes({ quizzes }: RecentQuizzesProps) {
  if (quizzes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileSearch className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium">No recent quizzes</p>
        <p className="text-sm text-muted-foreground mt-1">
          Start practicing to see your history here
        </p>
        <Button asChild className="mt-4 bg-indigo-600 hover:bg-indigo-700">
          <Link href="/">Browse Quizzes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left text-sm text-muted-foreground">
            <th className="pb-3 font-medium">Quiz</th>
            <th className="pb-3 font-medium">Date</th>
            <th className="pb-3 font-medium text-center">Score</th>
            <th className="pb-3 font-medium text-center">Status</th>
            <th className="pb-3 font-medium text-center">Time</th>
            <th className="pb-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {quizzes.map((quiz) => (
            <tr key={quiz.id} className="group">
              <td className="py-4">
                <p className="font-medium">{quiz.quizTitle}</p>
                <p className="text-xs text-muted-foreground">
                  {quiz.totalQuestions} questions
                </p>
              </td>
              <td className="py-4 text-sm text-muted-foreground">
                {new Date(quiz.completedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </td>
              <td className="py-4 text-center">
                <span className="font-mono text-lg font-bold">
                  {Math.round(quiz.percentage)}%
                </span>
              </td>
              <td className="py-4 text-center">
                {quiz.passed ? (
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Passed
                  </Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    <XCircle className="mr-1 h-3 w-3" />
                    Failed
                  </Badge>
                )}
              </td>
              <td className="py-4 text-center text-sm text-muted-foreground">
                {formatTime(quiz.timeTaken)}
              </td>
              <td className="py-4 text-right">
                <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/quiz/${quiz.quizId}/setup`}>
                      <RotateCcw className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
