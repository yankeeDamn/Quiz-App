'use client';
import Link from 'next/link';
import {
  ArrowLeft,
  BookOpen,
  LifeBuoy,
  LoaderCircle,
  RefreshCw,
  SearchX,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RecoveryHeader } from './recovery-header';
import { Footer } from './footer';
import { useExamLanguage } from '@/components/exampro/exam-language';
const COPY = {
  en: {
    missing: 'This page took a wrong turn.',
    missingBody:
      'The link may have changed. Your next practice session is still here.',
    error: 'A small pause. We’ll get you back.',
    errorBody:
      'We couldn’t open this page. Try again, or choose a familiar place below.',
    loading: 'Getting your learning space ready…',
    loadingBody: 'Loading the next page. This should only take a moment.',
    retry: 'Try again',
    home: 'Home',
    mocks: 'India mocks',
    contact: 'Contact',
    reference: 'Error reference',
    eyebrow: 'Keep learning with confidence',
  },
  hi: {
    missing: 'यह पेज नहीं मिला।',
    missingBody:
      'लिंक बदल गया हो सकता है। अपनी अगली अभ्यास परीक्षा यहाँ से खोलें।',
    error: 'थोड़ा विराम। फिर से कोशिश करें।',
    errorBody:
      'यह पेज नहीं खुल सका। दोबारा कोशिश करें या नीचे दिए गए लिंक चुनें।',
    loading: 'आपका अध्ययन पेज तैयार हो रहा है…',
    loadingBody: 'अगला पेज लोड हो रहा है। कृपया थोड़ा इंतज़ार करें।',
    retry: 'फिर से कोशिश करें',
    home: 'होम',
    mocks: 'भारत मॉक टेस्ट',
    contact: 'संपर्क',
    reference: 'त्रुटि संदर्भ',
    eyebrow: 'आत्मविश्वास के साथ सीखते रहें',
  },
  bn: {
    missing: 'এই পেজটি পাওয়া যায়নি।',
    missingBody:
      'লিংকটি বদলে যেতে পারে। এখান থেকে আপনার পরের অনুশীলন শুরু করুন।',
    error: 'একটু বিরতি। আবার চেষ্টা করুন।',
    errorBody:
      'এই পেজটি খোলা যায়নি। আবার চেষ্টা করুন অথবা নিচের লিংক বেছে নিন।',
    loading: 'আপনার পড়াশোনার পেজ তৈরি হচ্ছে…',
    loadingBody: 'পরের পেজটি লোড হচ্ছে। একটু অপেক্ষা করুন।',
    retry: 'আবার চেষ্টা করুন',
    home: 'হোম',
    mocks: 'ভারতের মক টেস্ট',
    contact: 'যোগাযোগ',
    reference: 'ত্রুটির রেফারেন্স',
    eyebrow: 'আত্মবিশ্বাস নিয়ে শিখতে থাকুন',
  },
};
export function RecoveryScreen({
  kind,
  digest,
  reset,
}: {
  kind: 'missing' | 'error' | 'loading';
  digest?: string;
  reset?: () => void;
}) {
  const { language } = useExamLanguage();
  const copy = COPY[language];
  const Icon =
    kind === 'missing'
      ? SearchX
      : kind === 'loading'
        ? LoaderCircle
        : ShieldAlert;
  const reference =
    typeof digest === 'string' && /^[a-z0-9-]{1,64}$/i.test(digest)
      ? digest
      : undefined;
  return (
    <div
      className="flex min-h-screen flex-col bg-background text-foreground"
      lang={language}
    >
      <RecoveryHeader />
      <main
        className="relative mx-auto flex w-full max-w-4xl flex-1 items-center justify-center px-4 py-16 sm:py-24"
        aria-busy={kind === 'loading'}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-8 top-8 h-64 rounded-full bg-indigo-100/60 blur-3xl dark:bg-indigo-950/40"
        />
        <Card className="relative w-full max-w-2xl rounded-3xl border-border/80 bg-card shadow-xl shadow-indigo-500/5">
          <CardContent className="p-7 text-center sm:p-12">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
              <Icon
                aria-hidden="true"
                className={`h-8 w-8 ${kind === 'loading' ? 'animate-spin motion-reduce:animate-none' : ''}`}
              />
            </div>
            <p className="mt-6 text-xs font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-300">
              {kind === 'missing' ? '404 · ' : ''}
              {copy.eyebrow}
            </p>
            <h1
              className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl"
              role={kind === 'loading' ? 'status' : undefined}
            >
              {copy[kind]}
            </h1>
            <p className="mx-auto mt-4 max-w-md text-base leading-7 text-muted-foreground">
              {copy[`${kind}Body`]}
            </p>
            {reference && (
              <p className="mt-5 text-xs text-muted-foreground">
                {copy.reference}:{' '}
                <code className="rounded bg-muted px-2 py-1">{reference}</code>
              </p>
            )}
            {reset && (
              <Button
                className="mt-7 min-h-11 bg-indigo-600 px-6 text-white hover:bg-indigo-700"
                onClick={reset}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                {copy.retry}
              </Button>
            )}
            <nav
              aria-label={copy.home}
              className="mt-7 flex flex-wrap justify-center gap-3"
            >
              <Button variant="outline" asChild>
                <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {copy.home}
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/india-mocks">
                  <BookOpen className="mr-2 h-4 w-4" />
                  {copy.mocks}
                </Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/contact">
                  <LifeBuoy className="mr-2 h-4 w-4" />
                  {copy.contact}
                </Link>
              </Button>
            </nav>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
