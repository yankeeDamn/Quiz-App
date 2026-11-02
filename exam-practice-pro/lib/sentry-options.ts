import { scrubEvent, scrubSpan } from '../../src/telemetry/scrub';
export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  dataCollection: { userInfo: false, httpBodies: [] as never[] },
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
  beforeSendSpan: scrubSpan,
};
