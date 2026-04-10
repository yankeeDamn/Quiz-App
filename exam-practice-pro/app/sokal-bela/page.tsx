'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, ShoppingBag, CheckCircle, Loader2 } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface BookingResult {
  id: string;
  status: string;
  serviceType: string;
  preferredDate: string;
}

interface OrderResult {
  id: string;
  status: string;
  totalAmount: number;
  items: Array<{ itemName: string; quantity: number; pricePerUnit: number; subtotal: number }>;
}

export default function SokalBelaPage() {
  const [bookingLoading, setBookingLoading] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [bookingResult, setBookingResult] = useState<BookingResult | null>(null);
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [error, setError] = useState('');

  async function handleBooking(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBookingLoading(true);
    setError('');
    setBookingResult(null);

    const form = new FormData(e.currentTarget);
    const body = {
      customerName: form.get('bookingName') as string,
      customerEmail: form.get('bookingEmail') as string,
      customerPhone: form.get('bookingPhone') as string,
      serviceType: form.get('serviceType') as string,
      preferredDate: form.get('preferredDate') as string,
      preferredTime: form.get('preferredTime') as string,
      notes: form.get('bookingNotes') as string,
    };

    try {
      const res = await fetch(`${API_BASE}/api/v1/sokal-bela/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setBookingResult(data.data);
      } else {
        setError(data.error?.message || JSON.stringify(data.error?.details) || 'Booking failed');
      }
    } catch {
      setError('Unable to connect to server');
    } finally {
      setBookingLoading(false);
    }
  }

  async function handleOrder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOrderLoading(true);
    setError('');
    setOrderResult(null);

    const form = new FormData(e.currentTarget);
    const body = {
      customerName: form.get('orderName') as string,
      customerEmail: form.get('orderEmail') as string,
      customerPhone: form.get('orderPhone') as string,
      deliveryAddress: form.get('deliveryAddress') as string,
      notes: form.get('orderNotes') as string,
      items: [
        {
          itemName: form.get('itemName') as string,
          quantity: parseInt(form.get('itemQuantity') as string) || 1,
          pricePerUnit: parseFloat(form.get('itemPrice') as string) || 0,
        },
      ],
    };

    try {
      const res = await fetch(`${API_BASE}/api/v1/sokal-bela/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setOrderResult(data.data);
      } else {
        setError(data.error?.message || JSON.stringify(data.error?.details) || 'Order failed');
      }
    } catch {
      setError('Unable to connect to server');
    } finally {
      setOrderLoading(false);
    }
  }

  return (
    <>
      <Header />
      <main className="flex-1 bg-[#0a0a0a]">
        {/* Hero */}
        <section className="border-b border-[#2a2a2a]">
          <div className="container mx-auto px-4 py-12 text-center">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl font-bold mb-3"
            >
              <span className="bg-gradient-to-r from-[#D4AF37] to-[#F0D060] bg-clip-text text-transparent">
                Sokal Bela
              </span>
            </motion.h1>
            <p className="text-[#a0a0a0] text-lg">Book services or place orders</p>
          </div>
        </section>

        <section className="container mx-auto px-4 py-8 max-w-2xl">
          {error && (
            <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-center mb-6">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <Tabs defaultValue="booking" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-[#141414] border border-[#2a2a2a]">
              <TabsTrigger value="booking" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">
                <Calendar className="h-4 w-4 mr-2" />
                Book a Service
              </TabsTrigger>
              <TabsTrigger value="order" className="data-[state=active]:bg-[#D4AF37] data-[state=active]:text-black">
                <ShoppingBag className="h-4 w-4 mr-2" />
                Place an Order
              </TabsTrigger>
            </TabsList>

            {/* Booking Tab */}
            <TabsContent value="booking">
              {bookingResult ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-xl border border-[#D4AF37]/30 bg-[#141414] p-8 text-center"
                >
                  <CheckCircle className="h-12 w-12 text-[#D4AF37] mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-[#f5f5f0] mb-2">Booking Confirmed!</h3>
                  <p className="text-[#a0a0a0] mb-4">Your booking ID: <span className="text-[#D4AF37] font-mono">{bookingResult.id.slice(0, 8)}</span></p>
                  <p className="text-sm text-[#666]">Service: {bookingResult.serviceType} | Date: {bookingResult.preferredDate}</p>
                  <Button
                    onClick={() => setBookingResult(null)}
                    className="mt-6 bg-[#D4AF37] text-black hover:bg-[#F0D060]"
                  >
                    Make Another Booking
                  </Button>
                </motion.div>
              ) : (
                <form onSubmit={handleBooking} className="rounded-xl border border-[#2a2a2a] bg-[#141414] p-6 space-y-4 mt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="bookingName" className="text-[#a0a0a0]">Name *</Label>
                      <Input id="bookingName" name="bookingName" required className="bg-[#0a0a0a] border-[#2a2a2a] text-[#f5f5f0] focus:border-[#D4AF37]" />
                    </div>
                    <div>
                      <Label htmlFor="bookingEmail" className="text-[#a0a0a0]">Email *</Label>
                      <Input id="bookingEmail" name="bookingEmail" type="email" required className="bg-[#0a0a0a] border-[#2a2a2a] text-[#f5f5f0] focus:border-[#D4AF37]" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="bookingPhone" className="text-[#a0a0a0]">Phone</Label>
                      <Input id="bookingPhone" name="bookingPhone" className="bg-[#0a0a0a] border-[#2a2a2a] text-[#f5f5f0] focus:border-[#D4AF37]" />
                    </div>
                    <div>
                      <Label htmlFor="serviceType" className="text-[#a0a0a0]">Service Type *</Label>
                      <Input id="serviceType" name="serviceType" required placeholder="e.g., Consultation" className="bg-[#0a0a0a] border-[#2a2a2a] text-[#f5f5f0] focus:border-[#D4AF37]" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="preferredDate" className="text-[#a0a0a0]">Preferred Date *</Label>
                      <Input id="preferredDate" name="preferredDate" type="date" required className="bg-[#0a0a0a] border-[#2a2a2a] text-[#f5f5f0] focus:border-[#D4AF37]" />
                    </div>
                    <div>
                      <Label htmlFor="preferredTime" className="text-[#a0a0a0]">Preferred Time</Label>
                      <Input id="preferredTime" name="preferredTime" type="time" className="bg-[#0a0a0a] border-[#2a2a2a] text-[#f5f5f0] focus:border-[#D4AF37]" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="bookingNotes" className="text-[#a0a0a0]">Notes</Label>
                    <Textarea id="bookingNotes" name="bookingNotes" rows={3} className="bg-[#0a0a0a] border-[#2a2a2a] text-[#f5f5f0] focus:border-[#D4AF37]" />
                  </div>
                  <Button type="submit" disabled={bookingLoading} className="w-full bg-[#D4AF37] text-black hover:bg-[#F0D060] font-medium">
                    {bookingLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Booking...</> : 'Confirm Booking'}
                  </Button>
                </form>
              )}
            </TabsContent>

            {/* Order Tab */}
            <TabsContent value="order">
              {orderResult ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-xl border border-[#D4AF37]/30 bg-[#141414] p-8 text-center"
                >
                  <CheckCircle className="h-12 w-12 text-[#D4AF37] mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-[#f5f5f0] mb-2">Order Placed!</h3>
                  <p className="text-[#a0a0a0] mb-4">Order ID: <span className="text-[#D4AF37] font-mono">{orderResult.id.slice(0, 8)}</span></p>
                  <p className="text-sm text-[#666]">Total: ${orderResult.totalAmount.toFixed(2)} | Items: {orderResult.items.length}</p>
                  <Button
                    onClick={() => setOrderResult(null)}
                    className="mt-6 bg-[#D4AF37] text-black hover:bg-[#F0D060]"
                  >
                    Place Another Order
                  </Button>
                </motion.div>
              ) : (
                <form onSubmit={handleOrder} className="rounded-xl border border-[#2a2a2a] bg-[#141414] p-6 space-y-4 mt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="orderName" className="text-[#a0a0a0]">Name *</Label>
                      <Input id="orderName" name="orderName" required className="bg-[#0a0a0a] border-[#2a2a2a] text-[#f5f5f0] focus:border-[#D4AF37]" />
                    </div>
                    <div>
                      <Label htmlFor="orderEmail" className="text-[#a0a0a0]">Email *</Label>
                      <Input id="orderEmail" name="orderEmail" type="email" required className="bg-[#0a0a0a] border-[#2a2a2a] text-[#f5f5f0] focus:border-[#D4AF37]" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="orderPhone" className="text-[#a0a0a0]">Phone</Label>
                    <Input id="orderPhone" name="orderPhone" className="bg-[#0a0a0a] border-[#2a2a2a] text-[#f5f5f0] focus:border-[#D4AF37]" />
                  </div>
                  <div className="border border-[#2a2a2a] rounded-lg p-4 space-y-3">
                    <h4 className="text-sm font-medium text-[#D4AF37]">Item Details</h4>
                    <div>
                      <Label htmlFor="itemName" className="text-[#a0a0a0]">Item Name *</Label>
                      <Input id="itemName" name="itemName" required className="bg-[#0a0a0a] border-[#2a2a2a] text-[#f5f5f0] focus:border-[#D4AF37]" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="itemQuantity" className="text-[#a0a0a0]">Quantity *</Label>
                        <Input id="itemQuantity" name="itemQuantity" type="number" min="1" defaultValue="1" required className="bg-[#0a0a0a] border-[#2a2a2a] text-[#f5f5f0] focus:border-[#D4AF37]" />
                      </div>
                      <div>
                        <Label htmlFor="itemPrice" className="text-[#a0a0a0]">Price per Unit *</Label>
                        <Input id="itemPrice" name="itemPrice" type="number" min="0" step="0.01" required className="bg-[#0a0a0a] border-[#2a2a2a] text-[#f5f5f0] focus:border-[#D4AF37]" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="deliveryAddress" className="text-[#a0a0a0]">Delivery Address</Label>
                    <Textarea id="deliveryAddress" name="deliveryAddress" rows={2} className="bg-[#0a0a0a] border-[#2a2a2a] text-[#f5f5f0] focus:border-[#D4AF37]" />
                  </div>
                  <div>
                    <Label htmlFor="orderNotes" className="text-[#a0a0a0]">Notes</Label>
                    <Textarea id="orderNotes" name="orderNotes" rows={2} className="bg-[#0a0a0a] border-[#2a2a2a] text-[#f5f5f0] focus:border-[#D4AF37]" />
                  </div>
                  <Button type="submit" disabled={orderLoading} className="w-full bg-[#D4AF37] text-black hover:bg-[#F0D060] font-medium">
                    {orderLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Placing Order...</> : 'Place Order'}
                  </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </section>
      </main>
      <Footer />
    </>
  );
}
