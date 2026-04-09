'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Crown, Loader2, Shield, Zap, BookOpen } from 'lucide-react';
import { getUserProfile, getStripeConfig, createPaymentIntent } from '@/lib/api';
import Link from 'next/link';

export default function PricingPage() {
  const { data: session } = useSession();
  const [paymentStatus, setPaymentStatus] = useState<string>('unpaid');
  const [isLoading, setIsLoading] = useState(false);
  const [stripeConfig, setStripeConfig] = useState<{ publishableKey: string; amount: number; currency: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Fetch user payment status
    if (session?.user) {
      getUserProfile().then((res) => {
        if (res.success && res.data) {
          setPaymentStatus(res.data.user.paymentStatus || 'unpaid');
        }
      }).catch(() => {});
    }

    // Fetch Stripe config
    getStripeConfig().then((res) => {
      if (res.success && res.data) {
        setStripeConfig(res.data);
      }
    }).catch(() => {});
  }, [session]);

  const handleUpgrade = async () => {
    if (!session?.user) {
      window.location.href = '/auth/signin?callbackUrl=/pricing';
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await createPaymentIntent(session.user.email || undefined);

      if (!res.success || !res.data) {
        setError(res.error?.message || 'Failed to create payment. Please try again.');
        setIsLoading(false);
        return;
      }

      // Load Stripe.js dynamically
      if (!stripeConfig?.publishableKey) {
        setError('Payment system not configured.');
        setIsLoading(false);
        return;
      }

      const { loadStripe } = await import('@stripe/stripe-js');
      const stripe = await loadStripe(stripeConfig.publishableKey);

      if (!stripe) {
        setError('Failed to load payment system.');
        setIsLoading(false);
        return;
      }

      // Redirect to Stripe's hosted payment page.
      // Using redirect: 'always' sends the user to Stripe's UI
      // to complete payment — no mounted Payment Element needed.
      const { error: confirmError } = await stripe.confirmPayment({
        clientSecret: res.data.clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/pricing?success=true`,
        },
        redirect: 'always',
      });

      if (confirmError) {
        setError(confirmError.message || 'Payment failed.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Check for success redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'true' || params.get('redirect_status') === 'succeeded') {
      setSuccess(true);
      setPaymentStatus('paid');
    }
  }, []);

  const isPaid = paymentStatus === 'paid';

  return (
    <>
      <Header />
      <main className="flex-1 bg-gray-50 dark:bg-background">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">
              {success ? '🎉 Payment Successful!' : 'Upgrade to Full Access'}
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {success
                ? 'You now have full access to all exam content. Happy studying!'
                : 'Unlock all practice exams, detailed explanations, and advanced analytics.'}
            </p>
          </div>

          {success && (
            <div className="flex justify-center mb-8">
              <Button asChild size="lg" className="bg-indigo-600 hover:bg-indigo-700">
                <Link href="/">Start Practicing</Link>
              </Button>
            </div>
          )}

          <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
            {/* Free Tier */}
            <Card className="relative">
              <CardHeader>
                <CardTitle className="text-xl">Free</CardTitle>
                <CardDescription>Get started with basic quizzes</CardDescription>
                <div className="text-3xl font-bold mt-4">$0</div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {[
                    'General knowledge quizzes',
                    'Basic quiz modes',
                    'Local progress tracking',
                    'Bookmarks & notes',
                    'Guest access',
                  ].map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500 shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Pro Tier */}
            <Card className="relative border-indigo-500 shadow-lg">
              {isPaid && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600">
                  <Crown className="mr-1 h-3 w-3" /> Active
                </Badge>
              )}
              {!isPaid && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600">
                  <Zap className="mr-1 h-3 w-3" /> Recommended
                </Badge>
              )}
              <CardHeader>
                <CardTitle className="text-xl">Full Access</CardTitle>
                <CardDescription>Everything you need to pass your exams</CardDescription>
                <div className="text-3xl font-bold mt-4">
                  ${stripeConfig ? (stripeConfig.amount / 100).toFixed(2) : '50.00'}
                  <span className="text-sm font-normal text-muted-foreground"> one-time</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-6">
                  {[
                    'All certification exam prep',
                    'Microsoft, AWS, Google, CompTIA exams',
                    'Detailed explanations for every question',
                    'Performance analytics & trends',
                    'Cloud sync across devices',
                    'Priority support',
                  ].map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-indigo-500 shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {error && (
                  <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                    {error}
                  </div>
                )}

                {isPaid ? (
                  <Button disabled className="w-full bg-green-600">
                    <Crown className="mr-2 h-4 w-4" />
                    Full Access Active
                  </Button>
                ) : (
                  <Button
                    onClick={handleUpgrade}
                    disabled={isLoading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                    size="lg"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing…
                      </>
                    ) : (
                      <>
                        <Shield className="mr-2 h-4 w-4" />
                        Get Full Access
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Trust badges */}
          <div className="mt-12 text-center">
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Secure payment via Stripe
              </div>
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Instant access after payment
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                One-time purchase, lifetime access
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
