/**
 * Plans, prices and the WhatsApp number used for coaching, doubts and payments.
 *
 * Payment works through WhatsApp: the visitor taps a plan, WhatsApp opens with
 * the plan and account email filled in, the owner shares payment details and,
 * once paid, unlocks the plan with POST /api/v1/admin/grant.
 *
 * Change the number with NEXT_PUBLIC_WHATSAPP_NUMBER (country code + number, digits only).
 */
export const WHATSAPP_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '919986418638').replace(/\D/g, '');

export function whatsappLink(text: string, number: string = WHATSAPP_NUMBER): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function formatWhatsappNumber(number: string = WHATSAPP_NUMBER): string {
  if (number.length === 12 && number.startsWith('91')) {
    return `+91 ${number.slice(2, 7)} ${number.slice(7)}`;
  }
  return `+${number}`;
}

export type PlanId = 'free' | 'pro' | 'institute';

export interface Plan {
  id: PlanId;
  name: string;
  audience: string;
  /** Price per month in rupees. 0 means free. */
  monthlyInr: number;
  limit: string;
  features: string[];
  highlight?: boolean;
  /** Which people the plan is sold to. */
  segment: 'learner' | 'institute';
}

/** Yearly billing costs this many months. */
export const YEARLY_MONTHS_CHARGED = 10;

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    audience: 'Daily practice',
    monthlyInr: 0,
    limit: 'For one learner',
    segment: 'learner',
    features: [
      'All 10 topic tests with instant answers',
      '5 full mocks: SSC, Bank PO, RRB, UPSC and campus',
      'Certification quizzes and flashcards',
      'Bookmarks, notes and progress',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    audience: 'Serious exam preparation',
    monthlyInr: 199,
    limit: 'For one learner',
    segment: 'learner',
    highlight: true,
    features: [
      'Everything in Free',
      '6 more full mocks, including SSC Mock 2, Bank PO Mock 2 and Campus Test 3',
      'Section and time analysis',
      'WhatsApp doubt support from a mentor',
      'New full mocks added every month',
    ],
  },
  {
    id: 'institute',
    name: 'Institute',
    audience: 'Coaching centres and schools',
    monthlyInr: 2999,
    limit: 'Up to 500 students',
    segment: 'institute',
    features: [
      'Everything in Pro for every student',
      'Your institute name and logo on the exam window',
      'Batch results shared on WhatsApp',
      'Priority support on WhatsApp',
    ],
  },
];

export function planPrice(plan: Plan, yearly: boolean): { amount: number; per: string; note: string } {
  if (plan.monthlyInr === 0) return { amount: 0, per: 'free', note: 'No card needed' };
  if (!yearly) return { amount: plan.monthlyInr, per: 'per month', note: '' };
  const total = plan.monthlyInr * YEARLY_MONTHS_CHARGED;
  return { amount: total, per: 'per year', note: `About ₹${Math.round(total / 12).toLocaleString('en-IN')} a month` };
}

export function inr(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

/** Message that opens in WhatsApp when someone picks a paid plan. */
export function planMessage(plan: Plan, yearly: boolean, email?: string | null, name?: string | null): string {
  const price = planPrice(plan, yearly);
  return [
    `Hi, I want the ${plan.name} plan (${yearly ? 'yearly' : 'monthly'}, ${inr(price.amount)}) on ExamPro.`,
    email ? `Account email: ${email}` : 'I have not signed in yet.',
    name ? `Name: ${name}` : '',
    'Please share the payment details.',
  ]
    .filter(Boolean)
    .join('\n');
}
