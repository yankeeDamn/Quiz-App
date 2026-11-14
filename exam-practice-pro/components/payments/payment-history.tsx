'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { CheckCircle2, RefreshCw, ReceiptText } from 'lucide-react';
import { monetization, type PaymentOrder } from '@/lib/monetization';

const buttonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50';
const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '—';
function OrderReceipt({ order }: { order: PaymentOrder }) {
  return (
    <div className="space-y-4 rounded-2xl border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <ReceiptText className="h-5 w-5" aria-hidden="true" />
          {order.status === 'paid' ? 'Payment receipt' : 'Order details'}
        </h3>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${order.status === 'paid' ? 'bg-emerald-100 text-emerald-900' : 'bg-muted text-foreground'}`}
        >
          {order.status === 'paid' ? 'Verified success' : order.status}
        </span>
      </div>
      {order.mode === 'sandbox' && (
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
          Sandbox test order · no real payment
        </p>
      )}
      <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-[9rem_1fr]">
        <dt className="text-muted-foreground">Order ID</dt>
        <dd className="break-all font-mono">{order.orderId}</dd>
        <dt className="text-muted-foreground">Plan</dt>
        <dd>
          {order.plan} · {order.code}
        </dd>
        <dt className="text-muted-foreground">Amount</dt>
        <dd className="font-bold">
          ₹{order.amountInr} {order.currency}
        </dd>
        <dt className="text-muted-foreground">Order date</dt>
        <dd>{date(order.createdAt)}</dd>
        <dt className="text-muted-foreground">Payment verified</dt>
        <dd>{date(order.paidAt)}</dd>
        <dt className="text-muted-foreground">Access expiry</dt>
        <dd>{date(order.accessExpiresAt)}</dd>
        <dt className="text-muted-foreground">Purchase terms</dt>
        <dd>
          {order.validityDays} days · one-time prepaid · no automatic renewal
        </dd>
      </dl>
      <p className="text-xs text-muted-foreground">
        Your purchase confirmation. Contact support with the order ID for
        payment or invoice queries.
      </p>
    </div>
  );
}
export function PaymentReturn() {
  return (
    <Suspense fallback={<p role="status">Loading payment confirmation…</p>}>
      <PaymentReturnContent />
    </Suspense>
  );
}
function PaymentReturnContent() {
  const { data: session, status } = useSession();
  const orderId = useSearchParams().get('monetization_order') || '';
  return (
    <ReturnForAccount
      key={`${session?.user?.email || 'guest'}:${orderId}`}
      orderId={orderId}
      signedIn={!!session?.user?.email}
      loading={status === 'loading'}
    />
  );
}
function ReturnForAccount({
  orderId,
  signedIn,
  loading,
}: {
  orderId: string;
  signedIn: boolean;
  loading: boolean;
}) {
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!orderId || !signedIn) return;
    let active = true,
      timer: ReturnType<typeof setTimeout> | undefined,
      attempts = 0;
    async function check() {
      if (active) setBusy(true);
      const r = await monetization<PaymentOrder>(
        '/payments/orders/' + encodeURIComponent(orderId),
      );
      if (!active) return;
      setBusy(false);
      if (!r.success || !r.data) {
        setMessage(
          r.error?.message || 'Unable to verify payment. Recheck shortly.',
        );
        return;
      }
      setOrder(r.data);
      setMessage('');
      if (r.data.status === 'paid') {
        window.dispatchEvent(new Event('exampro:payment-verified'));
      } else if (r.data.status === 'pending' && ++attempts < 5) {
        timer = setTimeout(() => void check(), 4000);
      }
    }
    void check();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [orderId, signedIn, retry]);
  if (!orderId) return null;
  if (loading) return <p role="status">Checking your account…</p>;
  if (!signedIn)
    return (
      <p className="my-5 rounded-xl border p-4">
        <Link
          href={`/auth/signin?callbackUrl=${encodeURIComponent('/account/payments?monetization_order=' + orderId)}`}
          className="underline"
        >
          Sign in to verify your payment
        </Link>
      </p>
    );
  return (
    <section className="my-6 space-y-4" aria-label="Payment confirmation">
      <div
        role="status"
        aria-live="polite"
        className="space-y-3 rounded-2xl border bg-muted/40 p-4"
      >
        <h2 className="flex items-center gap-2 text-lg font-bold">
          {order?.status === 'paid' && (
            <CheckCircle2
              className="h-5 w-5 text-emerald-600"
              aria-hidden="true"
            />
          )}
          {order?.status === 'paid'
            ? 'Payment verified. Access was activated.'
            : busy
              ? 'Checking payment with Cashfree…'
              : 'Payment needs your attention'}
        </h2>
        {order?.status === 'pending' && (
          <p className="text-sm">
            Payment is pending verification. If money was debited, wait and
            recheck this order before paying again.
          </p>
        )}
        {order && ['failed', 'cancelled'].includes(order.status) && (
          <p className="text-sm">
            The latest payment attempt was {order.status}. Recheck first, then
            return to pricing to resume the same order safely.
          </p>
        )}
        {order && ['expired', 'terminated'].includes(order.status) && (
          <p className="text-sm">
            This order is closed. You may choose a plan again.
          </p>
        )}
        {message && <p className="text-sm">{message}</p>}
        {order?.status !== 'paid' && (
          <button
            className={buttonClass}
            disabled={busy}
            onClick={() => setRetry((n) => n + 1)}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {busy ? 'Checking…' : 'Recheck payment'}
          </button>
        )}
        <div className="flex flex-wrap gap-4 text-sm">
          <Link className="underline" href="/pricing">
            Back to plans
          </Link>
          <Link className="underline" href="/account/payments">
            All payments
          </Link>
          <Link className="underline" href="/contact">
            Payment support
          </Link>
        </div>
      </div>
      {order && <OrderReceipt order={order} />}
    </section>
  );
}
export function PaymentHistory() {
  const { data: session, status } = useSession();
  if (status === 'loading') return <p role="status">Loading account…</p>;
  if (!session?.user?.email)
    return (
      <Link
        className={buttonClass}
        href="/auth/signin?callbackUrl=/account/payments"
      >
        Sign in to view your payments
      </Link>
    );
  return <AccountHistory key={session.user.email} />;
}
function AccountHistory() {
  const [orders, setOrders] = useState<PaymentOrder[]>([]),
    [next, setNext] = useState<string | null>(null);
  const [cursor, setCursor] = useState(''),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const refresh = () => {
      setBusy(true);
      setCursor('');
      setRetry((n) => n + 1);
    };
    window.addEventListener('exampro:payment-verified', refresh);
    return () =>
      window.removeEventListener('exampro:payment-verified', refresh);
  }, []);
  useEffect(() => {
    let active = true;
    void monetization<{ orders: PaymentOrder[]; next: string | null }>(
      '/payments/orders' +
        (cursor ? '?before=' + encodeURIComponent(cursor) : ''),
    ).then((r) => {
      if (!active) return;
      setBusy(false);
      if (!r.success || !r.data) {
        setError(r.error?.message || 'Unable to load payments');
        return;
      }
      setError('');
      setNext(r.data.next);
      setOrders((old) =>
        cursor
          ? [
              ...old,
              ...r.data!.orders.filter(
                (o) => !old.some((x) => x.orderId === o.orderId),
              ),
            ]
          : r.data!.orders,
      );
    });
    return () => {
      active = false;
    };
  }, [cursor, retry]);
  return (
    <section className="space-y-4" aria-labelledby="payment-history">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="payment-history" className="text-2xl font-bold">
          Your orders
        </h2>
        <button
          className={buttonClass}
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setCursor('');
            setRetry((n) => n + 1);
          }}
        >
          Refresh history
        </button>
      </div>
      {busy && <p role="status">Loading payments…</p>}
      {error && <p role="alert">{error}</p>}
      {!busy && !error && orders.length === 0 && (
        <p className="rounded-2xl border p-6 text-muted-foreground">
          No payment orders yet. Your purchases will appear here.
        </p>
      )}
      {orders.map((order) => (
        <details
          key={order.orderId}
          className="min-w-0 rounded-2xl border bg-card p-4"
        >
          <summary className="cursor-pointer space-y-2 text-sm">
            <span className="font-semibold">
              {order.plan} · ₹{order.amountInr}
            </span>
            <span className="ml-2 capitalize">
              {order.status === 'paid' ? 'Verified success' : order.status}
            </span>
            <span className="block text-muted-foreground">
              {date(order.createdAt)} · {order.mode}
            </span>
            <span className="block break-all font-mono text-xs">
              {order.orderId}
            </span>
            <span className="block text-muted-foreground">
              Access expiry: {date(order.accessExpiresAt)} · View receipt
            </span>
          </summary>
          <div className="mt-4 space-y-3">
            <OrderReceipt order={order} />
            <Link
              href={`/account/payments?monetization_order=${encodeURIComponent(order.orderId)}`}
              className={buttonClass}
            >
              Verify latest status
            </Link>
          </div>
        </details>
      ))}
      {next && (
        <button
          className={buttonClass}
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setCursor(next);
          }}
        >
          Load older payments
        </button>
      )}
      <p className="text-sm text-muted-foreground">
        Need help?{' '}
        <Link className="underline" href="/contact">
          Contact payment support
        </Link>{' '}
        with your order ID.
      </p>
    </section>
  );
}
