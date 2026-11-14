/**
 * Plans and the WhatsApp number used for support and institute enquiries.
 * Learner purchases use verified Cashfree checkout on /pricing.
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
  enquiryOnly?: boolean;
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
      'Published Free topic practice; availability shown in the catalogue',
      'Public starter practice, labelled when awaiting review',
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
      'Access to published Pro content while your plan is active',
      'Section and time analysis',
      'WhatsApp doubt support from a mentor',
      'Check the live catalogue before purchasing',
    ],
  },
  {
    id: 'institute',
    name: 'Institute',
    audience: 'Coaching centres and schools',
    monthlyInr: 2999,
    limit: 'Scope and limits agreed after readiness review',
    enquiryOnly: true,
    segment: 'institute',
    features: [
      'Institute onboarding is in development',
      'Public branding preview available',
      'Private batches and reporting require rollout approval',
      'Contact us to discuss a pilot',
    ],
  },
];

export function planPrice(plan: Plan, yearly: boolean): { amount: number; per: string; note: string } {
  if (plan.monthlyInr === 0) return { amount: 0, per: 'free', note: 'No card needed' };
  if (!yearly) return { amount: plan.monthlyInr, per: 'per month', note: '' };
  const total = plan.id === 'pro' ? 999 : plan.monthlyInr * YEARLY_MONTHS_CHARGED;
  return { amount: total, per: 'per year', note: `About ₹${Math.round(total / 12).toLocaleString('en-IN')} a month` };
}

export function inr(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

/** Support and institute enquiry text; learner purchases use /pricing. */
export function planMessage(plan: Plan, yearly: boolean, email?: string | null, name?: string | null): string {
  if (plan.enquiryOnly) return 'Hi, I would like to discuss an ExamPro institute pilot. Please confirm available features, limits and a reviewed quote before any payment.';
  const price = planPrice(plan, yearly);
  return [
    `Hi, I want the ${plan.name} plan (${yearly ? 'yearly' : 'monthly'}, ${inr(price.amount)}) on ExamPro.`,
    email ? `Account email: ${email}` : 'I have not signed in yet.',
    name ? `Name: ${name}` : '',
    'I have a question about this plan. I will use the secure checkout on /pricing to purchase.',
  ]
    .filter(Boolean)
    .join('\n');
}
