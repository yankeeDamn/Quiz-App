'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  ArrowUpRight, BriefcaseBusiness, CalendarDays, CheckCircle2, RefreshCw,
  Search, ShieldCheck, SlidersHorizontal, X,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { RecruitmentNoticeCard } from '@/components/government-jobs/recruitment-notice-card';
import { api } from '@/lib/api';
import { checkedAt, jobsErrorMessage, type GovernmentJobsResponse, type RecruitmentPortal } from '@/lib/government-jobs';

const CATEGORIES = ['All', 'SSC', 'UPSC', 'Railways', 'Banking', 'General'] as const;
const TABS = [
  { id: 'notices', label: 'Latest Notices' },
  { id: 'upcoming', label: 'Upcoming Exams' },
  { id: 'portals', label: 'Official Portals' },
] as const;
type TabId = typeof TABS[number]['id'];
const EMPTY_JOBS: GovernmentJobsResponse['jobs'] = [];

const OFFICIAL_PORTALS: RecruitmentPortal[] = [
  { name: 'Employment News', category: 'General', url: 'https://employmentnews.gov.in/newemp/AllJobs.aspx?k=All', description: 'Official central-government recruitment listings' },
  { name: 'Staff Selection Commission', category: 'SSC', url: 'https://ssc.gov.in/', description: 'SSC notifications and recruitment calendar' },
  { name: 'Union Public Service Commission', category: 'UPSC', url: 'https://cms.upsc.gov.in/examination-calendar/', description: 'Forthcoming examinations and official calendar' },
  { name: 'National Career Service', category: 'General', url: 'https://ncs.gov.in/', description: 'Government and private vacancies with filters' },
  { name: 'Institute of Banking Personnel Selection', category: 'Banking', url: 'https://www.ibps.in/', description: 'Banking exam notices and application calendar' },
  { name: 'Railway Recruitment Boards', category: 'Railways', url: 'https://www.rrbcdg.gov.in/', description: 'RRB central notices and application updates' },
];

function SummaryCard({ label, value, detail, icon: Icon }: {
  label: string;
  value: string;
  detail: string;
  icon: typeof BriefcaseBusiness;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border bg-card p-4 sm:p-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/5 text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-bold tracking-tight tabular-nums">{value}</p>
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function LoadingCards() {
  return (
    <div className="grid gap-4 md:grid-cols-2" aria-label="Loading government notices">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="animate-pulse rounded-2xl border bg-card p-6 motion-reduce:animate-none">
          <div className="h-5 w-36 rounded bg-muted" />
          <div className="mt-5 h-6 w-4/5 rounded bg-muted" />
          <div className="mt-3 h-4 w-2/5 rounded bg-muted" />
          <div className="mt-6 h-4 w-3/5 rounded bg-muted" />
          <div className="mt-8 h-10 w-48 rounded-lg bg-muted" />
        </div>
      ))}
    </div>
  );
}

