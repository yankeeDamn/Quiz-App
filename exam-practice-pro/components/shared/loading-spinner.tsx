import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <Loader2 className={cn('animate-spin text-indigo-600', sizeClasses[size])} />
    </div>
  );
}

export function FullPageLoader() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center">
      <LoadingSpinner size="lg" />
      <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
    </div>
  );
}
