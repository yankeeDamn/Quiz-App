'use client';

import { Skeleton } from '@/components/ui/content-primitives';
import { cn } from '@/lib/utils';

interface FullPageLoaderProps {
  message?: string;
  className?: string;
}

export function FullPageLoader({
  message = 'Loading...',
  className,
}: FullPageLoaderProps) {
  return (
    <div
      className={cn(
        'flex min-h-screen items-center justify-center',
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="text-center">
        <div className="mx-auto w-64 space-y-3"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-4/5" /></div>
        <p className="mt-4 text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
