export type JobStatus = 'open' | 'upcoming';
export type GovernmentJob = {
  id: string; title: string; organisation: string; category: string; status: JobStatus;
  applicationDeadline: string | null; noticeDate: string | null; method: string; source: string;
  sourceUrl: string; applicationUrl: string | null; notice: string;
};
export type RecruitmentPortal = { name: string; category: string; url: string; description: string };
export type RecruitmentSource = {
  id: string; name: string; url: string; status: 'ok' | 'stale' | 'unavailable';
  checkedAt: string | null; lastAttemptAt?: string | null; message?: string;
};
export type GovernmentJobsResponse = {
  jobs: GovernmentJob[]; portals: RecruitmentPortal[]; sources: RecruitmentSource[];
  updatedAt: string; disclaimer: string;
};

export function jobsErrorMessage(error?: { message: string; status?: number }): string {
  if (error?.status === 404) {
    return 'The jobs feed is not available on the deployed API yet. The API deployment needs updating; official portal links are available below.';
  }
  return error?.message || 'Could not reach the official-notice index. Please try again.';
}

export function checkedAt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata',
  }) : 'No successful check yet';
}
