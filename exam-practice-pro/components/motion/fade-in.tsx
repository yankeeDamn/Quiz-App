'use client';

import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';

type Direction = 'up' | 'down' | 'left' | 'right' | 'none';

export interface FadeInProps
  extends Omit<
    HTMLMotionProps<'div'>,
    'initial' | 'animate' | 'whileInView' | 'viewport' | 'transition' | 'variants'
  > {
  /** Seconds to wait before starting. */
  delay?: number;
  /** Seconds. Keep within 0.18–0.4 for UI, longer only for hero reveals. */
  duration?: number;
  direction?: Direction;
  /** Travel distance in px. Kept small so the effect stays restrained. */
  distance?: number;
  /** Reveal when scrolled into view instead of on mount. */
  inView?: boolean;
}

const offsets: Record<Direction, (d: number) => { x: number; y: number }> = {
  up: (d) => ({ x: 0, y: d }),
  down: (d) => ({ x: 0, y: -d }),
  left: (d) => ({ x: d, y: 0 }),
  right: (d) => ({ x: -d, y: 0 }),
  none: () => ({ x: 0, y: 0 }),
};

/**
 * Opacity + transform reveal. Honors prefers-reduced-motion by rendering the
 * content immediately in its final state (no hidden initial frame at all).
 */
export function FadeIn({
  delay = 0,
  duration = 0.35,
  direction = 'up',
  distance = 16,
  inView = false,
  children,
  ...rest
}: FadeInProps) {
  const reduce = useReducedMotion();
  const { x, y } = offsets[direction](distance);
  const hidden = { opacity: 0, x, y };
  const shown = { opacity: 1, x: 0, y: 0 };
  const transition = { duration, delay, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <motion.div
      data-reveal
      initial={reduce ? false : hidden}
      {...(inView
        ? { whileInView: shown, viewport: { once: true, margin: '0px 0px -10% 0px' } }
        : { animate: shown })}
      transition={transition}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
