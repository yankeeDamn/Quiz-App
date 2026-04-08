'use client';

import { Clock } from 'lucide-react';
import { formatTime } from '@/lib/quiz-utils';
import { cn } from '@/lib/utils';

interface TimerProps {
  timeLeft: number;
  isWarning: boolean;
  isDanger: boolean;
  visible?: boolean;
}

export function Timer({
  timeLeft,
  isWarning,
  isDanger,
  visible = true,
}: TimerProps) {
  if (!visible) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-sm font-medium transition-colors',
        isDanger
          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse'
          : isWarning
          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
      )}
      role="timer"
      aria-live={isDanger ? 'assertive' : 'polite'}
      aria-atomic="true"
      aria-label={`Time remaining: ${formatTime(timeLeft)}${isDanger ? ', time is almost up!' : isWarning ? ', less than 5 minutes' : ''}`}
    >
      <Clock className="h-4 w-4" aria-hidden="true" />
      <span className="min-w-[60px]">{formatTime(timeLeft)}</span>
    </div>
  );
}
