import { ArrowUpRight, CalendarDays, Clock3, ClipboardList } from 'lucide-react';
import type { GovernmentJob } from '@/lib/government-jobs';

function formatDate(value: string) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

export function RecruitmentNoticeCard({ job, onTrack }: { job: GovernmentJob; onTrack?: (job: GovernmentJob) => void }) {
  return (
    <article className="flex h-full flex-col justify-between rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md motion-reduce:transition-none sm:p-6">
      <div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full px-2.5 py-1 font-semibold ${job.status === 'open'
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
            : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'}`}>
            {job.status === 'open' ? 'Applications open' : 'Forthcoming · dates not announced'}
          </span>
          <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground">{job.category}</span>
        </div>
        <h3 className="mt-4 text-lg font-bold leading-snug tracking-tight">{job.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{job.organisation}</p>
        <div className="mt-4 space-y-2 text-sm">
          <p className="flex items-start gap-2">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>{job.applicationDeadline
              ? `Application deadline: ${formatDate(job.applicationDeadline)}`
              : 'Application dates: not announced by the source'}</span>
          </p>
          {job.noticeDate && (
            <p className="flex items-start gap-2 text-muted-foreground">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Notice listed: {formatDate(job.noticeDate)}</span>
            </p>
          )}
        </div>
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{job.notice}</p>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
      <a
        href={job.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-flex min-h-11 items-center gap-2 self-start rounded-lg border px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        View official notice source
        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
      {onTrack && (
        <button type="button" onClick={() => onTrack(job)}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ClipboardList className="h-4 w-4" aria-hidden="true" /> Save tracker draft
        </button>
      )}
      </div>
    </article>
  );
}
