'use client';

import { MotionConfig } from 'framer-motion';

/**
 * Makes every framer-motion component beneath it honor the visitor's
 * prefers-reduced-motion setting (transform/layout animations are skipped,
 * opacity still fades). It renders no DOM and holds no state, so it cannot
 * remount its children. Only wrap page content with it, never auth/session
 * providers.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
