'use client';
import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import Script from 'next/script';
import Link from 'next/link';
import { ArrowRight, Check, Clock3, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  PRODUCTS,
  monetization,
  monetizationEnabled,
  type ProductCode,
  type PaymentOrder,
} from '@/lib/monetization';

type Config = { checkout: 'sandbox' | 'production' | null };
const actionClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600 disabled:cursor-wait disabled:opacity-50';
type CheckoutProps = { code: ProductCode; resourceId?: string; label?: string };
export function CheckoutButton(props: CheckoutProps) {
  const { data: session } = useSession();
  return (
    <AccountCheckout
      key={`${session?.user?.email || 'guest'}:${props.code}:${props.resourceId || ''}`}
      {...props}
    />
  );
}
function AccountCheckout({ code, resourceId = '', label }: CheckoutProps) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false),
    [config, setConfig] = useState<Config | null>(null);
  const [phone, setPhone] = useState(''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const [ready, setReady] = useState(false),
    [configError, setConfigError] = useState('');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const attempt = useRef<{ account: string; key: string } | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const account = session?.user?.email || '';
  const storageKey = `ep:checkout:${JSON.stringify([account, code, resourceId])}`;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    let active = true;
    void monetization<Config>('/monetization/config', { public: true }).then(
      (r) => {
        if (active) {
          setConfig(r.success && r.data ? r.data : { checkout: null });
          setConfigError(
            r.success ? '' : 'Unable to load checkout. Close and retry.',
          );
        }
      },
    );
    return () => {
      active = false;
    };
  }, [open]);
  const p = PRODUCTS[code];
  async function checkout() {
    if (
      inFlight.current ||
      completed ||
      !account ||
      !config?.checkout ||
      !ready
    )
      return;
    inFlight.current = true;
    setBusy(true);
    setMessage('');
    try {
      if (attempt.current?.account !== account) {
        let saved: string | null = null;
        try {
          saved = sessionStorage.getItem(storageKey);
        } catch {
          /* Storage can be unavailable in private browsing. */
        }
        const valid =
          /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
        attempt.current = {
          account,
          key: saved && valid.test(saved) ? saved : crypto.randomUUID(),
        };
        // Only a retry identifier is stored here, never payment/access status.
        try {
          sessionStorage.setItem(storageKey, attempt.current.key);
        } catch {
          /* The server still reuses unresolved orders. */
        }
      }
      const r = await monetization<
        PaymentOrder & { paymentSessionId?: string }
      >('/payments/create-order', {
        method: 'POST',
        body: { code, phone, resourceId, checkoutKey: attempt.current!.key },
      });
      if (!mounted.current) return;
      if (!r.success || !r.data) {
        setMessage(
          r.error?.message ||
            'Checkout unavailable. Check payment history before retrying.',
        );
        return;
      }
      setOrderId(r.data.orderId);
      if (r.data.status === 'paid') {
        setCompleted(true);
        setMessage('Payment verified. Your access is active.');
        window.dispatchEvent(new Event('exampro:payment-verified'));
        return;
      }
      if (['expired', 'terminated'].includes(r.data.status)) {
        attempt.current = null;
        try {
          sessionStorage.removeItem(storageKey);
        } catch {
          /* No stored retry key. */
        }
        setMessage(
          'The previous order has closed. You can start a new purchase.',
        );
        return;
      }
      // Both config and the authenticated create response must explicitly agree.
      if (
        !r.data.paymentSessionId ||
        r.data.mode !== config.checkout ||
        !window.Cashfree
      ) {
        setMessage(
          'Checkout is unavailable. Recheck this order from payment history.',
        );
        return;
      }
      setMessage(
        'Order saved. Complete payment in Cashfree; access activates after verification.',
      );
      await window.Cashfree({ mode: r.data.mode }).checkout({
        paymentSessionId: r.data.paymentSessionId,
        redirectTarget: '_self',
      });
      // SDK completion, cancellation and redirects never count as settlement.
      setMessage(
        'Checkout returned. Recheck your order to confirm payment before retrying.',
      );
    } catch {
      setMessage(
        'Unable to open checkout. Check payment history before paying again.',
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  if (!monetizationEnabled)
    return (
      <p className="text-sm text-muted-foreground">
        Online purchases are currently unavailable.
      </p>
    );
  return (
    <>
      <button className={actionClass} onClick={() => setOpen(true)}>
        {label || `Choose ${p.title}`}
        <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{p.title}</DialogTitle>
            <DialogDescription>
              Review your prepaid purchase before opening secure Cashfree
              checkout.
            </DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-muted p-4 text-sm">
            <dt>Amount</dt>
            <dd className="text-right text-xl font-bold">₹{p.amount}</dd>
            <dt>Validity</dt>
            <dd className="text-right">{p.days} days</dd>
            <dt>Automatic renewal</dt>
            <dd className="text-right font-semibold">No · one-time payment</dd>
          </dl>
          <p className="text-xs text-muted-foreground">
            Access starts only after server verification. Renewing adds the full
            validity to your remaining access in the same plan group.
          </p>
          {status === 'loading' ? (
            <p role="status">Checking your account…</p>
          ) : !account ? (
            <Link
              className={actionClass}
              href="/auth/signin?callbackUrl=/pricing"
            >
              Sign in before paying
            </Link>
          ) : (
            <div className="space-y-4">
              <p className="break-all text-sm">Account: {account}</p>
              {config === null ? (
                <p role="status">Checking checkout availability…</p>
              ) : !config.checkout ? (
                <p role="status">
                  {configError ||
                    'New purchases are temporarily unavailable. Existing access and payment history remain available.'}
                </p>
              ) : (
                <>
                  <Script
                    id="exampro-cashfree"
                    src="https://sdk.cashfree.com/js/v3/cashfree.js"
                    onReady={() => setReady(true)}
                    onError={() =>
                      setMessage(
                        'Cashfree could not load. Check your connection and retry.',
                      )
                    }
                  />
                  {config.checkout === 'sandbox' && (
                    <p className="rounded-lg border border-amber-500 p-3 text-sm">
                      Sandbox checkout · test payments only. No real charge.
                    </p>
                  )}
                  <label className="grid gap-2 text-sm font-medium">
                    Indian mobile number
                    <input
                      className="min-h-11 w-full rounded-xl border bg-background px-3"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      value={phone}
                      maxLength={10}
                      onChange={(e) =>
                        setPhone(e.target.value.replace(/\D/g, ''))
                      }
                      placeholder="10-digit mobile number"
                    />
                  </label>
                  <button
                    disabled={
                      !ready || busy || completed || !/^[6-9]\d{9}$/.test(phone)
                    }
                    className={`${actionClass} w-full`}
                    onClick={() => void checkout()}
                  >
                    {completed
                      ? 'Payment verified'
                      : busy
                        ? 'Opening secure checkout…'
                        : `Pay ₹${p.amount} with Cashfree`}
                  </button>
                </>
              )}
              {message && (
                <p role="status" className="rounded-xl border p-3 text-sm">
                  {message}
                </p>
              )}
              {completed && (
                <button
                  className="min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold"
                  onClick={() => {
                    try {
                      sessionStorage.removeItem(storageKey);
                    } catch {
                      /* No stored retry key. */
                    }
                    attempt.current = null;
                    setCompleted(false);
                    setOrderId(null);
                    setMessage(
                      'Review the terms above, then pay to make a new one-time purchase.',
                    );
                  }}
                >
                  Start a new purchase
                </button>
              )}
              {orderId && (
                <Link
                  className="block break-all text-sm underline"
                  href={`/account/payments?monetization_order=${encodeURIComponent(orderId)}`}
                >
                  Recheck order {orderId}
                </Link>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-4 text-sm">
            <Link href="/account/payments" className="underline">
              Payment history
            </Link>
            <Link href="/contact" className="underline">
              Payment support
            </Link>
            <Link href="/refunds" className="underline">
              Refund policy
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function MicroPasses({ compact = false }: { compact?: boolean }) {
  const codes: ProductCode[] = compact
    ? ['SSC_PACK_49', 'IT_EBOOK_PACK_99']
    : ['SSC_PACK_49', 'IT_EBOOK_PACK_99', 'PRO_MONTHLY', 'PRO_ANNUAL'];
  return (
    <section className="my-8 space-y-5" aria-labelledby="paid-plans">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
            A little more focus. A lot more practice.
          </p>
          <h2
            id="paid-plans"
            className="mt-2 text-2xl font-bold tracking-tight"
          >
            Choose your next step
          </h2>
        </div>
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Secure Cashfree checkout
        </span>
      </div>
      <div
        className={`grid gap-4 sm:grid-cols-2 ${compact ? '' : 'xl:grid-cols-4'}`}
      >
        {codes.map((code) => (
          <article
            key={code}
            className={`flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-5 ${code === 'PRO_ANNUAL' ? 'border-indigo-500 shadow-lg shadow-indigo-500/10' : ''}`}
          >
            <div className="flex min-h-6 items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              {code === 'PRO_ANNUAL'
                ? 'BEST VALUE'
                : code.startsWith('PRO_')
                  ? 'COMPLETE ACCESS'
                  : 'FOCUSED PASS'}
            </div>
            <h3 className="text-lg font-bold">{PRODUCTS[code].title}</h3>
            <p className="text-4xl font-bold tracking-tight">
              ₹{PRODUCTS[code].amount}
            </p>
            <p className="flex items-center gap-2 text-sm">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              {PRODUCTS[code].days} days of access
            </p>
            <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
              {code === 'SSC_PACK_49'
                ? 'Published SSC CGL 2026 full mocks.'
                : code === 'IT_EBOOK_PACK_99'
                  ? 'Premium IT ebooks, permitted PDFs and ebook assessments.'
                  : 'All published premium mocks, premium ebooks and assessments.'}
            </p>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
              One-time payment · no auto-renewal
            </p>
            <CheckoutButton code={code} />
          </article>
        ))}
      </div>
    </section>
  );
}
// Preserve pricing return links issued before the new account history page.
export { PaymentReturn } from './payment-history';
