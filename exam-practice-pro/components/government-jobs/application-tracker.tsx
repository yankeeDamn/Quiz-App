'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { ArrowUpRight, BriefcaseBusiness, CheckCircle2, Eye, EyeOff, FilePlus2, LockKeyhole, Pencil, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { GovernmentJob } from '@/lib/government-jobs';

type ApplicationStatus = 'planning' | 'applied' | 'admit_card' | 'exam_completed' | 'result_checked' | 'withdrawn';
type Category = 'SSC' | 'UPSC' | 'Railways' | 'Banking' | 'General' | 'Other';
type Application = {
  id: string;
  noticeId: string | null;
  title: string;
  organisation: string;
  category: Category;
  officialUrl: string | null;
  status: ApplicationStatus;
  applicationDate: string | null;
  deadline: string | null;
  referenceMasked: string | null;
  createdAt: string;
  updatedAt: string;
  statusSource: 'self_reported';
};
type FormValues = {
  title: string;
  organisation: string;
  category: Category;
  officialUrl: string;
  status: ApplicationStatus;
  applicationDate: string;
  deadline: string;
  reference: string;
  noticeId: string;
};
const INITIAL: FormValues = {
  title: '', organisation: '', category: 'General', officialUrl: '', status: 'planning',
  applicationDate: '', deadline: '', reference: '', noticeId: '',
};
const STATUS: { id: ApplicationStatus; label: string }[] = [
  { id: 'planning', label: 'Planning to apply' },
  { id: 'applied', label: 'Applied (self-reported)' },
  { id: 'admit_card', label: 'Admit card checked' },
  { id: 'exam_completed', label: 'Exam completed' },
  { id: 'result_checked', label: 'Result checked' },
  { id: 'withdrawn', label: 'Closed / withdrawn' },
];
const CATEGORIES: Category[] = ['SSC', 'UPSC', 'Railways', 'Banking', 'General', 'Other'];
const FIELD = 'min-h-11 w-full rounded-xl border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
function showDate(iso: string | null) {
  return iso ? new Date(iso + 'T12:00:00Z').toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
  }) : 'Not recorded';
}
function fromJob(job: GovernmentJob): FormValues {
  return {
    ...INITIAL, title: job.title, organisation: job.organisation, category: CATEGORIES.includes(job.category as Category) ? job.category as Category : 'General',
    officialUrl: job.sourceUrl, deadline: job.applicationDeadline || '', noticeId: job.id,
  };
}
export function ApplicationTracker({ seed, onSeedConsumed }: {
  seed: GovernmentJob | null;
  onSeedConsumed: () => void;
}) {
  const { data: session, status: authStatus } = useSession();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [clearReference, setClearReference] = useState(false);
  const [form, setForm] = useState<FormValues>(INITIAL);
  const [reveal, setReveal] = useState<{ id: string; value: string | null } | null>(null);
  const [filter, setFilter] = useState<ApplicationStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const epoch = useRef(0);

  const load = useCallback(async (currentEpoch: number) => {
    setLoading(true);
    const result = await api<{ applications: Application[] }>('/api/v1/government-job-applications');
    if (epoch.current !== currentEpoch) return;
    if (result.success && result.data) {
      setApplications(result.data.applications);
      setError('');
    } else {
      setApplications([]);
      setError(result.error?.message || 'Could not load your applications.');
    }
    setLoading(false);
  }, []);

  // Never show prior-account records after switching OAuth identity or signing out.
  useEffect(() => {
    const current = ++epoch.current;
    setApplications([]);
    setForm(INITIAL);
    setEditingId(null);
    setShowForm(false);
    setReveal(null);
    setError('');
    setMessage('');
    if (authStatus === 'authenticated' && session?.user?.email) {
      void load(current);
    }
  }, [authStatus, session?.user?.email, load]);

  useEffect(() => {
    if (seed && authStatus === 'authenticated') {
      setForm(fromJob(seed));
      setEditingId(null);
      setClearReference(false);
      setReveal(null);
      setShowForm(true);
      setMessage('Notice details copied into a draft. No government application has been submitted or tracked yet.');
      onSeedConsumed();
    }
  }, [seed, authStatus, onSeedConsumed]);

  const visible = useMemo(() => applications.filter(item => {
    if (filter !== 'all' && item.status !== filter) return false;
    const q = search.trim().toLowerCase();
    return !q || [item.title, item.organisation, item.category].join(' ').toLowerCase().includes(q);
  }), [applications, filter, search]);

  const setField = (name: keyof FormValues, value: string) =>
    setForm(previous => ({ ...previous, [name]: value }));

  function resetForm() {
    setForm(INITIAL);
    setEditingId(null);
    setClearReference(false);
    setShowForm(false);
  }
  function edit(item: Application) {
    setForm({
      title: item.title, organisation: item.organisation, category: item.category,
      officialUrl: item.officialUrl || '', status: item.status,
      applicationDate: item.applicationDate || '', deadline: item.deadline || '',
      reference: '', noticeId: item.noticeId || '',
    });
    setEditingId(item.id);
    setClearReference(false);
    setReveal(null);
    setShowForm(true);
    setMessage('');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const current = epoch.current;
    setSaving(true);
    setError('');
    setMessage('');
    const payload: Record<string, unknown> = {
      title: form.title, organisation: form.organisation, category: form.category, status: form.status,
      officialUrl: form.officialUrl || null, applicationDate: form.applicationDate || null,
      deadline: form.deadline || null, noticeId: form.noticeId || null,
    };
    if (form.reference.trim()) payload.reference = form.reference.trim();
    else if (editingId && clearReference) payload.reference = null;
    const result = await api(editingId ? '/api/v1/government-job-applications/' + encodeURIComponent(editingId) : '/api/v1/government-job-applications', {
      method: editingId ? 'PATCH' : 'POST', body: payload,
    });
    if (epoch.current !== current) return;
    setSaving(false);
    if (!result.success) {
      setError(result.error?.message || 'Could not save your application.');
      return;
    }
    resetForm();
    setReveal(null);
    setMessage('Saved privately. The status is your own record, not a government-confirmed status.');
    await load(current);
  }

  async function deleteOne(item: Application) {
    if (!window.confirm('Permanently delete this saved record? This cannot be undone.')) return;
    const current = epoch.current;
    setError('');
    const result = await api('/api/v1/government-job-applications/' + encodeURIComponent(item.id), { method: 'DELETE' });
    if (epoch.current !== current) return;
    if (!result.success) {
      setError(result.error?.message || 'Could not remove the record.');
      return;
    }
    if (editingId === item.id) resetForm();
    if (reveal?.id === item.id) setReveal(null);
    setMessage('Application record deleted.');
    await load(current);
  }

  async function revealReference(item: Application) {
    if (reveal?.id === item.id) { setReveal(null); return; }
    const current = epoch.current;
    setReveal(null);
    const result = await api<{ reference: string | null }>('/api/v1/government-job-applications/' + encodeURIComponent(item.id) + '/reference');
    if (epoch.current !== current) return;
    if (!result.success || !result.data) {
      setError(result.error?.message || 'Could not retrieve this reference.');
      return;
    }
    setReveal({ id: item.id, value: result.data.reference });
  }

  if (authStatus === 'loading') {
    return <p role="status" className="rounded-2xl border bg-card p-6 text-muted-foreground">Checking your session…</p>;
  }
  if (authStatus !== 'authenticated' || !session?.user?.email) {
    return (
      <div className="rounded-2xl border bg-card p-6 sm:p-8">
        <LockKeyhole className="h-9 w-9 text-primary" aria-hidden="true" />
        <h2 className="mt-4 text-2xl font-bold">Your applications, kept private</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Sign in with Google or GitHub to manually save job applications and reference numbers. Job discovery and official source links remain free without signing in.
        </p>
        <Link href="/auth/signin" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">Sign in to manage applications</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6" aria-label="Private government job application tracker">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border bg-gradient-to-r from-indigo-50 to-background p-5 dark:from-indigo-950/20 sm:flex-row sm:items-center sm:p-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Private application journal</p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">My Applications</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Track the applications you submit on official recruitment portals. All statuses are entered by you; ExamPro cannot verify your official application status.
          </p>
        </div>
        <button type="button" onClick={() => { resetForm(); setShowForm(true); setError(''); setMessage(''); }}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <FilePlus2 className="h-4 w-4" aria-hidden="true" /> Add application
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4"><p className="text-2xl font-bold tabular-nums">{applications.length}</p><p className="text-xs text-muted-foreground">Saved records</p></div>
        <div className="rounded-xl border bg-card p-4"><p className="text-2xl font-bold tabular-nums">{applications.filter(item => item.status === 'applied').length}</p><p className="text-xs text-muted-foreground">Marked applied</p></div>
        <div className="col-span-2 rounded-xl border bg-card p-4 sm:col-span-1"><p className="text-2xl font-bold tabular-nums">{applications.filter(item => item.deadline && item.deadline >= new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })).length}</p><p className="text-xs text-muted-foreground">Future saved deadlines · no reminders</p></div>
      </div>

      {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:bg-red-950/20 dark:text-red-200">{error}</p>}
      {message && <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">{message}</p>}

      {showForm && (
        <form onSubmit={event => void save(event)} className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6" aria-label={editingId ? 'Edit saved application' : 'Save a new application'}>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">{editingId ? 'Edit application' : 'Add application details'}</h3>
            <button type="button" onClick={resetForm} aria-label="Close application editor" className="rounded-lg p-2 hover:bg-muted"><X className="h-5 w-5" /></button>
          </div>
          <p className="text-xs text-muted-foreground">Never enter Aadhaar, OTPs, government passwords, payment information or identity documents. Applying takes place only on the official government website.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-semibold">Post / exam name *
              <input required minLength={3} maxLength={180} value={form.title} onChange={e => setField('title', e.target.value)} className={FIELD} placeholder="e.g. SSC CGL" />
            </label>
            <label className="space-y-1 text-sm font-semibold">Recruiting organization *
              <input required minLength={2} maxLength={180} value={form.organisation} onChange={e => setField('organisation', e.target.value)} className={FIELD} placeholder="e.g. Staff Selection Commission" />
            </label>
            <label className="space-y-1 text-sm font-semibold">Category
              <select className={FIELD} value={form.category} onChange={e => setField('category', e.target.value)}>{CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}</select>
            </label>
            <label className="space-y-1 text-sm font-semibold">My tracking status
              <select className={FIELD} value={form.status} onChange={e => setField('status', e.target.value)}>{STATUS.map(value => <option key={value.id} value={value.id}>{value.label}</option>)}</select>
            </label>
            <label className="space-y-1 text-sm font-semibold">Application date (optional)
              <input type="date" value={form.applicationDate} onChange={e => setField('applicationDate', e.target.value)} className={FIELD} />
            </label>
            <label className="space-y-1 text-sm font-semibold">Deadline (optional; verify with authority)
              <input type="date" value={form.deadline} onChange={e => setField('deadline', e.target.value)} className={FIELD} />
            </label>
          </div>
          <label className="block space-y-1 text-sm font-semibold">Official notice or application website (optional)
            <input type="url" maxLength={1000} value={form.officialUrl} onChange={e => setField('officialUrl', e.target.value)} className={FIELD} placeholder="https://ssc.gov.in/" />
            <span className="block text-xs font-normal text-muted-foreground">Only supported verified HTTPS government/IBPS domains are accepted. Leave blank for other authorities.</span>
          </label>
          <label className="block space-y-1 text-sm font-semibold">Application / registration reference (optional)
            <input type="text" autoComplete="off" maxLength={80} value={form.reference} onChange={e => setField('reference', e.target.value)} className={FIELD} placeholder={editingId ? 'Leave blank to keep stored reference' : 'Registration reference only'} />
            <span className="block text-xs font-normal text-muted-foreground">Encrypted on the API. Masked in your list; reveal explicitly when needed. Do not enter Aadhaar or credentials.</span>
          </label>
          {editingId && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={clearReference} onChange={e => setClearReference(e.target.checked)} />
              Remove the saved reference number
            </label>
          )}
          <div className="flex flex-wrap gap-3">
            <button disabled={saving} type="submit" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> {saving ? 'Saving…' : 'Save privately'}
            </button>
            <button type="button" onClick={resetForm} className="min-h-11 rounded-xl border px-5 text-sm font-semibold">Cancel</button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-3">
        <label className="flex min-w-48 flex-1 items-center gap-2 rounded-xl border bg-card px-3">
          <span className="sr-only">Search saved applications</span>
          <input type="search" value={search} onChange={e => setSearch(e.target.value)} className="min-h-11 w-full bg-transparent text-sm outline-none" placeholder="Search my applications" />
        </label>
        <label className="sr-only" htmlFor="application-status">Filter manual tracking status</label>
        <select id="application-status" className="min-h-11 rounded-xl border bg-card px-3 text-sm" value={filter} onChange={e => setFilter(e.target.value as ApplicationStatus | 'all')}>
          <option value="all">All statuses</option>
          {STATUS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </div>
      {loading && <p role="status" className="text-sm text-muted-foreground">Loading your saved applications…</p>}
      {!loading && !visible.length && (
        <div className="rounded-2xl border border-dashed bg-muted/20 p-6 text-center">
          <BriefcaseBusiness className="mx-auto h-8 w-8 text-muted-foreground" />
          <h3 className="mt-3 text-lg font-bold">{applications.length ? 'No applications match these filters' : 'No saved applications yet'}</h3>
          <p className="mt-2 text-sm text-muted-foreground">Apply through the official website, then return here and record your details manually. You can also add an application from an earlier recruitment.</p>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {visible.map(item => (
          <article key={item.id} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">{STATUS.find(value => value.id === item.status)?.label || 'Manual status'}</span>
              <span className="text-xs text-muted-foreground">{item.category}</span>
            </div>
            <h3 className="mt-3 text-lg font-bold">{item.title}</h3>
            <p className="text-sm text-muted-foreground">{item.organisation}</p>
            <div className="mt-4 space-y-1 text-sm">
              <p>Applied on: <span className="font-medium">{showDate(item.applicationDate)}</span></p>
              <p>Deadline: <span className="font-medium">{showDate(item.deadline)}</span></p>
              <p className="break-all">Reference: <span className="font-mono">{reveal?.id === item.id ? reveal.value || 'Not saved' : item.referenceMasked || 'Not saved'}</span></p>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Self-reported. Not verified against the government application system.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {item.officialUrl && <a href={item.officialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-muted">
                Official source <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>}
              {item.referenceMasked && <button type="button" onClick={() => void revealReference(item)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-muted">
                {reveal?.id === item.id ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {reveal?.id === item.id ? 'Hide reference' : 'Reveal reference'}
              </button>}
              <button type="button" onClick={() => edit(item)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-muted"><Pencil className="h-4 w-4" /> Edit</button>
              <button type="button" onClick={() => void deleteOne(item)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 dark:text-red-300"><Trash2 className="h-4 w-4" /> Delete</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
