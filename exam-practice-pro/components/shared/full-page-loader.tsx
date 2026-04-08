'use client';

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
        <div
          className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"
          aria-hidden="true"
        />
        <p className="mt-4 text-muted-foreground">{message}</p>
        <span className="sr-only">{message}</span>
      </div>
    </div>
  );
}
