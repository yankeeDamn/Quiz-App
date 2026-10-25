import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Hover/focus lift implemented purely with CSS transitions (transform only).
 * No JS, no client boundary, so it can be used from server components.
 * The lift is disabled automatically under prefers-reduced-motion.
 */
export const motionCardClasses =
  'transition-[transform,box-shadow,border-color] duration-200 ease-out ' +
  'hover:-translate-y-1 hover:shadow-lg focus-within:-translate-y-1 focus-within:shadow-lg ' +
  'motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:focus-within:translate-y-0';

export function MotionCard({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn(motionCardClasses, className)} {...props} />;
}
