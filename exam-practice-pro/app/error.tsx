'use client';
import { useEffect } from 'react';
import { RecoveryScreen } from '@/components/layout/recovery-screen';
import { reportError } from '@/lib/report-error';
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error);
  }, [error]);
  return <RecoveryScreen kind="error" digest={error.digest} reset={reset} />;
}
