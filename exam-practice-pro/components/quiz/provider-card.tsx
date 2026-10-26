'use client';

import { motion } from 'framer-motion';
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
  const displayCount = examCount ?? provider.examCount;

  return (
    <motion.div
      data-reveal
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ delay: Math.min(index, 4) * 0.07, duration: 0.3 }}
    >
      <Card
        onClick={onClick}
        // Make the card operable by keyboard and assistive tech when it acts as a filter button.
        {...(onClick
          ? {
              role: 'button' as const,
              tabIndex: 0,
              'aria-label': `Show ${provider.name} exams`,
              onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
                if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onClick();
                }
              },
            }
          : {})}
        className={cn(
          'group cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600',
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
