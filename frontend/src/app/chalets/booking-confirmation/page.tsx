'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  CheckCircle2,
  Calendar,
  Users,
  Home,
  Mail,
  Phone,
  ArrowRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface Booking {
  id: string;
  booking_number: string;
  chalet_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  check_in_date: string;
  check_out_date: string;
  number_of_guests: number;
  number_of_nights: number;
  base_amount: number;
  add_ons_amount: number;
  deposit_amount: number;
  total_amount: number;
  status: string;
  payment_status: string;
  special_requests?: string;
  chalet?: {
    name: string;
    images?: string[];
  };
}

function BookingConfirmationContent() {
  const searchParams = useSearchParams();
  const t = useTranslations('chalets');
  const tCommon = useTranslations('common');
  const currency = useSettingsStore((s) => s.currency);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bookingId = searchParams.get('id');

  useEffect(() => {
    if (bookingId) {
      fetchBooking();
    } else {
      setError('No booking ID provided');
      setLoading(false);
    }
  }, [bookingId]);

  const fetchBooking = async () => {
    try {
      const response = await api.get(`/chalets/bookings/${bookingId}`);
      setBooking(response.data.data);
    } catch (err) {
      setError('Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-resort-sand dark:bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-resort-sand dark:bg-slate-900">
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{error || 'Booking not found'}</h2>
            <Link href="/chalets">
              <Button className="mt-4">Back to Chalets</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white dark:from-slate-900 dark:to-slate-800 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
          </motion.div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            {t('bookingConfirmed')}
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {t('bookingConfirmationMessage')}
          </p>
        </motion.div>

        <Card>
          <CardHeader className="bg-green-50 dark:bg-green-900/20 border-b">
            <CardTitle className="flex items-center justify-between">
              <span>{t('bookingDetails')}</span>
              <span className="text-sm font-mono bg-white dark:bg-slate-800 px-3 py-1 rounded-full">
                #{booking.booking_number}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-slate-200 dark:divide-slate-700">
            {/* Chalet */}
            <div className="py-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <Home className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">{t('chalet')}</p>
                <p className="font-semibold">{booking.chalet?.name || 'Chalet'}</p>
              </div>
            </div>

            {/* Dates */}
            <div className="py-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">{t('checkIn')}</p>
                  <p className="font-semibold">{formatDate(booking.check_in_date)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{t('checkOut')}</p>
                  <p className="font-semibold">{formatDate(booking.check_out_date)}</p>
                </div>
              </div>
            </div>

            {/* Guests */}
            <div className="py-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">{tCommon('guests')}</p>
                <p className="font-semibold">{booking.number_of_guests} guests • {booking.number_of_nights} nights</p>
              </div>
            </div>

            {/* Contact */}
            <div className="py-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-slate-400" />
                <span>{booking.customer_email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-slate-400" />
                <span>{booking.customer_phone}</span>
              </div>
            </div>

            {/* Pricing */}
            <div className="py-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>{booking.number_of_nights} nights accommodation</span>
                <span>{formatCurrency(booking.base_amount, currency)}</span>
              </div>
              {booking.add_ons_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span>{t('addOns')}</span>
                  <span>{formatCurrency(booking.add_ons_amount, currency)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold pt-2 border-t">
                <span>{tCommon('total')}</span>
                <span className="text-lg text-green-600">{formatCurrency(booking.total_amount, currency)}</span>
              </div>
              <div className="flex justify-between text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                <span>{t('depositRequired')}</span>
                <span>{formatCurrency(booking.deposit_amount, currency)}</span>
              </div>
            </div>

            {/* Special Requests */}
            {booking.special_requests && (
              <div className="py-4">
                <p className="text-sm text-slate-500 mb-1">{t('specialRequests')}</p>
                <p className="text-sm">{booking.special_requests}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/chalets">
            <Button variant="outline">{t('browseMoreChalets')}</Button>
          </Link>
          <Link href="/profile">
            <Button className="gap-2">
              {t('viewMyBookings')}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          {t('confirmationEmailSent')}
        </p>
      </div>
    </div>
  );
}

export default function BookingConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-resort-sand dark:bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    }>
      <BookingConfirmationContent />
    </Suspense>
  );
}
