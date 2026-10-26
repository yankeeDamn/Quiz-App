'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchPracticeLibrary, applyHomepageOverrides } from '@/lib/practice-overrides';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Clock,
  FileQuestion,
  PlayCircle,
  BookOpen,
  GraduationCap,
} from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { QuizMeta, Difficulty } from '@/lib/types';
import { formatDuration, getDifficultyColor } from '@/lib/quiz-utils';

interface QuizCardProps {
  quiz: QuizMeta;
}

export function QuizCard({ quiz }: QuizCardProps) {
  const reduceMotion = useReducedMotion();
  const [questionCount, setQuestionCount] = useState(quiz.questionCount);
  useEffect(() => {
    let alive = true;
    fetchPracticeLibrary()
      .then(data => {
        if (alive) setQuestionCount(applyHomepageOverrides(quiz, data.overrides, data.additions).questionCount);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [quiz]);
  const subjectIcons: Record<string, React.ReactNode> = {
    Mathematics: <GraduationCap className="h-5 w-5" />,
    'Computer Science': <BookOpen className="h-5 w-5" />,
    Mixed: <FileQuestion className="h-5 w-5" />,
  };

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={reduceMotion ? undefined : { y: -3 }}
      transition={{ duration: reduceMotion ? 0 : 0.22 }}
    >
      <Card className="group relative h-full overflow-hidden rounded-2xl border border-indigo-100 bg-card shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-indigo-300 hover:shadow-xl hover:shadow-indigo-500/10 dark:border-slate-800 dark:hover:border-indigo-700">
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 transition-opacity group-hover:opacity-100" />

        <CardHeader className="relative pb-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400">
                {subjectIcons[quiz.subject] || <FileQuestion className="h-5 w-5" />}
              </div>
              <div>
                <h3 className="font-semibold text-lg leading-tight">{quiz.title}</h3>
                <p className="text-sm text-muted-foreground">{quiz.subject}</p>
              </div>
            </div>
            <Badge className={getDifficultyColor(quiz.difficulty)}>
              {quiz.difficulty}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="relative pb-3">
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
            {quiz.description}
          </p>

          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <FileQuestion className="h-4 w-4" />
              <span>{questionCount} questions</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{formatDuration(quiz.duration)}</span>
            </div>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {quiz.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {quiz.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{quiz.tags.length - 3}
              </Badge>
            )}
          </div>
        </CardContent>

        <CardFooter className="relative gap-2 pt-0">
          <Button asChild className="flex-1 bg-indigo-600 hover:bg-indigo-700">
            <Link href={`/quiz/${quiz.id}/setup`}>
              <PlayCircle className="mr-2 h-4 w-4" />
              Start Practice
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
