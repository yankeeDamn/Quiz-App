'use client';

import { useEffect, useState } from 'react';
import { API_BASE_URL } from '@/lib/api';

type CheckState = 'checking' | 'ready' | 'not-ready' | 'unreachable' | 'timeout';
type ReadyPayload = {
  success?: boolean;
  data?: {
    status?: string;
    database?: string;
    authentication?: string;
  };
};

const TIMEOUT_MS = 90_000;
const healthUrl = API_BASE_URL + '/api/v1/health/ready';

/**
 * Check readiness in the browser instead of inside a time-limited Vercel
 * server function. Render Free may sleep after inactivity and take ~1 minute
 * to wake. Show the actual API response, never infer ready from HTTP 200 alone.
 */
export function ApiReadiness() {
  const [state, setState] = useState<CheckState>('checking');
  const [detail, setDetail] = useState('Connecting to the Render API...');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const startedAt = Date.now();
    const ticker = window.setInterval(() => {
      if (mounted) setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    const timeout = window.setTimeout(() => controller.abort(), TIMEOUT_MS);

    async function check() {
      try {
        const response = await fetch(healthUrl, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null) as ReadyPayload | null;
        if (!mounted) return;

        const data = payload?.data;
        if (response.ok && payload?.success === true &&
            data?.status === 'ready' &&
            data?.database === 'connected' &&
            data?.authentication === 'configured') {
          setState('ready');
          setDetail('Render API responding; database connected and authentication configured.');
          return;
        }

        setState('not-ready');
        const components = [
          data?.database ? 'Database: ' + data.database : null,
          data?.authentication ? 'Authentication: ' + data.authentication : null,
        ].filter(Boolean).join(' · ');
        setDetail('HTTP ' + response.status + ' — ' +
          (components || 'The service responded but was not ready. Check Render logs.'));
      } catch (error) {
        if (!mounted) return;
        if (controller.signal.aborted) {
          setState('timeout');
          setDetail('The API did not respond within 90 seconds. Check the Render service and its logs.');
        } else {
          setState('unreachable');
          setDetail('Your browser could not reach the Render API. Check the URL, service availability, and CORS_ORIGINS for this Vercel domain.');
        }
      } finally {
        window.clearTimeout(timeout);
        window.clearInterval(ticker);
      }
    }

    void check();
    return () => {
      mounted = false;
      controller.abort();
      window.clearTimeout(timeout);
      window.clearInterval(ticker);
    };
  }, [attempt]);

  const checkAgain = () => {
    setElapsedSeconds(0);
    setState('checking');
    setDetail('Connecting to the Render API...');
    setAttempt(n => n + 1);
  };

  return <section className="rounded-xl border p-5" aria-live="polite">
    <h2 className="font-bold">Backend API connection</h2>
    <p className="mt-2 break-all font-mono text-xs">{API_BASE_URL}</p>
    <p role="status" className={'mt-3 font-semibold ' +
      (state === 'ready'
        ? 'text-emerald-700 dark:text-emerald-300'
        : state === 'checking'
          ? 'text-indigo-700 dark:text-indigo-300'
          : 'text-amber-700 dark:text-amber-300')}>
      {state === 'ready' ? 'Ready' :
        state === 'checking' ? 'Checking API… (' + elapsedSeconds + 's)' :
        state === 'not-ready' ? 'API responded — not ready' :
        state === 'timeout' ? 'Connection timed out' : 'API unreachable from this browser'}
    </p>
    <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
    {state === 'checking' && elapsedSeconds >= 10 &&
      <p className="mt-2 text-sm text-muted-foreground">
        On Render Free, the first request after inactivity can take about a minute.
        This check waits up to 90 seconds and will show the actual readiness result.
      </p>}
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button type="button" onClick={checkAgain} disabled={state === 'checking'}
        className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:cursor-wait disabled:opacity-50">
        Check again
      </button>
      <a href={healthUrl} target="_blank" rel="noopener noreferrer"
        className="text-sm font-semibold text-indigo-700 underline dark:text-indigo-300">
        Open API readiness response
      </a>
    </div>
    <p className="mt-3 text-xs text-muted-foreground">
      This is a live check, not a promise that sign-in or exam submissions work.
      A successful check should be followed by a real mock-test submission.
    </p>
  </section>;
}
