'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Check } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { WhatsAppButton } from '@/components/mocks/whatsapp-button';
import { usePlan } from '@/hooks/use-plan';
import { PLANS, formatWhatsappNumber, inr, planMessage, planPrice, whatsappLink, type Plan } from '@/lib/plans';

const STEPS: [string, string][] = [
  ['Pick a plan', 'Choose monthly or yearly. Yearly costs ten months.'],
  ['Message us on WhatsApp', 'The chat opens with your plan and email already written.'],
  ['Pay as we tell you there', 'We share the payment details in the chat and confirm when the money arrives.'],
  ['Pro unlocks', 'Sign in with the same email. Your premium mocks open straight away.'],
];

const FAQ: [string, string][] = [
  ['How do I pay?', 'Tap a plan and WhatsApp opens. We send the payment details there and confirm in the same chat. There is no card form on this site.'],
  ['Which email should I use?', 'Sign in with Google or GitHub first, so the chat shows your account email. Guest accounts have no email, so we cannot attach a plan to them.'],
  ['How long until my plan starts?', 'We unlock it by hand after the payment arrives, usually within a few hours during the day. You will get a WhatsApp message.'],
  ['What if I renew early?', 'Renewals add to your current end date. You never lose paid days.'],
  ['Can I get a refund?', 'Review our refund policy and contact us promptly with the payment reference.'],
  ['We are an institute. What do we get?', 'Your students get Pro, and we can put your institute name and logo on the exam window. Message us with your student count and we will set it up.'],
];

export default function PricingPage() {
  const { data: session } = useSession();
  const plan = usePlan();
  const [yearly, setYearly] = useState(false);
  const [segment, setSegment] = useState<'learner' | 'institute'>('learner');
  const visible = PLANS.filter((p) => p.segment === segment || (segment === 'institute' && p.id === 'pro'));
  const email = session?.user?.email ?? null;

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">Pricing</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">Start free. Upgrade when you are ready.</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Free covers daily practice. Pro opens every full mock. Pay through WhatsApp and we unlock your plan by hand.
        </p>

        {plan.active && (
          <div className="mt-6 rounded-xl border border-emerald-600 bg-emerald-50 p-4 dark:bg-emerald-950/40" role="status">
            <p className="font-semibold">Your {plan.plan === 'institute' ? 'Institute' : 'Pro'} plan is active.</p>
            {plan.expiresAt && <p className="text-sm">Valid until {new Date(plan.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.</p>}
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <div className="inline-flex overflow-hidden rounded-lg border" role="group" aria-label="Plan type">
            {(['learner', 'institute'] as const).map((s) => (
              <button
                key={s}
                aria-pressed={segment === s}
                onClick={() => setSegment(s)}
                className={`min-h-11 px-4 text-sm font-semibold ${segment === s ? 'bg-foreground text-background' : 'bg-card'}`}
              >
                {s === 'learner' ? 'For learners' : 'For institutes'}
              </button>
            ))}
          </div>
          <div className="inline-flex overflow-hidden rounded-lg border" role="group" aria-label="Billing period">
            <button aria-pressed={!yearly} onClick={() => setYearly(false)} className={`min-h-11 px-4 text-sm font-semibold ${!yearly ? 'bg-foreground text-background' : 'bg-card'}`}>
              Monthly
            </button>
            <button aria-pressed={yearly} onClick={() => setYearly(true)} className={`min-h-11 px-4 text-sm font-semibold ${yearly ? 'bg-foreground text-background' : 'bg-card'}`}>
              Yearly · 2 months free
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((p) => (
            <PlanCard key={p.id} plan={p} yearly={yearly} email={email} name={session?.user?.name ?? null} current={plan.active && plan.plan === p.id} />
          ))}
        </div>

        {!email && (
          <p className="mt-4 text-sm text-muted-foreground">
            <Link className="font-semibold underline" href="/auth/signin?callbackUrl=/pricing">
              Sign in with Google or GitHub
            </Link>{' '}
            before you pay, so we can attach the plan to your email.
          </p>
        )}

        <section className="mt-14" aria-labelledby="how-pay">
          <h2 id="how-pay" className="text-2xl font-bold">
            How paying works
          </h2>
          <ol className="mt-5 grid gap-4 md:grid-cols-4">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="rounded-xl border bg-card p-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-orange-600 font-mono text-sm font-semibold text-orange-700 dark:text-orange-400">{i + 1}</span>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-14 grid gap-8 md:grid-cols-2" aria-labelledby="faq-h">
          <div>
            <h2 id="faq-h" className="text-2xl font-bold">
              Questions
            </h2>
            <div className="mt-4 divide-y border-y">
              {FAQ.map(([q, a]) => (
                <details key={q} className="py-3">
                  <summary className="cursor-pointer font-semibold">{q}</summary>
                  <p className="mt-2 text-sm text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </div>
          <div className="h-fit rounded-xl border bg-card p-6">
            <h2 className="text-xl font-bold">Talk to us first</h2>
            <p className="mt-2 text-sm text-muted-foreground">Not sure which plan fits? Ask on WhatsApp. A real person replies.</p>
            <p className="mt-3 font-mono text-sm">{formatWhatsappNumber()}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <WhatsAppButton text="Hi, I have a question about the plans on ExamPro." label="Ask about plans" />
              <WhatsAppButton text="Hi, I run a coaching institute and want ExamPro for my students." label="I run an institute" variant="outline" />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function PlanCard({ plan, yearly, email, name, current }: { plan: Plan; yearly: boolean; email: string | null; name: string | null; current: boolean }) {
  const price = planPrice(plan, yearly);
  return (
    <article className={`flex flex-col gap-4 rounded-xl border bg-card p-6 ${plan.highlight ? 'border-2 border-foreground' : ''}`}>
      <header>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-bold">{plan.name}</h2>
          {plan.highlight && <span className="rounded bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-900 dark:bg-orange-950/50 dark:text-orange-300">Recommended</span>}
        </div>
        <p className="text-sm text-muted-foreground">{plan.audience}</p>
      </header>
      <p className="text-4xl font-extrabold tabular-nums">
        {price.amount === 0 ? '₹0' : inr(price.amount)}
        <span className="mt-1 block text-sm font-normal text-muted-foreground">
          {price.per}
          {price.note ? ` · ${price.note}` : ''}
        </span>
      </p>
      <p className="font-mono text-sm font-semibold text-orange-700 dark:text-orange-400">{plan.limit}</p>
      <ul className="flex-1 space-y-2 text-sm">
        {plan.features.map((f) => (
          <li key={f} className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {plan.monthlyInr === 0 ? (
        <Button variant="outline" asChild>
          <Link href="/india-mocks">Start free</Link>
        </Button>
      ) : current ? (
        <Button variant="outline" disabled>
          Your current plan
        </Button>
      ) : (
        <a
          href={whatsappLink(planMessage(plan, yearly, email, name))}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Choose {plan.name} on WhatsApp
        </a>
      )}
    </article>
  );
}
