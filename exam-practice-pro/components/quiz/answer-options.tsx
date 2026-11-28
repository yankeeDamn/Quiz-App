'use client';

import { Question, QuestionOption } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getAnswerLabel } from '@/lib/quiz-utils';
import { Check, X } from 'lucide-react';

interface AnswerOptionsProps {
  question: Question;
  selectedAnswers: string[];
  onSelectAnswer: (answerId: string) => void;
  showFeedback?: boolean;
  disabled?: boolean;
  shuffledOptions?: QuestionOption[];
}

export function AnswerOptions({
  question,
  selectedAnswers,
  onSelectAnswer,
  showFeedback = false,
  disabled = false,
  shuffledOptions,
}: AnswerOptionsProps) {
  const options = shuffledOptions || question.options;
  const isMultiple = question.type === 'multiple';

  const handleOptionClick = (optionId: string) => {
    if (disabled) return;

    if (isMultiple) {
      // Toggle selection for multiple choice
      if (selectedAnswers.includes(optionId)) {
        // Remove the answer
        const newAnswers = selectedAnswers.filter((id) => id !== optionId);
        // We need to notify parent about all selected answers
        // This is handled by the parent component
      }
      onSelectAnswer(optionId);
    } else {
      // Single choice - just set the answer
      onSelectAnswer(optionId);
    }
  };

  const isCorrect = (optionId: string) =>
    question.correctAnswers.includes(optionId);
  const isSelected = (optionId: string) => selectedAnswers.includes(optionId);

  const getOptionStyles = (optionId: string) => {
    const selected = isSelected(optionId);
    const correct = isCorrect(optionId);

    if (showFeedback) {
      if (correct) {
        return 'border-green-500 bg-green-50 dark:bg-green-900/20';
      }
      if (selected && !correct) {
        return 'border-red-500 bg-red-50 dark:bg-red-900/20';
      }
    }

    if (selected) {
      return 'border-accent-ink bg-accent-soft dark:bg-accent-soft/20';
    }

    return 'border-border hover:border-border hover:bg-background dark:border-border dark:hover:border-accent-ink dark:hover:bg-surface-2';
  };

  return (
    <div className="space-y-3">
      {/* Question type hint */}
      <p className="text-xs text-muted-foreground">
        {isMultiple
          ? 'Select all that apply'
          : question.type === 'true-false'
          ? 'Select True or False'
          : 'Select one answer'}
      </p>

      {/* Options */}
      <div className="space-y-2">
        {options.map((option, index) => {
          const selected = isSelected(option.id);
          const correct = isCorrect(option.id);

          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => handleOptionClick(option.id)}
              role={isMultiple ? 'checkbox' : 'radio'}
              aria-checked={selected}
              aria-label={`Option ${getAnswerLabel(index)}: ${option.text}${showFeedback ? (correct ? ', correct answer' : selected ? ', incorrect' : '') : ''}`}
              className={cn(
                'group flex w-full items-start gap-4 rounded-xl border-2 p-4 text-left transition-all',
                getOptionStyles(option.id),
                disabled && 'cursor-default',
                !disabled && 'cursor-pointer'
              )}
            >
              {/* Option Label */}
              <span
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-medium text-sm transition-colors',
                  selected
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-surface-2 text-muted-foreground dark:bg-surface-2 dark:text-muted-foreground group-hover:bg-accent-soft group-hover:text-accent-ink',
                  showFeedback && correct && 'bg-green-600 text-white',
                  showFeedback && selected && !correct && 'bg-red-600 text-white'
                )}
              >
                {getAnswerLabel(index)}
              </span>

              {/* Option Text */}
              <span className="flex-1 pt-1 text-sm">{option.text}</span>

              {/* Feedback Icon */}
              {showFeedback && (
                <span className="shrink-0 pt-1">
                  {correct && (
                    <Check className="h-5 w-5 text-green-600" />
                  )}
                  {selected && !correct && (
                    <X className="h-5 w-5 text-red-600" />
                  )}
                </span>
              )}

              {/* Selection Indicator for non-feedback mode */}
              {!showFeedback && selected && (
                <span
                  className={cn(
                    'shrink-0 pt-1',
                    isMultiple ? 'text-accent-ink' : 'text-accent-ink'
                  )}
                >
                  <Check className="h-5 w-5" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
