'use client';

import { Progress } from '@/components/ui/progress';

interface ProgressBarProps {
  current: number;
  total: number;
  answered: number;
}

export function ProgressBar({ current, total, answered }: ProgressBarProps) {
  const progressPercent = (answered / total) * 100;

  return (
    <div className="flex items-center gap-3">
      <Progress value={progressPercent} className="h-2 w-24" />
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        {answered}/{total} answered
      </span>
    </div>
  );
}
