'use client';

import { DifficultyPerformance } from '@/lib/types';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { getDifficultyColor } from '@/lib/quiz-utils';

interface DifficultyBreakdownProps {
  data: DifficultyPerformance[];
}

export function DifficultyBreakdown({ data }: DifficultyBreakdownProps) {
  if (data.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Performance by Difficulty</h3>
      <div className="space-y-4">
        {data.map((item) => (
          <div key={item.difficulty} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className={getDifficultyColor(item.difficulty)}>
                  {item.difficulty}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {item.correct}/{item.total} correct
                </span>
              </div>
              <span className="font-mono text-sm font-medium">
                {Math.round(item.percentage)}%
              </span>
            </div>
            <Progress
              value={item.percentage}
              className="h-2"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
