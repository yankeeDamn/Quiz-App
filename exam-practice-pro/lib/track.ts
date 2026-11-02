import { track as vercelTrack } from '@vercel/analytics';
import { createTracker } from './track-policy';
export type { TrackEvent, TrackProps } from './track-policy';
// No server events, development logging, identity fields or automatic click tracking.
export const track = createTracker(
  vercelTrack,
  () => typeof window !== 'undefined' && process.env.NODE_ENV === 'production',
);

/** Deduplicate recovered attempts/retried submissions without transmitting an attempt ID. */
export function trackAttempt(
  event: 'mock_started' | 'mock_completed',
  attemptId: string,
  testId: string,
) {
  if (typeof window === 'undefined' || process.env.NODE_ENV !== 'production')
    return;
  const key = `exampro:metric:${event}:${attemptId}`;
  try {
    if (sessionStorage.getItem(key)) return;
  } catch {
    /* storage can be disabled */
  }
  if (track(event, { test_id: testId })) {
    try {
      sessionStorage.setItem(key, '1');
    } catch {
      /* best effort deduplication */
    }
  }
}
