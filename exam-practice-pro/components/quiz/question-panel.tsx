'use client';

import { Question, QuestionOption } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { AnswerOptions } from './answer-options';
import { QuestionActions } from './question-actions';
import { getDifficultyColor, getQuestionTypeLabel } from '@/lib/quiz-utils';
import Image from 'next/image';

interface QuestionPanelProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  selectedAnswers: string[];
  onSelectAnswer: (answerId: string) => void;
  showFeedback?: boolean;
  shuffledOptions?: QuestionOption[];
  quizId?: string;
  showActions?: boolean;
}

export function QuestionPanel({
  question,
  questionNumber,
  totalQuestions,
  selectedAnswers,
  onSelectAnswer,
  showFeedback = false,
  shuffledOptions,
  quizId,
  showActions = true,
}: QuestionPanelProps) {
  return (
    <div className="space-y-6">
      {/* Question Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold">
            Question {questionNumber} of {totalQuestions}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showActions && quizId && (
            <QuestionActions
              questionId={question.id}
              quizId={quizId}
              compact
            />
          )}
          <Badge variant="outline" className="text-xs">
            {question.subject}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {question.topic}
          </Badge>
          <Badge className={getDifficultyColor(question.difficulty)}>
            {question.difficulty}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {getQuestionTypeLabel(question.type)}
          </Badge>
        </div>
      </div>

      {/* Question Text */}
      <div className="rounded-xl bg-gray-50 p-6 dark:bg-gray-900/50">
        <p className="text-lg leading-relaxed">{question.question}</p>

        {/* Optional Image */}
        {question.imageUrl && (
          <div className="mt-4 overflow-hidden rounded-lg">
            <Image
              src={question.imageUrl}
              alt="Question illustration"
              width={600}
              height={400}
              className="max-w-full h-auto"
            />
          </div>
        )}
      </div>

      {/* Answer Options */}
      <AnswerOptions
        question={question}
        selectedAnswers={selectedAnswers}
        onSelectAnswer={onSelectAnswer}
        showFeedback={showFeedback}
        shuffledOptions={shuffledOptions}
      />
    </div>
  );
}