function PortalCard({ portal }: { portal: RecruitmentPortal }) {
  return (
    <a
      href={portal.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex min-h-40 flex-col rounded-2xl border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
    >
      <span className="flex items-start justify-between gap-3 font-bold">
        {portal.name}
        <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
      </span>
      <span className="mt-2 text-sm leading-6 text-muted-foreground">{portal.description}</span>
      <span className="mt-auto pt-4 text-xs font-semibold text-primary">{portal.category} · official portal</span>
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

export default function GovernmentJobsPage() {
  const [feed, setFeed] = useState<GovernmentJobsResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TabId>('notices');
  const inFlight = useRef(false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const response = await api<GovernmentJobsResponse>('/api/v1/government-jobs', { public: true });
      if (response.success && response.data) {
        setFeed(response.data);
        setError('');
      } else {
        setError(jobsErrorMessage(response.error));
      }
    } catch {
      setError('Could not reach the official-notice index. Please try again; official recruitment portals are listed below.');
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialRequest = window.setTimeout(() => void refresh(), 0);
    const id = window.setInterval(() => void refresh(), 15 * 60 * 1000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearTimeout(initialRequest);
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refresh]);

  const jobs = feed?.jobs ?? EMPTY_JOBS;
  const openCount = jobs.filter((job) => job.status === 'open').length;
  const upcomingJobs = jobs.filter((job) => job.status === 'upcoming');
  const healthyCount = feed?.sources.filter((source) => source.status === 'ok').length ?? 0;
  const records = useMemo(() => jobs.filter((job) => {
    if (filter !== 'All' && job.category !== filter) return false;
    const term = search.trim().toLowerCase();
    return !term || [job.title, job.organisation, job.source, job.method, job.category]
      .join(' ').toLowerCase().includes(term);
  }), [jobs, filter, search]);
  const portals = feed?.portals ?? OFFICIAL_PORTALS;
  const shownPortals = portals.filter((portal) => {
    if (filter !== 'All' && portal.category !== filter) return false;
    const term = search.trim().toLowerCase();
    return !term || [portal.name, portal.category, portal.description].join(' ').toLowerCase().includes(term);
  });
  const visibleJobs = tab === 'upcoming' ? records.filter((job) => job.status === 'upcoming') : records.filter((job) => job.status === 'open');

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const currentIndex = TABS.findIndex((item) => item.id === tab);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % TABS.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex + TABS.length - 1) % TABS.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = TABS.length - 1;
    else return;
    event.preventDefault();
    setTab(TABS[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  }

  function resetFilters() {
    setFilter('All');
    setSearch('');
  }

  const listIsEmpty = tab !== 'portals' && !loading && feed !== null && visibleJobs.length === 0;
  const noMatchingFilter = records.length === 0 && (search.length > 0 || filter !== 'All');

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-12 pt-6 sm:px-6 sm:pt-10 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] border bg-gradient-to-br from-indigo-50 via-background to-teal-50 p-5 dark:from-indigo-950/40 dark:via-background dark:to-teal-950/30 sm:p-8 lg:p-10">
          <div className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full bg-indigo-400/10 blur-3xl" />
          <div className="relative max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-primary">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" /> ExamPro career desk
            </p>
            <h1 className="mt-5 max-w-2xl text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Your next opportunity starts with the official notice.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Find verified government recruitment updates, track published deadlines and go straight to the issuing authority.
            </p>
            <label className="mt-7 flex min-h-14 w-full max-w-2xl items-center gap-3 rounded-2xl border bg-background px-4 shadow-sm focus-within:ring-2 focus-within:ring-ring sm:px-5">
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                className="w-full bg-transparent py-3 text-base outline-none placeholder:text-muted-foreground"
                type="search"
                placeholder="Search role, organization or exam"
                aria-label="Search government job notices by role, organization or exam"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Clear search">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </label>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground sm:text-sm">
              <span className="inline-flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Best-effort source checks</span>
              <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> Published dates only</span>
              <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Always verify with the authority</span>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-3 sm:grid-cols-3" aria-label="Government jobs summary">
          <SummaryCard label="Open notices" value={feed ? String(openCount) : '—'} detail="Verified future application deadlines" icon={BriefcaseBusiness} />
          <SummaryCard label="Upcoming exams" value={feed ? String(upcomingJobs.length) : '—'} detail="Forthcoming notices from checked sources" icon={CalendarDays} />
          <SummaryCard label="Healthy sources" value={feed ? `${healthyCount}/${feed.sources.length}` : '—'} detail="Official connectors checked successfully" icon={ShieldCheck} />
        </section>

        <section className="mt-8" aria-label="Browse government opportunities">
          <div className="flex flex-col gap-4 border-b sm:flex-row sm:items-end sm:justify-between">
            <div role="tablist" aria-label="Government jobs sections" className="-mb-px flex overflow-x-auto">
              {TABS.map((item, index) => (
                <button
                  key={item.id}
                  ref={(element) => { tabRefs.current[index] = element; }}
                  id={`jobs-tab-${item.id}`}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  aria-controls={`jobs-panel-${item.id}`}
                  tabIndex={tab === item.id ? 0 : -1}
                  onClick={() => setTab(item.id)}
                  onKeyDown={onTabKeyDown}
                  className={`min-h-12 shrink-0 border-b-2 px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5 ${tab === item.id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                  {item.label}
                  {item.id === 'notices' && feed && <span className="ml-2 text-xs tabular-nums text-muted-foreground">{openCount}</span>}
                  {item.id === 'upcoming' && feed && <span className="ml-2 text-xs tabular-nums text-muted-foreground">{upcomingJobs.length}</span>}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 pb-3">
              <label className="sr-only" htmlFor="jobs-category">Filter by category</label>
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <select id="jobs-category" className="min-h-10 rounded-lg border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={filter} onChange={(event) => setFilter(event.target.value)}>
                {CATEGORIES.map((category) => <option key={category} value={category}>{category === 'All' ? 'All categories' : category}</option>)}
              </select>
              <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors hover:bg-muted disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />
                <span>{loading && feed ? 'Checking…' : 'Refresh'}</span>
              </button>
              {(filter !== 'All' || search) && (
                <button type="button" onClick={resetFilters} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Reset</button>
              )}
            </div>
          </div>

          <div
            id={`jobs-panel-${tab}`}
            role="tabpanel"
            aria-labelledby={`jobs-tab-${tab}`}
            tabIndex={0}
            className="min-h-48 pt-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {tab === 'portals' ? (
              <div>
                <div className="mb-5 max-w-3xl">
                  <h2 className="text-xl font-bold tracking-tight">Go directly to official recruitment portals</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">Automatic indexing currently covers Employment News and UPSC only. SSC, Banking and Railways are linked here for direct checks; they are not automatically indexed in this feed.</p>
                </div>
                {shownPortals.length > 0
                  ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{shownPortals.map((portal) => <PortalCard key={portal.url} portal={portal} />)}</div>
                  : <EmptyState title="No portals match this search" description="Try another search or category. The official recruitment portals are still available for direct checks." onReset={resetFilters} showReset={filter !== 'All' || search.length > 0} portals={portals} />}
              </div>
            ) : (
              <>
                <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">{tab === 'upcoming' ? 'Forthcoming examination notices' : 'Latest open recruitment notices'}</h2>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                      {tab === 'upcoming'
                        ? 'Only upcoming notices returned by checked official sources appear here. Exam dates are shown only when the source provides them; this feed currently does not ingest an examination calendar.'
                        : 'A best-effort index, not a complete vacancy feed. Confirm the full notice and deadline on its official source.'}
                    </p>
                  </div>
                  {feed && <span className="text-xs text-muted-foreground">{visibleJobs.length} {visibleJobs.length === 1 ? 'notice' : 'notices'}</span>}
                </div>

                {error && <p role="alert" className="mb-4 rounded-xl border border-amber-400 bg-amber-50/70 p-4 text-sm leading-6 dark:bg-amber-950/20">{error}</p>}
                {loading && !feed && <div role="status" aria-label="Checking official recruitment sources"><LoadingCards /><p className="mt-3 text-sm text-muted-foreground">Checking official recruitment sources…</p></div>}
                {listIsEmpty && (
                  <EmptyState
                    title={noMatchingFilter ? 'No notices match these filters' : tab === 'upcoming' ? 'No upcoming exam notices were returned' : healthyCount === 0 ? 'Official sources are temporarily unavailable' : 'No open notices from the checked sources'}
                    description={noMatchingFilter
                      ? 'Try another category or search term. Automatic indexing currently covers Employment News and UPSC; other recruitment portals are available for direct checks.'
                      : healthyCount === 0
                        ? 'The notices could not be verified right now. Check source health below or visit an official recruitment portal directly.'
                        : 'Expired application deadlines are hidden. This does not mean there are no government vacancies elsewhere; source coverage is limited, so check the official portals directly.'}
                    onReset={resetFilters}
                    showReset={filter !== 'All' || search.length > 0}
                    portals={portals}
                  />
                )}
                {!loading && !feed && (
                  <EmptyState title="Notices are not available yet" description="The official-notice index has not returned data. You can still check recruitment updates directly with these official portals." onReset={resetFilters} showReset={false} portals={portals} />
                )}
                {visibleJobs.length > 0 && (
                  <div className="grid gap-4 md:grid-cols-2">
                    {visibleJobs.map((job) => <RecruitmentNoticeCard key={job.id} job={job} />)}
                  </div>
                )}
                {loading && feed && <p role="status" className="mb-3 text-sm text-muted-foreground">Checking official sources… Current notices remain available.</p>}
              </>
            )}
          </div>
        </section>

        {feed && (
          <details className="mt-8 rounded-2xl border bg-card">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5">
              <span className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" /> Source diagnostics</span>
              <span className="text-sm font-normal text-muted-foreground">{healthyCount} of {feed.sources.length} sources healthy</span>
            </summary>
            <div className="grid gap-3 border-t p-4 sm:grid-cols-2 sm:p-5">
              {feed.sources.map((source) => (
                <article key={source.id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <a href={source.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {source.name}<span className="sr-only"> (opens in a new tab)</span>
                    </a>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${source.status === 'ok'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300'}`}>
                      {source.status === 'ok' ? 'Healthy' : source.status === 'stale' ? 'Stale · showing cached data' : 'Unavailable'}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{source.message || 'No additional source details provided.'}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Last successful check: {checkedAt(source.checkedAt)}</p>
                  {source.status !== 'ok' && <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">Last attempted: {checkedAt(source.lastAttemptAt ?? null)}</p>}
                </article>
              ))}
            </div>
          </details>
        )}

        {feed && <p role="status" className="mt-3 text-right text-xs text-muted-foreground">Feed refreshed {checkedAt(feed.updatedAt)}</p>}
        <p className="mt-8 rounded-xl border bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
          <strong className="text-foreground">Important:</strong> ExamPro is not associated with or endorsed by any recruitment authority. Openings can change, be postponed or be withdrawn without notice. Always verify eligibility, dates, fees and the final application link on the official government website. ExamPro does not accept job applications.
        </p>
      </main>
      <Footer />
    </>
  );
}

function EmptyState({ title, description, onReset, showReset, portals = [] }: {
  title: string;
  description: string;
  onReset: () => void;
  showReset: boolean;
  portals?: RecruitmentPortal[];
}) {
  const suggested = portals.filter((portal) => ['General', 'UPSC', 'SSC', 'Banking', 'Railways'].includes(portal.category)).slice(0, 4);
  return (
    <div className="rounded-2xl border border-dashed bg-muted/20 p-5 sm:p-7">
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
      {showReset && <button type="button" onClick={onReset} className="mt-4 min-h-10 rounded-lg border bg-background px-4 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Reset search and category</button>}
      {suggested.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2" aria-label="Suggested official portals">
          {suggested.map((portal) => (
            <a key={portal.url} href={portal.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg border bg-background px-3 text-sm font-semibold hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              {portal.name}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /><span className="sr-only">(opens in a new tab)</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
