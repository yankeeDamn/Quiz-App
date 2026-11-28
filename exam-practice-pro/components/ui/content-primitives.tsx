'use client';

import { useId, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Check, ChevronRight, FileUp, Inbox, X } from 'lucide-react';
import { validatePdfSelection } from '@/lib/file-selection';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Textarea } from './textarea';
import { LessonMarkdown } from '@/components/certifications/lesson-content';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('ep-skeleton rounded-lg', className)} />;
}

export type ContentStatus = 'draft' | 'in_review' | 'scheduled' | 'published' | 'archived' | 'needs_fixes';
const statusStyles: Record<ContentStatus, string> = {
  draft: 'text-muted-foreground bg-muted', in_review: 'text-info bg-info/10',
  scheduled: 'text-info bg-info/10', published: 'text-success bg-success/10',
  archived: 'text-muted-foreground bg-muted', needs_fixes: 'text-warning bg-warning/10',
};
const statusLabels: Record<ContentStatus, string> = {
  draft: 'Draft', in_review: 'In review', scheduled: 'Scheduled', published: 'Published', archived: 'Archived', needs_fixes: 'Needs fixes',
};
export function StatusPill({ status }: { status: ContentStatus }) {
  return <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold', statusStyles[status])}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{statusLabels[status]}</span>;
}
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="grid justify-items-center gap-3 rounded-xl border border-dashed p-8 text-center"><Inbox aria-hidden="true" className="size-8 text-muted-foreground" /><h3 className="font-bold">{title}</h3><p className="max-w-md text-sm text-muted-foreground">{description}</p>{action}</div>;
}
export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return <nav aria-label="Breadcrumb"><ol className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">{items.map((item, i) => <li key={item.label} className="flex items-center gap-2">{i > 0 && <ChevronRight aria-hidden="true" className="size-3" />}{item.href && i < items.length - 1 ? <Link className="rounded underline-offset-4 hover:underline" href={item.href}>{item.label}</Link> : <span aria-current={i === items.length - 1 ? 'page' : undefined}>{item.label}</span>}</li>)}</ol></nav>;
}
export function Stepper({ steps, current, onChange }: { steps: string[]; current: number; onChange?: (index: number) => void }) {
  return <ol aria-label="Editor steps" className="flex flex-wrap gap-3">{steps.map((label, i) => <li key={label}><button type="button" disabled={!onChange} onClick={() => onChange?.(i)} aria-current={current === i ? 'step' : undefined} className={cn('flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm', current === i ? 'border-accent-ink bg-accent-soft text-accent-ink' : 'bg-card text-muted-foreground')}><span className="flex size-6 items-center justify-center rounded-full border font-mono text-xs">{i < current ? <Check aria-label="Completed" className="size-3" /> : i + 1}</span>{label}</button></li>)}</ol>;
}
export function Toast({ children, onDismiss, action }: { children: ReactNode; onDismiss: () => void; action?: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-popover p-4 text-popover-foreground"><p role="status" className="flex-1 text-sm">{children}</p>{action}<Button aria-label="Dismiss notification" size="icon" variant="ghost" onClick={onDismiss}><X /></Button></div>;
}

export type TableColumn<T> = { key: string; label: string; value: (row: T) => string | number; render?: (row: T) => ReactNode };
export function DataTable<T extends { id: string }>({ rows, columns, caption, selected, onSelectionChange }: { rows: T[]; columns: TableColumn<T>[]; caption: string; selected: string[]; onSelectionChange: (ids: string[]) => void }) {
  const [sort, setSort] = useState<{ key: string; direction: 1 | -1 }>({ key: '', direction: 1 });
  const [compact, setCompact] = useState(false);
  const sorted = useMemo(() => {
    const column = columns.find(c => c.key === sort.key);
    if (!column) return rows;
    return [...rows].sort((a, b) => {
      const av = column.value(a), bv = column.value(b);
      return sort.direction * (typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true }));
    });
  }, [rows, columns, sort]);
  const all = rows.length > 0 && rows.every(row => selected.includes(row.id));
  const some = !all && rows.some(row => selected.includes(row.id));
  const selectAll = (input: HTMLInputElement | null) => { if (input) input.indeterminate = some; };
  const toggle = (id: string) => onSelectionChange(selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id]);
  return <div className="space-y-3"><div className="flex items-center justify-between gap-3"><p role="status" className="text-sm text-muted-foreground">{selected.filter(id => rows.some(row => row.id === id)).length} selected</p><Button variant="outline" size="sm" aria-pressed={compact} onClick={() => setCompact(!compact)}>Compact rows</Button></div><div className="max-h-80 overflow-auto rounded-xl border"><table className="ep-table w-full text-left text-sm" data-density={compact ? 'compact' : 'comfortable'}><caption className="sr-only">{caption}</caption><thead><tr><th scope="col" className="w-12 p-3"><input ref={selectAll} type="checkbox" aria-label="Select all visible rows" checked={all} disabled={!rows.length} onChange={() => onSelectionChange(all ? selected.filter(id => !rows.some(row => row.id === id)) : [...new Set([...selected, ...rows.map(row => row.id)])])} /></th>{columns.map(column => <th key={column.key} scope="col" className="p-3" aria-sort={sort.key === column.key ? sort.direction === 1 ? 'ascending' : 'descending' : 'none'}><button type="button" className="min-h-9 rounded px-1 font-semibold" onClick={() => setSort({ key: column.key, direction: sort.key === column.key && sort.direction === 1 ? -1 : 1 })}>{column.label} <span aria-hidden="true">{sort.key === column.key ? sort.direction === 1 ? '↑' : '↓' : '↕'}</span></button></th>)}</tr></thead><tbody>{sorted.map(row => <tr key={row.id} className={cn('border-t hover:bg-muted', selected.includes(row.id) && 'bg-accent-soft')}><td className="p-3"><input type="checkbox" aria-label={`Select ${columns[0]?.value(row) ?? row.id}`} checked={selected.includes(row.id)} onChange={() => toggle(row.id)} /></td>{columns.map(column => <td key={column.key} className="p-3">{column.render?.(row) ?? column.value(row)}</td>)}</tr>)}{!rows.length && <tr><td colSpan={columns.length + 1} className="p-6 text-center text-muted-foreground">No matching items.</td></tr>}</tbody></table></div></div>;
}

