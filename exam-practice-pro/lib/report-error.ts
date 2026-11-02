export function reportError(error: Error) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  void import('@sentry/nextjs')
    .then((Sentry) => Sentry.captureException(error))
    .catch(() => {
      /* monitoring cannot break recovery */
    });
}
