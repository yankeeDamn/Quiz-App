'use client';

import { QuizResult } from '@/lib/types';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ScoreDisplayProps {
  result: QuizResult;
}

export function ScoreDisplay({ result }: ScoreDisplayProps) {
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset =
    circumference - (result.percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      {/* Circular Progress */}
      <div className="relative h-40 w-40">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-gray-200 dark:text-gray-700"
          />
          {/* Progress circle */}
          <motion.circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            className={cn(
              result.passed ? 'text-green-500' : 'text-red-500'
            )}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1, ease: 'easeOut' }}
            style={{
              strokeDasharray: circumference,
            }}
          />
        </svg>
        {/* Percentage Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-4xl font-bold"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            {Math.round(result.percentage)}%
          </motion.span>
          <span className="text-sm text-muted-foreground">Score</span>
        </div>
      </div>

      {/* Pass/Fail Badge */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className={cn(
          'mt-4 rounded-full px-4 py-1.5 text-sm font-semibold',
          result.passed
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        )}
      >
        {result.passed ? '✓ PASSED' : '✗ FAILED'}
      </motion.div>
      <p className="mt-2 text-xs text-muted-foreground">
        Passing score: {result.passingScore}%
      </p>
    </div>
  );
}
