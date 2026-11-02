import * as Sentry from '@sentry/nextjs';
import { sentryOptions } from './lib/sentry-options';
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  try {
    Sentry.init(sentryOptions);
  } catch {
    console.warn('Error monitoring could not be initialized.');
  }
}
