'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExamProvider } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ProviderCardProps {
  provider: ExamProvider;
  examCount?: number;
  onClick?: () => void;
  index?: number;
  className?: string;
}

export function ProviderCard({ 
  provider, 
  examCount, 
  onClick, 
  index = 0,
  className 
}: ProviderCardProps) {
  const reduceMotion = useReducedMotion();
  const displayCount = examCount ?? provider.examCount;

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduceMotion ? 0 : Math.min(index * 0.065, 0.3), duration: reduceMotion ? 0 : 0.35 }}
    >
      <Card
        onClick={onClick}
        className={cn(
          'group cursor-pointer rounded-2xl border-indigo-100/80 bg-card transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/10 motion-reduce:hover:translate-y-0 dark:border-slate-800 dark:hover:border-indigo-700',
          className
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-lg text-white font-bold text-lg"
              style={{ backgroundColor: provider.color }}
            >
              {provider.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate group-hover:text-indigo-600 transition-colors">
                {provider.name}
              </h3>
              <p className="text-sm text-muted-foreground truncate">
                {provider.description}
              </p>
            </div>
            {displayCount > 0 && (
              <Badge variant="secondary" className="shrink-0">
                {displayCount} {displayCount === 1 ? 'exam' : 'exams'}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
