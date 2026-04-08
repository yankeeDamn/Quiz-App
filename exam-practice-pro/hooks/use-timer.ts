'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseTimerProps {
  initialTime: number; // in seconds
  onTimeUp?: () => void;
  isPaused?: boolean;
}

interface UseTimerReturn {
  timeLeft: number;
  isWarning: boolean;
  isDanger: boolean;
  isExpired: boolean;
  pause: () => void;
  resume: () => void;
  reset: (newTime?: number) => void;
}

export function useTimer({
  initialTime,
  onTimeUp,
  isPaused = false,
}: UseTimerProps): UseTimerReturn {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [paused, setPaused] = useState(isPaused);
  const onTimeUpRef = useRef(onTimeUp);
  const hasCalledTimeUp = useRef(false);

  // Keep callback ref updated
  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);

  // Sync external pause state
  useEffect(() => {
    setPaused(isPaused);
  }, [isPaused]);

  // Timer countdown
  useEffect(() => {
    if (paused || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        const newTime = Math.max(0, prev - 1);
        if (newTime === 0 && !hasCalledTimeUp.current) {
          hasCalledTimeUp.current = true;
          setTimeout(() => onTimeUpRef.current?.(), 0);
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [paused, timeLeft]);

  const pause = useCallback(() => {
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    setPaused(false);
  }, []);

  const reset = useCallback((newTime?: number) => {
    setTimeLeft(newTime ?? initialTime);
    hasCalledTimeUp.current = false;
  }, [initialTime]);

  return {
    timeLeft,
    isWarning: timeLeft <= 300 && timeLeft > 60, // Less than 5 minutes
    isDanger: timeLeft <= 60, // Less than 1 minute
    isExpired: timeLeft <= 0,
    pause,
    resume,
    reset,
  };
}
