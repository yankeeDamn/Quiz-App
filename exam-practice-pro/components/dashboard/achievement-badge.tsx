'use client';

import { Achievement } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AchievementBadgeProps {
  achievement: Achievement;
  size?: 'sm' | 'md' | 'lg';
  showProgress?: boolean;
  className?: string;
}

export function AchievementBadge({
  achievement,
  size = 'md',
  showProgress = false,
  className,
}: AchievementBadgeProps) {
  const isUnlocked = !!achievement.unlockedAt;
  const progress = achievement.progress || 0;
  const target = achievement.target || 1;
  const progressPercent = Math.min((progress / target) * 100, 100);

  const sizeClasses = {
    sm: 'h-10 w-10 text-lg',
    md: 'h-14 w-14 text-2xl',
    lg: 'h-20 w-20 text-4xl',
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'relative flex flex-col items-center gap-1',
            className
          )}
        >
          <div
            className={cn(
              'flex items-center justify-center rounded-full transition-all',
              sizeClasses[size],
              isUnlocked
                ? 'bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg'
                : 'bg-gray-200 dark:bg-gray-700 grayscale opacity-50'
            )}
          >
            <span role="img" aria-label={achievement.name}>
              {achievement.icon}
            </span>
          </div>
          
          {showProgress && !isUnlocked && achievement.target && (
            <div className="w-full mt-1">
              <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center mt-0.5">
                {progress}/{target}
              </p>
            </div>
          )}
          
          {size !== 'sm' && (
            <p
              className={cn(
                'text-xs font-medium text-center',
                isUnlocked ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {achievement.name}
            </p>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-center">
          <p className="font-semibold">{achievement.name}</p>
          <p className="text-xs text-muted-foreground">{achievement.description}</p>
          {isUnlocked && (
            <p className="text-xs text-green-500 mt-1">
              Unlocked {new Date(achievement.unlockedAt!).toLocaleDateString()}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface AchievementGridProps {
  achievements: Achievement[];
  showProgress?: boolean;
  className?: string;
}

export function AchievementGrid({
  achievements,
  showProgress = true,
  className,
}: AchievementGridProps) {
  const unlocked = achievements.filter((a) => a.unlockedAt);
  const locked = achievements.filter((a) => !a.unlockedAt);

  return (
    <div className={cn('space-y-4', className)}>
      {unlocked.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 text-muted-foreground">
            Unlocked ({unlocked.length})
          </h4>
          <div className="flex flex-wrap gap-4">
            {unlocked.map((achievement) => (
              <AchievementBadge
                key={achievement.id}
                achievement={achievement}
                size="md"
              />
            ))}
          </div>
        </div>
      )}
      
      {locked.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2 text-muted-foreground">
            Locked ({locked.length})
          </h4>
          <div className="flex flex-wrap gap-4">
            {locked.map((achievement) => (
              <AchievementBadge
                key={achievement.id}
                achievement={achievement}
                size="md"
                showProgress={showProgress}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
