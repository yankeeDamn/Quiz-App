'use client';

import { useEffect, useCallback } from 'react';

interface KeyboardShortcuts {
  onNext?: () => void;
  onPrevious?: () => void;
  onMarkForReview?: () => void;
  onSelectAnswer?: (index: number) => void;
  onSubmit?: () => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  onNext,
  onPrevious,
  onMarkForReview,
  onSelectAnswer,
  onSubmit,
  enabled = true,
}: KeyboardShortcuts) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in input fields
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Arrow keys for navigation
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        onNext?.();
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        onPrevious?.();
      }

      // M for mark for review
      if (event.key === 'm' || event.key === 'M') {
        event.preventDefault();
        onMarkForReview?.();
      }

      // Number keys 1-9 or letters A-D for answer selection
      const numberMatch = event.key.match(/^[1-9]$/);
      if (numberMatch) {
        event.preventDefault();
        onSelectAnswer?.(parseInt(numberMatch[0]) - 1);
      }

      const letterMatch = event.key.toUpperCase().match(/^[A-D]$/);
      if (letterMatch) {
        event.preventDefault();
        const index = letterMatch[0].charCodeAt(0) - 65; // A=0, B=1, etc.
        onSelectAnswer?.(index);
      }

      // Ctrl+Enter for submit
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        onSubmit?.();
      }
    },
    [enabled, onNext, onPrevious, onMarkForReview, onSelectAnswer, onSubmit]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
