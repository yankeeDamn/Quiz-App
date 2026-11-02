'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDownToLine, ArrowUpRight, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Clock3, Copy, Crown, Eye, FileClock, FileQuestion, LayoutGrid, List, LoaderCircle, MoreHorizontal, Pencil, Plus, RefreshCw, Rocket, Search, ShieldCheck, SlidersHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { type AdminTest } from '@/lib/admin';
import { copyUrl } from '@/lib/mobile-share';
import { Field, card, input } from './ui';

export const mockQuestionCount = (t: AdminTest) => t.configuredQuestionCount ?? t.sections.reduce((n, s) => n + s.parts.reduce((m, p) => m + (p.to - p.from), 0), 0);
const statusOf = (t: AdminTest) => t.liveInCatalogue ? 'live' : t.active ? 'blocked' : 'draft';
const statusLabel = (t: AdminTest) => t.liveInCatalogue ? 'Published · Live' : t.active ? 'Active · Hidden' : 'Draft · Hidden';
// Spreadsheet cells must stay text even when an administrator-entered name starts with a formula.
const csvCell = (value: unknown) => `"${String(value ?? '').replace(/^[\s]*[=+@-]/, "'$&").replaceAll('"', '""')}"`;

interface Props {
  tests: AdminTest[]; hiddenOnly: boolean; busy: boolean; loading: boolean; draftTestingEnabled: boolean; initialSearch: string;
  onCreate: () => void; onRefresh: () => void; onCheckDrafts: () => void;
  onReadiness: (t: AdminTest) => void; onQuestions?: (t: AdminTest) => void;
  onPreview: (t: AdminTest) => void; onEdit: (t: AdminTest) => void;
  onTier: (t: AdminTest) => void; onPublish: (t: AdminTest) => void;
  onDuplicate: (t: AdminTest) => void; onDelete: (t: AdminTest) => void;
  onRelease: (t: AdminTest) => void; onAcademic: (t: AdminTest) => void;
}

