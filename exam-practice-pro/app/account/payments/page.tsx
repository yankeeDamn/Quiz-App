import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import {
  PaymentHistory,
  PaymentReturn,
} from '@/components/payments/payment-history';
export const metadata = {
  title: 'Payment history & receipts | ExamPro',
  robots: { index: false, follow: false },
};
export default function PaymentsPage() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <Link href="/pricing" className="text-sm underline">
          Back to plans
        </Link>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">
          Payments & receipts
        </h1>
        <p className="mb-8 mt-3 text-muted-foreground">
          Your prepaid purchases, verified payment status and access expiry, all
          in one place.
        </p>
        <PaymentReturn />
        <PaymentHistory />
      </main>
      <Footer />
    </>
  );
}
