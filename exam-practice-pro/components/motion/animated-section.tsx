'use client';

import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';

export type AnimatedSectionProps = Omit<
  HTMLMotionProps<'section'>,
  'initial' | 'animate' | 'whileInView' | 'viewport' | 'transition' | 'variants'
> & {
  delay?: number;
  duration?: number;
};

/**
 * <section> that fades/slides in once when scrolled into view.
 *
 * Do not wrap stateful forms or the exam timer in this. It is meant for static
 * marketing/catalogue blocks. The element is never unmounted by the animation,
 * but keeping interactive state out of it removes any doubt.
 */
export function AnimatedSection({
  delay = 0,
  duration = 0.4,
  children,
  ...rest
}: AnimatedSectionProps) {
  const reduce = useReducedMotion();

  return (
    <motion.section
      data-reveal
      initial={reduce ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
      {...rest}
    >
      {children}
    </motion.section>
  );
}