export function MockManager(props: Props) {
  const {tests, hiddenOnly, busy, loading, draftTestingEnabled} = props;
  const [search, setSearch] = useState(props.initialSearch), [category, setCategory] = useState('all');
  const [tier, setTier] = useState('all'), [status, setStatus] = useState('all'), [sort, setSort] = useState('name');
  const [layout, setLayout] = useState<'list' | 'cards'>('list'), [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10), [feedback, setFeedback] = useState('');
  const base = useMemo(() => tests.filter(t => !hiddenOnly || !t.liveInCatalogue), [tests, hiddenOnly]);
  const filtered = useMemo(() => base.filter(t =>
    (category === 'all' || t.exam === category) && (tier === 'all' || t.tier === tier) &&
    (status === 'all' || statusOf(t) === status) && `${t.name} ${t.id} ${t.exam}`.toLowerCase().includes(search.trim().toLowerCase())
  ).sort((a, b) => (sort === 'questions' ? mockQuestionCount(b) - mockQuestionCount(a) : sort === 'duration' ? b.minutes - a.minutes : a.name.localeCompare(b.name)) || a.id.localeCompare(b.id)), [base, category, tier, status, search, sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize)), currentPage = Math.min(page, pages);
  const shown = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const reset = () => {setSearch(''); setCategory('all'); setTier('all'); setStatus('all'); setPage(1);};
  const hasFilters = Boolean(search || category !== 'all' || tier !== 'all' || status !== 'all');
  const updateFilter = (set: (value: string) => void, value: string) => {set(value); setPage(1);};
  const exportCsv = () => {
    const rows: unknown[][] = [['ID','Test name','Category','Tier','Status','Configured questions','Accessible questions','Minutes','Section timer minutes'], ...filtered.map(t => [t.id,t.name,t.exam,t.tier === 'free' ? 'Free' : 'Pro',statusLabel(t),mockQuestionCount(t),t.questionCount ?? 0,t.minutes,t.sectionTimingMinutes ?? ''])];
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')], {type:'text/csv;charset=utf-8'}));
    const link = document.createElement('a'); link.href = url; link.download = 'exampro-mock-catalogue.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setFeedback(`Exported ${filtered.length} matching mock definitions. Question content and answer keys are excluded.`);
  };
  const copyLink = async (t: AdminTest) => {
    const ok = await copyUrl(new URL(`/india-mocks/${encodeURIComponent(t.id)}?mode=test`, window.location.origin).href);
    setFeedback(ok ? `Student link copied for ${t.name}.` : 'Could not copy the link. Open the live test and copy its address.');
  };
  const summary = [
    {id:'all',label:'All definitions',count:base.length,icon:FileQuestion,style:'text-indigo-600 dark:text-indigo-300'},
    {id:'live',label:'Live mocks',count:base.filter(t=>statusOf(t)==='live').length,icon:CheckCircle2,style:'text-emerald-600 dark:text-emerald-300'},
    {id:'draft',label:'Drafts',count:base.filter(t=>statusOf(t)==='draft').length,icon:FileClock,style:'text-amber-600 dark:text-amber-300'},
    {id:'blocked',label:'Active but hidden',count:base.filter(t=>statusOf(t)==='blocked').length,icon:ShieldCheck,style:'text-orange-600 dark:text-orange-300'},
  ];
  const badge = (t: AdminTest) => <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${t.liveInCatalogue?'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200':'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'}`}><span className={`size-1.5 rounded-full ${t.liveInCatalogue?'bg-emerald-500':'bg-amber-500'}`}/>{statusLabel(t)}</span>;
  const access = (t: AdminTest) => <Button type="button" size="sm" variant="ghost" className={`min-h-11 rounded-full ${t.tier==='free'?'text-emerald-700 dark:text-emerald-300':'text-indigo-700 dark:text-indigo-300'}`} disabled={busy||loading} onClick={()=>props.onTier(t)} aria-label={`Change access for ${t.name}`} title="Change mock access; source question rules still apply">{t.tier==='free'?<CheckCircle2/>:<Crown/>}{t.tier==='free'?'Free':'Pro'}<Pencil className="!size-3"/></Button>;
  const actions = (t: AdminTest) => <div role="group" aria-label={`Actions for ${t.name}`} className="flex flex-wrap items-center gap-2">
    {t.liveInCatalogue ? <Button variant="outline" size="sm" className="min-h-11" asChild><Link href={`/india-mocks/${encodeURIComponent(t.id)}?mode=test`} target="_blank" rel="noopener noreferrer"><ArrowUpRight/>View live test</Link></Button> : <Button variant="default" size="sm" className="min-h-11" disabled={busy||loading} onClick={()=>props.onReadiness(t)}><ClipboardCheck/>Check readiness</Button>}
    <Button variant="outline" size="sm" className="min-h-11" disabled={busy||loading||!props.onQuestions||!t.sections[0]?.parts[0]?.topic} onClick={()=>props.onQuestions?.(t)}><ShieldCheck/>Review questions</Button>
    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="size-11" disabled={busy||loading} aria-label={`More actions for ${t.name}`}><MoreHorizontal/></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2">
        <DropdownMenuItem className="min-h-11" onClick={()=>props.onEdit(t)}><Pencil/>Edit mock settings</DropdownMenuItem>
        <DropdownMenuItem className="min-h-11" onClick={()=>props.onPreview(t)}><Eye/>Preview questions</DropdownMenuItem>
        {!t.active&&draftTestingEnabled&&<DropdownMenuItem className="min-h-11" render={<Link href={`/admin/draft-test/${encodeURIComponent(t.id)}`}/>}><Clock3/>Test draft privately</DropdownMenuItem>}
        <DropdownMenuItem className="min-h-11" onClick={()=>props.onReadiness(t)}><ClipboardCheck/>Publication checklist</DropdownMenuItem>
        {t.liveInCatalogue&&<DropdownMenuItem className="min-h-11" onClick={()=>void copyLink(t)}><Copy/>Copy student link</DropdownMenuItem>}
        <DropdownMenuItem className="min-h-11" onClick={()=>props.onDuplicate(t)}><Copy/>Duplicate as a draft</DropdownMenuItem>
        {mockQuestionCount(t)===100&&/ssc/i.test(t.exam)&&/cgl/i.test(t.name)&&<><DropdownMenuSeparator/><DropdownMenuItem className="min-h-11" onClick={()=>props.onRelease(t)}><ClipboardCheck/>SSC release report</DropdownMenuItem><DropdownMenuItem className="min-h-11" onClick={()=>props.onAcademic(t)}><ShieldCheck/>Academic / Hindi review</DropdownMenuItem></>}
        <DropdownMenuSeparator/>
        <DropdownMenuItem className="min-h-11" onClick={()=>props.onPublish(t)}><Rocket/>{t.active?'Unpublish mock':'Publish mock'}</DropdownMenuItem>
        <DropdownMenuItem className="min-h-11" variant="destructive" disabled={t.active} onClick={()=>props.onDelete(t)}><Trash2/>Delete unused draft</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>;
  const format = (t: AdminTest) => <div className="space-y-1 text-xs text-muted-foreground"><p className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="inline-flex items-center gap-1"><FileQuestion className="size-3.5"/>{mockQuestionCount(t)} questions</span><span className="inline-flex items-center gap-1"><Clock3 className="size-3.5"/>{t.minutes} min</span></p><p>{t.questionCount??0} accessible · {t.sectionTimingMinutes?`${t.sectionTimingMinutes}m section locks`:'Standard timer'}</p></div>;

  return <section className={`${card} space-y-5`} aria-label="Mock definitions manager" aria-busy={loading}>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-300">Catalogue workspace</p><h2 className="mt-1 text-xl font-bold">Mocks &amp; Tests Manager</h2><p className="mt-2 max-w-xl text-sm text-muted-foreground">Review the questions, check readiness, then publish. Live mocks open exactly as learners see them.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" className="min-h-11" disabled={busy||loading} onClick={props.onCheckDrafts}><ClipboardCheck/>Check ready drafts</Button><Button className="min-h-11" disabled={busy||loading} onClick={props.onCreate}><Plus/>Create mock</Button></div></div>
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" role="group" aria-label="Filter mocks by publication status">{summary.map(({id,label,count,icon:Icon,style})=><button key={id} type="button" aria-pressed={status===id} onClick={()=>updateFilter(setStatus,id)} className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${status===id?'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30':'bg-muted/20 hover:bg-muted/50'}`}><span className={`rounded-lg bg-background p-2 ${style}`}><Icon className="size-4"/></span><span className="min-w-0"><span className="block text-xl font-bold tabular-nums">{loading?'—':count}</span><span className="block text-xs text-muted-foreground">{label}</span></span></button>)}</div>
    {draftTestingEnabled&&<details className="rounded-xl border border-amber-300 bg-amber-50/50 text-xs dark:border-amber-800 dark:bg-amber-950/20"><summary className="min-h-11 cursor-pointer px-4 py-3 font-semibold">Private draft testing is available · How publishing works</summary><p className="px-4 pb-4 leading-relaxed text-muted-foreground">Test draft starts a private, server-timed QA exam for verified staging admins. It does not publish anything. Review and publish each intended source question, activate ready topics, then use the publication checklist. Missing, retired or inaccessible questions can keep an active mock hidden.</p></details>}
    <div className="space-y-3 rounded-xl bg-muted/25 p-3">
      <div className="relative"><Search aria-hidden className="absolute left-3 top-3 size-4 text-muted-foreground"/><input className={`${input} pl-9`} aria-label="Search mock tests" placeholder="Search by name, ID or exam…" value={search} onChange={e=>updateFilter(setSearch,e.target.value)}/></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Field label="Category"><select className={input} aria-label="Filter mock test category" value={category} onChange={e=>updateFilter(setCategory,e.target.value)}><option value="all">All categories</option>{[...new Set(tests.map(t=>t.exam))].sort().map(exam=><option key={exam}>{exam}</option>)}</select></Field><Field label="Access"><select className={input} aria-label="Filter mock tier" value={tier} onChange={e=>updateFilter(setTier,e.target.value)}><option value="all">Free &amp; Pro</option><option value="free">Free only</option><option value="premium">Pro only</option></select></Field><Field label="Publication"><select className={input} aria-label="Filter mock status" value={status} onChange={e=>updateFilter(setStatus,e.target.value)}><option value="all">All statuses</option><option value="live">Published · Live</option><option value="draft">Draft · Hidden</option><option value="blocked">Active · Hidden</option></select></Field><Field label="Sort by"><select className={input} aria-label="Sort mock tests" value={sort} onChange={e=>updateFilter(setSort,e.target.value)}><option value="name">Name A–Z</option><option value="questions">Most questions</option><option value="duration">Longest duration</option></select></Field></div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-sm text-muted-foreground"><span>{loading?'Loading mock definitions…':`${filtered.length} of ${base.length} definitions`}</span>{hasFilters&&<button className="ml-2 min-h-11 font-semibold text-primary underline underline-offset-4" onClick={reset}>Clear filters</button>}</p><div className="flex flex-wrap items-center gap-2"><div className="hidden rounded-lg border p-1 xl:flex" role="group" aria-label="Mock layout"><Button size="icon" variant={layout==='list'?'secondary':'ghost'} aria-label="List layout" aria-pressed={layout==='list'} onClick={()=>setLayout('list')}><List/></Button><Button size="icon" variant={layout==='cards'?'secondary':'ghost'} aria-label="Card layout" aria-pressed={layout==='cards'} onClick={()=>setLayout('cards')}><LayoutGrid/></Button></div><Button variant="outline" className="min-h-11" disabled={busy||loading} onClick={props.onRefresh}><RefreshCw className={loading?'animate-spin':''}/>Refresh</Button><Button variant="outline" className="min-h-11" disabled={loading||!filtered.length} onClick={exportCsv}><ArrowDownToLine/>Export CSV</Button></div></div>
    {feedback&&<p role="status" className="rounded-lg bg-muted/50 px-3 py-2 text-sm">{feedback}</p>}
    {loading&&tests.length===0?<div className="flex min-h-40 items-center justify-center gap-2 text-muted-foreground"><LoaderCircle className="size-5 animate-spin"/>Loading tests…</div>:shown.length===0?<div className="grid justify-items-center gap-3 rounded-2xl border border-dashed px-4 py-12 text-center"><SlidersHorizontal className="size-7 text-muted-foreground"/><h3 className="font-semibold">{hasFilters?'No mocks match these filters':'No mock definitions yet'}</h3><p className="max-w-md text-sm text-muted-foreground">{hasFilters?'Try another category, tier or publication status.':'Create a draft to configure sections, questions and access. Check any API error before creating a duplicate.'}</p>{hasFilters&&<Button variant="outline" onClick={reset}>Clear filters</Button>}</div>:<>
      <div className={layout==='cards'?'hidden':'hidden overflow-x-auto rounded-xl border xl:block'}><table className="w-full text-left text-sm"><thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground"><tr><th className="p-4">Test &amp; exam</th><th className="p-4">Format &amp; access</th><th className="p-4">Publication</th><th className="p-4">Actions</th></tr></thead><tbody>{shown.map(t=><tr key={t.id} className="border-t align-top transition-colors hover:bg-muted/15"><td className="max-w-72 p-4"><h3 className="font-semibold leading-relaxed">{t.name}</h3><p className="mt-1 text-xs text-muted-foreground">{t.exam} · {t.id}</p></td><td className="p-4">{format(t)}{access(t)}</td><td className="max-w-52 p-4">{badge(t)}{t.hiddenReason&&<p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t.hiddenReason}</p>}</td><td className="w-80 p-4">{actions(t)}</td></tr>)}</tbody></table></div>
      <div className={layout==='cards'?'grid gap-4 md:grid-cols-2 2xl:grid-cols-3':'grid gap-4 md:grid-cols-2 xl:hidden'}>{shown.map(t=><article key={t.id} aria-label={`Mock ${t.name}`} className="flex min-w-0 flex-col rounded-2xl border bg-background p-4 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2">{badge(t)}{access(t)}</div><h3 className="mt-3 font-semibold leading-relaxed">{t.name}</h3><p className="mb-4 mt-1 text-xs text-muted-foreground">{t.exam} · {t.id}</p>{format(t)}{t.hiddenReason&&<p className="mt-3 rounded-lg bg-muted/40 p-2.5 text-xs leading-relaxed text-muted-foreground">{t.hiddenReason}</p>}<div className="mt-auto pt-4">{actions(t)}</div></article>)}</div>
    </>}
    {filtered.length>0&&<nav aria-label="Mock list pagination" className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><label className="flex items-center gap-2 text-xs text-muted-foreground">Per page<select className={`${input} !w-auto`} aria-label="Mocks per page" value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1);}}>{[10,20,50].map(n=><option key={n}>{n}</option>)}</select></label><div className="flex items-center gap-2"><p className="mr-1 text-xs text-muted-foreground">{(currentPage-1)*pageSize+1}–{Math.min(currentPage*pageSize,filtered.length)} of {filtered.length}</p><Button variant="outline" size="icon" className="size-11" aria-label="Previous mock page" disabled={currentPage===1||loading} onClick={()=>setPage(currentPage-1)}><ChevronLeft/></Button><Button variant="outline" size="icon" className="size-11" aria-label="Next mock page" disabled={currentPage===pages||loading} onClick={()=>setPage(currentPage+1)}><ChevronRight/></Button></div></nav>}
  </section>;
}
