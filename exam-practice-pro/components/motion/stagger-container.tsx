'use client';

import { motion, useReducedMotion, type HTMLMotionProps, type Variants } from 'framer-motion';

export interface StaggerContainerProps
  extends Omit<
    HTMLMotionProps<'div'>,
    'initial' | 'animate' | 'whileInView' | 'viewport' | 'variants' | 'transition'
  > {
  /** Seconds between each child. */
  stagger?: number;
  /** Seconds before the first child starts. */
  delay?: number;
  /** Reveal when scrolled into view instead of on mount. */
  inView?: boolean;
}

/**
 * Parent for a group of <StaggerItem>s. Children reveal one after another.
 * Under reduced motion everything renders immediately in its final state.
 */
export function StaggerContainer({
  stagger = 0.07,
  delay = 0,
  inView = true,
  children,
  ...rest
}: StaggerContainerProps) {
  const reduce = useReducedMotion();

  const variants: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: stagger, delayChildren: delay } },
  };

  return (
    <motion.div
      data-reveal-group
      variants={variants}
      initial={reduce ? false : 'hidden'}
      {...(inView
        ? { whileInView: 'show', viewport: { once: true, margin: '0px 0px -10% 0px' } }
        : { animate: 'show' })}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export type StaggerItemProps = Omit<
  HTMLMotionProps<'div'>,
  'initial' | 'animate' | 'whileInView' | 'viewport' | 'variants' | 'transition'
> & {
  distance?: number;
  duration?: number;
};

const ease = [0.22, 1, 0.36, 1] as const;

/** Child of <StaggerContainer>. Animates opacity + translateY only. */
export function StaggerItem({
  distance = 14,
  duration = 0.3,
  children,
  ...rest
}: StaggerItemProps) {
  const variants: Variants = {
    hidden: { opacity: 0, y: distance },
    show: { opacity: 1, y: 0, transition: { duration, ease } },
  };

  return (
    <motion.div data-reveal variants={variants} {...rest}>
      {children}
    </motion.div>
  );
}
