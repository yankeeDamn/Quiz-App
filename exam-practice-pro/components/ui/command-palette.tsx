'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Button } from './button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog';
import { Input } from './input';

export type CommandItem = { label: string; href: string; keywords?: string };
export function CommandPalette({ items, onSelect }: { items: CommandItem[]; onSelect?: (href: string) => void }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [index, setIndex] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null);
  const router = useRouter(), id = useId();
  const found = items.filter(item => `${item.label} ${item.keywords ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 20);
  const active = Math.min(index, found.length - 1);
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !event.isComposing) { event.preventDefault(); setOpen(value => !value); } };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, []);
  function select(href: string) { setOpen(false); setQuery(''); setIndex(0); if(onSelect) onSelect(href); else router.push(href); }
  return <><Button ref={trigger} variant="outline" onClick={() => setOpen(true)}><Search /> Search workspace <kbd className="ml-2 font-mono text-xs">Ctrl/⌘ K</kbd></Button><Dialog open={open} onOpenChange={value => { setOpen(value); if (!value) { setQuery(''); setIndex(0); } }}><DialogContent finalFocus={trigger} className="sm:max-w-xl"><DialogTitle>Search workspace</DialogTitle><DialogDescription>Find a workspace page. Use arrow keys and Enter to open it.</DialogDescription><Input aria-label="Search workspace pages" role="combobox" aria-expanded="true" aria-controls={id} aria-autocomplete="list" aria-activedescendant={active >= 0 ? `${id}-${active}` : undefined} value={query} onChange={event => { setQuery(event.target.value); setIndex(0); }} onKeyDown={event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setIndex(value => Math.max(0, Math.min(found.length - 1, value + (event.key === 'ArrowDown' ? 1 : -1)))); } else if (event.key === 'Enter' && found[active]) { event.preventDefault(); select(found[active].href); } }} /><ul id={id} role="listbox" aria-label="Matching pages" className="max-h-72 overflow-auto">{found.map((item, i) => <li key={item.href} id={`${id}-${i}`} role="option" aria-selected={active === i} className={active === i ? 'rounded-lg bg-accent-soft' : ''}><button type="button" tabIndex={-1} className="min-h-11 w-full rounded-lg px-3 text-left text-sm" onClick={() => select(item.href)}>{item.label}</button></li>)}</ul>{!found.length && <p role="status" className="text-sm text-muted-foreground">No matching pages. Try another search.</p>}</DialogContent></Dialog></>;
}
