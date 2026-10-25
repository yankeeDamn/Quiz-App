'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Building2, ClipboardList, GraduationCap, BarChart3, CreditCard, Download, Upload, ShieldAlert, CheckCircle2 } from 'lucide-react';
import starterQuestions from '@/data/it-certification-questions.json';

const columns = ['id','exam_code','subject','topic','difficulty','question_type','question','option_a','option_b','option_c','option_d','correct_option','explanation','language','source_type','review_status'];
const tracks = [
  { code: 'AZ-900', title: 'Microsoft Azure Fundamentals', slug: 'az-900' },
  { code: 'AWS-CLF-C02', title: 'AWS Cloud Practitioner', slug: 'aws-cloud-practitioner' },
  { code: 'CompTIA-A+', title: 'CompTIA A+', slug: 'comptia-a-plus' },
];

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else if (!quoted && field === '') quoted = true;
      else if (quoted) quoted = false;
      else throw new Error('Unexpected quotation mark in CSV');
    } else if (c === ',' && !quoted) { row.push(field); field = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(v => v.trim())) rows.push(row);
      row = [];
    } else field += c;
  }
  if (quoted) throw new Error('Unclosed quotation mark in CSV');
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

type Preview = { count: number; tracks: string[]; errors: string[] };
const demoCards = [
  { title: 'Question Bank', detail: 'Review starter questions and validate CSV files', icon: BookOpen, state: 'Preview ready' },
  { title: 'Exam Builder', detail: 'Timed exams and question selection', icon: ClipboardList, state: 'Backend pending' },
  { title: 'Students & Batches', detail: 'Invite learners and assign tests', icon: GraduationCap, state: 'Backend pending' },
  { title: 'Results & Rankings', detail: 'Scores, leaderboards and topic insights', icon: BarChart3, state: 'Backend pending' },
  { title: 'Institute Branding', detail: 'Institute logo, colors and custom domain', icon: Building2, state: 'Backend pending' },
  { title: 'Subscriptions', detail: 'Plan limits, invoices and payments', icon: CreditCard, state: 'Backend pending' },
];

