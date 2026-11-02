'use client';
import { Analytics } from '@vercel/analytics/next';
import { analyticsUrl } from '@/lib/track-policy';
export function PageAnalytics() {
  if (process.env.NODE_ENV !== 'production') return null;
  return (
    <Analytics
      debug={false}
      beforeSend={(event) => {
        const url = analyticsUrl(event.url, event.type === 'event');
        return url ? { ...event, url } : null;
      }}
    />
  );
}
