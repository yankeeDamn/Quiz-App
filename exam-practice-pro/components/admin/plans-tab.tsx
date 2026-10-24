'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { admin, type AdminGrant, type AdminUser } from '@/lib/admin';
import { Field, Notice, card, input } from '@/components/admin/ui';

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '–');

export function PlansTab() {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [grants, setGrants] = useState<AdminGrant[]>([]);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({ email: '', plan: 'pro', months: '1', amountInr: '', note: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (term: string) => {
    const [u, g] = await Promise.all([
      admin<{ users: AdminUser[] }>(`/users?q=${encodeURIComponent(term)}`),
      admin<{ grants: AdminGrant[] }>('/grants'),
    ]);
    if (u.ok) setUsers(u.data.users);
    if (g.ok) setGrants(g.data.grants);
    if (!u.ok) setMsg({ kind: 'error', text: u.message });
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void load(q), 250);
    return () => window.clearTimeout(t);
  }, [q, load]);

  const grant = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await admin<{ email: string; planExpiresAt: string }>('/grant', 'POST', {
      email: form.email.trim(),
      plan: form.plan,
      months: Number(form.months),
      amountInr: form.amountInr ? Number(form.amountInr) : undefined,
      note: form.note || undefined,
    });
    setBusy(false);
    if (r.ok) {
      setMsg({ kind: 'ok', text: `Unlocked ${r.data.email} until ${fmt(r.data.planExpiresAt)}. Tell them on WhatsApp.` });
      setForm({ ...form, email: '', amountInr: '', note: '' });
      void load(q);
    } else setMsg({ kind: 'error', text: r.message });
  };

  const revoke = async (email: string) => {
    if (!window.confirm(`End the plan for ${email} now?`)) return;
    const r = await admin('/revoke', 'POST', { email });
    setMsg(r.ok ? { kind: 'ok', text: `Plan ended for ${email}.` } : { kind: 'error', text: r.message });
    void load(q);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <form onSubmit={grant} className={`${card} grid h-fit gap-3`}>
        <h2 className="text-lg font-bold">Unlock a plan</h2>
        <p className="text-sm text-muted-foreground">Use after the payment arrives on WhatsApp. Renewals add to the current end date.</p>
        <Field label="Email the person signs in with">
          <input className={input} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Plan">
            <select className={input} value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
              <option value="pro">Pro</option>
              <option value="institute">Institute</option>
            </select>
          </Field>
          <Field label="Months">
            <input className={input} type="number" min={1} max={36} required value={form.months} onChange={(e) => setForm({ ...form, months: e.target.value })} />
          </Field>
        </div>
        <Field label="Amount received (₹)" hint="Optional. Saved in the record.">
          <input className={input} type="number" min={0} value={form.amountInr} onChange={(e) => setForm({ ...form, amountInr: e.target.value })} />
        </Field>
        <Field label="Note" hint="For example the UPI reference.">
          <input className={input} maxLength={255} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </Field>
        <Button type="submit" disabled={busy}>{busy ? 'Unlocking…' : 'Unlock plan'}</Button>
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      </form>

      <div className="grid min-w-0 gap-6">
        <section className={card}>
          <h2 className="text-lg font-bold">Find a user</h2>
          <input className={`${input} mt-3`} placeholder="Search by email" aria-label="Search users by email" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-muted-foreground"><th className="py-1 pr-3">Email</th><th className="pr-3">Plan</th><th className="pr-3">Ends</th><th /></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.email} className="border-t">
                    <td className="py-2 pr-3 break-all">{u.email}</td>
                    <td className="pr-3">{u.planActive ? u.plan : 'free'}</td>
                    <td className="pr-3 whitespace-nowrap">{u.planActive ? fmt(u.plan_expires_at) : '–'}</td>
                    <td className="whitespace-nowrap text-right">
                      <button className="mr-2 underline" onClick={() => setForm({ ...form, email: u.email })}>Unlock</button>
                      {u.planActive && <button className="text-red-600 underline" onClick={() => void revoke(u.email)}>End plan</button>}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && <tr><td colSpan={4} className="py-3 text-muted-foreground">No users found. People appear here after they sign in once.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className={card}>
          <h2 className="text-lg font-bold">Recent unlocks</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-muted-foreground"><th className="py-1 pr-3">When</th><th className="pr-3">Email</th><th className="pr-3">Plan</th><th className="pr-3">Months</th><th className="pr-3">₹</th><th>Note</th></tr></thead>
              <tbody>
                {grants.map((g, i) => (
                  <tr key={i} className="border-t">
                    <td className="py-2 pr-3 whitespace-nowrap">{fmt(g.granted_at)}</td>
                    <td className="pr-3 break-all">{g.email}</td>
                    <td className="pr-3">{g.plan}</td>
                    <td className="pr-3">{g.months}</td>
                    <td className="pr-3">{g.amount_inr ?? '–'}</td>
                    <td className="break-words">{g.note ?? ''}</td>
                  </tr>
                ))}
                {grants.length === 0 && <tr><td colSpan={6} className="py-3 text-muted-foreground">Nothing unlocked yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
