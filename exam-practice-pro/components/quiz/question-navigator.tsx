'use client';

import { cn } from '@/lib/utils';
import { QuestionStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Flag, Check, Circle } from 'lucide-react';

interface QuestionNavigatorProps {
  questions: string[];
  currentIndex: number;
  getStatus: (questionId: string) => QuestionStatus;
  onNavigate: (index: number) => void;
  className?: string;
}

export function QuestionNavigator({
  questions,
  currentIndex,
  getStatus,
  onNavigate,
  className,
}: QuestionNavigatorProps) {
  const getStatusStyles = (status: QuestionStatus, index: number) => {
    const isCurrent = index === currentIndex;

    if (isCurrent) {
      return 'bg-indigo-600 text-white hover:bg-indigo-700 ring-2 ring-indigo-600 ring-offset-2';
    }

    switch (status) {
      case 'answered':
        return 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400';
      case 'marked':
        return 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'unanswered':
      default:
        return 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: QuestionStatus, index: number) => {
    if (index === currentIndex) return null;

    switch (status) {
      case 'answered':
        return <Check className="h-3 w-3 absolute -top-1 -right-1 bg-green-500 text-white rounded-full p-0.5" />;
      case 'marked':
        return <Flag className="h-3 w-3 absolute -top-1 -right-1 bg-yellow-500 text-white rounded-full p-0.5" />;
      default:
        return null;
    }
  };

  // Count statistics
  const stats = questions.reduce(
    (acc, qId) => {
      const status = getStatus(qId);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    {} as Record<QuestionStatus, number>
  );

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-indigo-600" />
          <span>Current</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-green-500" />
          <span>Answered ({stats.answered || 0})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-yellow-500" />
          <span>Marked ({stats.marked || 0})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded bg-gray-300 dark:bg-gray-600" />
          <span>Unanswered ({stats.unanswered || 0})</span>
        </div>
      </div>

      {/* Question Grid */}
      <ScrollArea className="flex-1">
        <div className="grid grid-cols-5 gap-2">
          {questions.map((questionId, index) => {
            const status = getStatus(questionId);
            return (
              <Button
                key={questionId}
                variant="ghost"
                size="sm"
                className={cn(
                  'relative h-10 w-10 p-0 font-medium transition-all',
                  getStatusStyles(status, index)
                )}
                onClick={() => onNavigate(index)}
                aria-label={`Question ${index + 1}, ${status === 'answered' ? 'answered' : status === 'marked' ? 'marked for review' : 'unanswered'}${index === currentIndex ? ', current' : ''}`}
                aria-current={index === currentIndex ? 'step' : undefined}
              >
                {index + 1}
                {getStatusIcon(status, index)}
              </Button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