export function FileDropzone({ onFiles, maxBytes = 3 * 1024 * 1024 }: { onFiles: (files: File[]) => void; maxBytes?: number }) {
  const id = useId(), input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false), [error, setError] = useState('');
  function accept(files: File[]) {
    const invalid = validatePdfSelection(files, maxBytes);
    if (invalid) { setError(invalid); return; }
    setError(''); onFiles(files);
  }
  return <div><div className="ep-dropzone grid justify-items-center gap-3 p-6 text-center" data-dragging={dragging} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); accept(Array.from(event.dataTransfer.files)); }}><FileUp className="size-7 text-accent-ink" aria-hidden="true" /><p className="text-sm">Drop PDF files here</p><Button type="button" variant="outline" onClick={() => input.current?.click()}>Choose PDF files</Button><input ref={input} className="sr-only" tabIndex={-1} type="file" multiple accept=".pdf,application/pdf" aria-label="PDF files" aria-describedby={id} onChange={event => { accept(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = ''; }} /><p id={id} className="text-xs text-muted-foreground">Up to 20 files, {maxBytes / 1024 / 1024} MiB each</p></div>{error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}</div>;
}
export function MarkdownEditor({ value, onChange, label = 'Lesson content' }: { value: string; onChange: (value: string) => void; label?: string }) {
  const id = useId();
  return <div className="grid gap-4 lg:grid-cols-2"><div><label htmlFor={id} className="mb-2 block text-sm font-semibold">{label}</label><Textarea id={id} className="ep-editor" value={value} onChange={event => onChange(event.target.value)} /></div><section aria-label="Student content preview" className="rounded-xl border bg-card p-4"><h3 className="mb-3 text-sm font-semibold text-muted-foreground">Preview</h3><LessonMarkdown content={value} /></section></div>;
}
