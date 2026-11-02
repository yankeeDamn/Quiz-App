'use client';
import { useEffect } from 'react';
import './globals.css';
import { RecoveryScreen } from '@/components/layout/recovery-screen';
import { reportError } from '@/lib/report-error';
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error);
  }, [error]);
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RecoveryScreen kind="error" digest={error.digest} reset={reset} />
      </body>
    </html>
  );
}