export default function InstituteAdminPreview() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const counts = useMemo(() => tracks.map(track => ({
    ...track, count: starterQuestions.filter(q => q.exam_code === track.code).length,
  })), []);

  function downloadTemplate() {
    const example = ['EXAMPLE-001','AZ-900','Cloud Concepts','Shared responsibility','Easy','single','Which model offers virtual machines?','IaaS','PaaS','SaaS','None','A','IaaS offers virtual machines.','en','original','needs_review'];
    const csv = [columns, example].map(row => row.map(value => '"' + value.replaceAll('"', '""') + '"').join(',')).join('\r\n') + '\r\n';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'exampro-question-template.csv'; anchor.click();
    URL.revokeObjectURL(url);
  }

  async function inspectFile(file?: File) {
    if (!file) return;
    setBusy(true); setPreview(null);
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('CSV exceeds 2 MB preview limit');
      const rows = parseCsv((await file.text()).replace(/^\uFEFF/, ''));
      if (!rows.length || rows[0].join('|') !== columns.join('|')) throw new Error('CSV headers do not match the required template');
      const errors: string[] = [], ids = new Set<string>(), exams = new Set<string>();
      rows.slice(1).forEach((row, index) => {
        const line = index + 2;
        if (row.length !== columns.length) { errors.push(`Line ${line}: expected ${columns.length} columns`); return; }
        const item = Object.fromEntries(columns.map((key, i) => [key, row[i].trim()]));
        if (columns.some(key => !item[key])) errors.push(`Line ${line}: missing required field`);
        if (ids.has(item.id)) errors.push(`Line ${line}: duplicate question ID`);
        ids.add(item.id); exams.add(item.exam_code);
        if (!['A','B','C','D'].includes(item.correct_option)) errors.push(`Line ${line}: correct option must be A–D`);
        if (!['Easy','Medium','Hard'].includes(item.difficulty)) errors.push(`Line ${line}: invalid difficulty`);
        if (item.question_type !== 'single') errors.push(`Line ${line}: only single-choice questions supported`);
        if (!['original','licensed','institute_owned'].includes(item.source_type)) errors.push(`Line ${line}: invalid source type`);
        if (!['needs_review','approved','rejected'].includes(item.review_status)) errors.push(`Line ${line}: invalid review status`);
        if (new Set(['option_a','option_b','option_c','option_d'].map(k => item[k].toLowerCase())).size !== 4) errors.push(`Line ${line}: duplicate answer options`);
      });
      if (rows.length < 2) errors.push('No questions in file');
      setPreview({ count: rows.length - 1, tracks: [...exams].filter(Boolean), errors: errors.slice(0, 15) });
    } catch (error) {
      setPreview({ count: 0, tracks: [], errors: [error instanceof Error ? error.message : 'Could not read CSV'] });
    } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="text-sm font-semibold text-blue-700 dark:text-blue-400">← Back to ExamPro</Link>
          <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">DEMO PREVIEW · NOT AN ADMIN LOGIN</span>
        </div>
        <div className="mb-8">
          <p className="mb-2 text-sm font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">ExamPro · Institute workspace</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Institute Admin Dashboard</h1>
          <p className="mt-3 max-w-3xl text-slate-600 dark:text-zinc-400">A preview of the tools coaching institutes will use to manage IT certification exams. No accounts, uploads, or payments are created on this page.</p>
        </div>
        <div role="note" className="mb-8 flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          <ShieldAlert className="h-5 w-5 shrink-0" />
          <p><strong>Security notice:</strong> This is a public demonstration. CSV files are inspected only in your browser; nothing is uploaded or saved. Real institute access will require authenticated backend authorization and PostgreSQL.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {demoCards.map(({ title, detail, icon: Icon, state }) => (
            <section key={title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <Icon className="mb-4 h-7 w-7 text-blue-600" />
              <h2 className="text-lg font-bold">{title}</h2>
              <p className="mt-2 min-h-12 text-sm text-slate-600 dark:text-zinc-400">{detail}</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">{state}</p>
            </section>
          ))}
        </div>
        <section className="mt-10 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-xl font-bold">IT certification starter bank</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">Original sample questions from GitHub, awaiting subject-matter review. These are not institute-owned database records.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {counts.map(track => (
              <Link key={track.code} href={`/india-mocks/${track.slug}`} className="rounded-lg border border-slate-200 p-4 hover:border-blue-500 dark:border-zinc-700">
                <p className="font-semibold">{track.title}</p><p className="mt-1 text-sm text-slate-500">{track.count} practice questions · View practice →</p>
              </Link>
            ))}
          </div>
        </section>
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-xl font-bold">Prepare a question upload</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-zinc-400">Download the CSV template, fill in your own licensed or original questions, then check the structure here before the secure import API is ready.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={downloadTemplate} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"><Download size={18}/> Download CSV template</button>
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 font-semibold hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
              <Upload size={18}/> {busy ? 'Checking…' : 'Validate CSV locally'}
              <input aria-label="Select CSV to validate locally" type="file" accept=".csv,text/csv" className="sr-only" onChange={e => { void inspectFile(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </div>
          {preview && <div role="status" className="mt-5 rounded-lg bg-slate-100 p-4 text-sm dark:bg-zinc-800">
            <p className="flex items-center gap-2 font-semibold">{preview.errors.length ? 'CSV needs corrections' : <><CheckCircle2 className="h-5 w-5 text-green-600"/> CSV structure looks valid</>}</p>
            <p className="mt-1">{preview.count} rows · {preview.tracks.join(', ') || 'No certification tracks'}</p>
            {preview.errors.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5">{preview.errors.map((error, i) => <li key={i}>{error}</li>)}</ul>}
            <p className="mt-2 text-slate-600 dark:text-zinc-400">Structural validation only. Answers and copyright permissions still require human review. No data was saved.</p>
          </div>}
        </section>
      </div>
    </main>
  );
}
