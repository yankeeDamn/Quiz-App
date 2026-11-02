'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { WhatsAppButton } from '@/components/mocks/whatsapp-button';
import { MockCatalogue } from '@/components/mocks/mock-catalogue';

function Catalogue(){
  const category=useSearchParams().get('exam')||'all';
  return <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:py-12">
    <section className="ep-hero relative overflow-hidden rounded-3xl border border-indigo-100/70 px-6 py-9 shadow-sm dark:border-indigo-900/40 sm:px-10 sm:py-12"><div aria-hidden className="ep-hero-grid"/><div className="relative"><p className="ep-eyebrow">EXAMPRO · TEST CATALOGUE</p><h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-5xl">Free practice. Pro exam preparation.</h1><p className="mt-4 max-w-2xl text-muted-foreground">Explore published mocks for SSC, Banking, Railways, UPSC, campus placements and IT certifications. Try a sample before choosing Pro.</p><div className="mt-6"><WhatsAppButton text="Hi, I want coaching guidance for my exam preparation." label="Get coaching on WhatsApp"/></div></div></section>
    <section className="mt-8" aria-label="Free and Pro mock tests"><MockCatalogue key={category} initialCategory={category}/></section>
    <p className="mt-10 text-xs leading-6 text-muted-foreground">Original practice and source-labelled adaptations. These are not official previous-year papers. Introductory practice packs are labelled when expert review is pending.</p>
  </main>;
}
export default function IndiaMocksPage(){return <><Header/><Suspense fallback={<main className="flex-1 p-10" aria-busy>Loading catalogue…</main>}><Catalogue/></Suspense><Footer/></>;}
