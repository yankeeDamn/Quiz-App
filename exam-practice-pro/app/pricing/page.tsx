'use client';
import { MicroPasses, PaymentReturn } from '@/components/payments/micro-passes';
import { useEffect, useRef } from 'react';
import { track } from '@/lib/track';
import Link from 'next/link';
import { Check, ShieldCheck } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { usePlan } from '@/hooks/use-plan';
import { PLANS, planMessage, whatsappLink } from '@/lib/plans';

const STEPS = [
  [
    'Choose your access',
    'Pick a focused pass or complete Pro access. Review the price and exact validity.',
  ],
  [
    'Sign in securely',
    'Your purchase is linked to your verified Google or GitHub account.',
  ],
  [
    'Pay with Cashfree',
    'Complete a one-time prepaid payment. There is no automatic renewal or auto-debit.',
  ],
  [
    'Get verified access',
    'Our server confirms payment with Cashfree, activates access and saves your receipt.',
  ],
];
const FAQ = [
  [
    'How do I pay?',
    'Choose one of the four paid plans, sign in and review the purchase. Cashfree handles payment securely. Payment availability is confirmed by our server.',
  ],
  [
    'When does access start?',
    'Access starts after our server verifies a successful Cashfree payment. A redirect alone never confirms payment. Pending orders can be rechecked from your payment history.',
  ],
  [
    'Does my plan renew automatically?',
    'No. These are one-time prepaid purchases. You decide when to buy again; there is no recurring debit or payment mandate.',
  ],
  [
    'What if I renew early?',
    'A focused pass extends its own remaining validity. Pro monthly and annual purchases extend the same Pro balance. You keep valid paid days, including existing account access.',
  ],
  [
    'I was debited but access is still pending. What should I do?',
    'Open payment history and recheck the order. Avoid another payment while settlement is pending. Contact payment support with your order ID if it remains unresolved.',
  ],
  [
    'Can I get a refund?',
    'Review our refund policy and contact support promptly with your order ID.',
  ],
];
export default function PricingPage() {
  const plan = usePlan(),
    viewed = useRef(false);
  useEffect(() => {
    if (!viewed.current) {
      viewed.current = true;
      track('pricing_viewed');
    }
  }, []);
  const free = PLANS.find((p) => p.id === 'free')!,
    institute = PLANS.find((p) => p.id === 'institute')!;
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:py-14">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
            ExamPro plans
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-5xl">
            Your next milestone.
            <br />
            <span className="text-indigo-600 dark:text-indigo-400">
              Your pace. Your plan.
            </span>
          </h1>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            Start free, focus on one goal, or unlock complete Pro access. Check
            the published catalogue before purchasing. Every paid plan is a
            one-time purchase with a clear expiry.
          </p>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
          <span className="flex items-center gap-2">
            <ShieldCheck
              className="h-4 w-4 text-emerald-600"
              aria-hidden="true"
            />
            Verified payment. Automatic activation.
          </span>
          <Link
            className="font-semibold underline underline-offset-4"
            href="/account/payments"
          >
            Payment history & receipts
          </Link>
        </div>
        {plan.active && (
          <div
            className="mt-6 rounded-2xl border border-emerald-600 bg-emerald-50 p-4 dark:bg-emerald-950/40"
            role="status"
          >
            <p className="font-semibold">
              Your {plan.plan === 'institute' ? 'Institute' : 'Pro'} plan is
              active.
            </p>
            {plan.expiresAt && (
              <p className="mt-1 text-sm">
                Valid until{' '}
                {new Date(plan.expiresAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
                . Renewals preserve your remaining days.
              </p>
            )}
          </div>
        )}
        <PaymentReturn />
        <MicroPasses />
        <section
          className="mt-8 grid gap-4 md:grid-cols-2"
          aria-label="Free practice and institute enquiries"
        >
          <article className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:p-6">
            <div>
              <h2 className="text-xl font-bold">Free</h2>
              <p className="mt-2 text-3xl font-bold">
                ₹0{' '}
                <span className="text-sm font-normal text-muted-foreground">
                  · no card needed
                </span>
              </p>
            </div>
            <ul className="flex-1 space-y-2 text-sm">
              {free.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check
                    className="h-4 w-4 shrink-0 text-emerald-600"
                    aria-hidden="true"
                  />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/india-mocks"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border px-4 py-2 font-semibold hover:bg-muted"
            >
              Start free
            </Link>
          </article>
          <article className="flex flex-col gap-4 rounded-2xl border bg-muted/30 p-5 sm:p-6">
            <h2 className="text-xl font-bold">For institutes</h2>
            <p className="text-lg font-semibold">Discuss a pilot</p>
            <ul className="flex-1 space-y-2 text-sm text-muted-foreground">
              {institute.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <a
              href={whatsappLink(planMessage(institute, false))}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border px-4 py-2 font-semibold hover:bg-muted"
            >
              Discuss institute pilot
            </a>
            <p className="text-xs text-muted-foreground">
              Enquiry only. Individual plans do not provide institute-wide
              access.
            </p>
          </article>
        </section>
        <section className="mt-14" aria-labelledby="how-pay">
          <h2 id="how-pay" className="text-2xl font-bold">
            From checkout to practice
          </h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="rounded-2xl border p-5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-800">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {text}
                </p>
              </li>
            ))}
          </ol>
        </section>
        <section
          className="mt-14 grid gap-8 md:grid-cols-[1.5fr_1fr]"
          aria-labelledby="pricing-questions"
        >
          <div>
            <h2 id="pricing-questions" className="text-2xl font-bold">
              Questions, answered
            </h2>
            <div className="mt-4 divide-y border-y">
              {FAQ.map(([q, a]) => (
                <details key={q} className="py-4">
                  <summary className="cursor-pointer pr-3 font-semibold">
                    {q}
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {a}
                  </p>
                </details>
              ))}
            </div>
          </div>
          <aside className="h-fit rounded-2xl border bg-muted/40 p-6">
            <h2 className="text-xl font-bold">Need a hand?</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              For a payment problem, have your order ID ready. Support can help
              you check an order; payments are completed through Cashfree
              checkout.
            </p>
            <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold">
              <Link className="underline" href="/contact">
                Payment support
              </Link>
              <Link className="underline" href="/refunds">
                Refund policy
              </Link>
            </div>
          </aside>
        </section>
      </main>
      <Footer />
    </>
  );
}
