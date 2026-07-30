'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSiteSettings } from '@/lib/settings-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/layout/Container';
import { Section } from '@/components/layout/Section';
import {
  CheckCircle2,
  Calendar,
  Users,
  Clock,
  Phone,
  ArrowRight,
  Loader2,
  AlertCircle,
  Ticket,
  UtensilsCrossed,
  Home,
  User,
  MapPin,
  Receipt,
} from 'lucide-react';

// ============================
// TYPE DEFINITIONS
// ============================

interface SessionTicket {
  id: string;
  ticket_number: string;
  session_id: string;
  customer_name: string;
  customer_phone: string;
  ticket_date: string;
  number_of_guests: number;
  total_amount: number;
  status: string;
  payment_status: string;
  qr_code?: string;
  session?: {
    name: string;
    start_time: string;
    end_time: string;
  };
}

interface OrderConfirmation {
  id: string;
  order_number: string;
  customer_name?: string;
  status: string;
  order_type: string;
  total_amount: number;
  tax_amount?: number;
  discount_amount?: number;
  qr_code?: string;
  table_id?: string;
  created_at: string;
  items?: Array<{
    id: string;
    quantity: number;
    catalog_items?: { name: string };
  }>;
}

interface BookingConfirmation {
  id: string;
  booking_number: string;
  customer_name: string;
  customer_email?: string;
  check_in_date: string;
  check_out_date: string;
  status: string;
  total_price: number;
  guests?: number;
  special_requests?: string;
  unit?: { name: string };
}

// ============================
// MAIN COMPONENT
// ============================

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const params = useParams();
  const propertySlug = (params?.property as string) || '';
  const tCommon = useTranslations('common');
  const currency = useSettingsStore((s) => s.currency);
  const { modules } = useSiteSettings();

  const [ticket, setTicket] = useState<SessionTicket | null>(null);
  const [order, setOrder] = useState<OrderConfirmation | null>(null);
  const [booking, setBooking] = useState<BookingConfirmation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const confirmationType = searchParams.get('type') || 'session'; // 'session' | 'order' | 'booking'
  const itemId = searchParams.get('id');
  const slug = Array.isArray(params?.slug) ? params.slug[0] : params?.slug || '';

  const currentModule = modules.find((m) => m.slug.toLowerCase() === slug.toLowerCase());
  const moduleName = currentModule?.name || 'Module';

  useEffect(() => {
    if (!itemId) {
      setError('No confirmation ID provided');
      setLoading(false);
      return;
    }
    fetchConfirmation();
  }, [itemId, confirmationType]);

  const fetchConfirmation = async () => {
    try {
      if (confirmationType === 'order') {
        const response = await api.get(`/${slug}/orders/${itemId}`);
        setOrder(response.data.data);
      } else if (confirmationType === 'booking') {
        const response = await api.get(`/${slug}/bookings/${itemId}`);
        setBooking(response.data.data);
      } else {
        // Default: session ticket
        const response = await api.get(`/${slug}/tickets/${itemId}`);
        setTicket(response.data.data);
      }
    } catch (err) {
      setError('Failed to load confirmation details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary-50 to-white dark:from-slate-900 dark:to-slate-800">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error || (!ticket && !order && !booking)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary-50 to-white dark:from-slate-900 dark:to-slate-800">
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{error || 'Confirmation not found'}</h2>
            <Link href={`/${propertySlug}/${slug}`}>
              <Button className="mt-4">Back to {moduleName}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Section className="py-12">
        <Container size="sm">
        {/* Success Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-20 h-20 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <CheckCircle2 className="w-10 h-10 text-primary-600 dark:text-primary-400" />
          </motion.div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            {confirmationType === 'order' ? 'Order Confirmed!' :
             confirmationType === 'booking' ? 'Booking Confirmed!' :
             'Ticket Confirmed!'}
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {confirmationType === 'order' ? 'Your order has been placed successfully.' :
             confirmationType === 'booking' ? 'Your booking is confirmed. We look forward to hosting you!' :
             'Your ticket has been confirmed.'}
          </p>
        </motion.div>

        {/* ========== SESSION TICKET CONFIRMATION ========== */}
        {ticket && (
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary-600 to-primary-500 text-white border-b-0">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Ticket className="w-5 h-5" />
                  {moduleName} Ticket
                </span>
                <span className="text-sm font-mono bg-white/20 px-3 py-1 rounded-full">
                  #{ticket.ticket_number}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-slate-200 dark:divide-slate-700">
              {ticket.qr_code && (
                <div className="py-6 flex justify-center">
                  <div className="bg-white p-4 rounded-lg shadow-inner">
                    <img src={ticket.qr_code} alt="Ticket QR Code" className="w-40 h-40" />
                  </div>
                </div>
              )}
              <div className="py-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                  <Ticket className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">{'Session'}</p>
                  <p className="font-semibold">{ticket.session?.name || 'Session'}</p>
                </div>
              </div>
              <div className="py-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-primary-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-500">{'Date'}</p>
                  <p className="font-semibold">{formatDate(ticket.ticket_date)}</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Clock className="w-4 h-4" />
                  <span>{ticket.session?.start_time} - {ticket.session?.end_time}</span>
                </div>
              </div>
              <div className="py-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">{tCommon('guests')}</p>
                  <p className="font-semibold">{ticket.number_of_guests} {ticket.number_of_guests > 1 ? 'guests' : 'guest'}</p>
                </div>
              </div>
              <div className="py-4 space-y-2">
                <p className="text-sm text-slate-500">{'Contact Information'}</p>
                <p className="font-medium">{ticket.customer_name}</p>
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Phone className="w-4 h-4" />
                  <span>{ticket.customer_phone}</span>
                </div>
              </div>
              <div className="py-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">{tCommon('total')}</span>
                  <span className="text-2xl font-bold text-primary-600">{formatCurrency(ticket.total_amount, currency)}</span>
                </div>
                <div className="mt-2 flex gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    ticket.status === 'valid' 
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                  }`}>
                    {ticket.status.toUpperCase()}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    ticket.payment_status === 'paid'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {ticket.payment_status === 'paid' ? 'PAID' : 'PAY ON ARRIVAL'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ========== ORDER CONFIRMATION (menu_service) ========== */}
        {order && (
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-orange-500 to-amber-500 text-white border-b-0">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <UtensilsCrossed className="w-5 h-5" />
                  {moduleName} Order
                </span>
                <span className="text-sm font-mono bg-white/20 px-3 py-1 rounded-full">
                  #{order.order_number}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-slate-200 dark:divide-slate-700">
              {order.qr_code && (
                <div className="py-6 flex justify-center">
                  <div className="bg-white p-4 rounded-lg shadow-inner">
                    <img src={order.qr_code} alt="Order QR Code" className="w-40 h-40" />
                  </div>
                </div>
              )}
              <div className="py-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                  <Receipt className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Order Type</p>
                  <p className="font-semibold capitalize">{order.order_type ? order.order_type.replace('_', ' ') : 'Order'}</p>
                </div>
              </div>
              {order.table_id && (
                <div className="py-4 flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Table</p>
                    <p className="font-semibold">Table {order.table_id}</p>
                  </div>
                </div>
              )}
              {order.items && order.items.length > 0 && (
                <div className="py-4">
                  <p className="text-sm text-slate-500 mb-3">Items Ordered</p>
                  <div className="space-y-2">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <span className="font-medium bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded text-xs text-orange-700 dark:text-orange-300">
                          {item.quantity}x
                        </span>
                        <span className="text-slate-700 dark:text-slate-300 text-sm">
                          {item.catalog_items?.name || 'Item'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="py-4">
                {(!!order.discount_amount || !!order.tax_amount) && (
                  <div className="mb-3 space-y-1 text-sm text-slate-600 dark:text-slate-400">
                    {!!order.discount_amount && (
                      <div className="flex justify-between">
                        <span>Discount applied</span>
                        <span className="text-green-600">-{formatCurrency(order.discount_amount, currency)}</span>
                      </div>
                    )}
                    {!!order.tax_amount && (
                      <div className="flex justify-between">
                        <span>Tax</span>
                        <span>{formatCurrency(order.tax_amount, currency)}</span>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="font-semibold">{tCommon('total')}</span>
                  <span className="text-2xl font-bold text-orange-600">{formatCurrency(order.total_amount, currency)}</span>
                </div>
                <div className="mt-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    order.status === 'confirmed' || order.status === 'preparing'
                      ? 'bg-blue-100 text-blue-700'
                      : order.status === 'ready'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {order.status?.toUpperCase() || 'PENDING'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ========== BOOKING CONFIRMATION (multi_day_booking) ========== */}
        {booking && (
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-emerald-600 to-teal-500 text-white border-b-0">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Home className="w-5 h-5" />
                  {moduleName} Booking
                </span>
                <span className="text-sm font-mono bg-white/20 px-3 py-1 rounded-full">
                  #{booking.booking_number}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-slate-200 dark:divide-slate-700">
              {booking.unit?.name && (
                <div className="py-4 flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                    <Home className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Unit</p>
                    <p className="font-semibold">{booking.unit.name}</p>
                  </div>
                </div>
              )}
              <div className="py-4 flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-primary-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-500">Check-in / Check-out</p>
                  <p className="font-semibold">
                    {formatDate(booking.check_in_date)} — {formatDate(booking.check_out_date)}
                  </p>
                </div>
              </div>
              <div className="py-4 space-y-2">
                <p className="text-sm text-slate-500">Guest Details</p>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  <p className="font-medium">{booking.customer_name}</p>
                </div>
                {booking.customer_email && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 ml-6">{booking.customer_email}</p>
                )}
                {booking.guests && (
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-400" />
                    <p className="text-sm">{booking.guests} guests</p>
                  </div>
                )}
              </div>
              {booking.special_requests && (
                <div className="py-4">
                  <p className="text-sm text-slate-500 mb-1">Special Requests</p>
                  <p className="text-slate-700 dark:text-slate-300 text-sm bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                    {booking.special_requests}
                  </p>
                </div>
              )}
              <div className="py-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">{tCommon('total')}</span>
                  <span className="text-2xl font-bold text-emerald-600">{formatCurrency(booking.total_price, currency)}</span>
                </div>
                <div className="mt-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    booking.status === 'confirmed'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {booking.status?.toUpperCase() || 'PENDING'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Note */}
        {ticket && (
          <div className="mt-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              <strong>{'Important Note'}:</strong> {'Please show your QR code at the entrance to gain access.'}
            </p>
          </div>
        )}
        {order && (
          <div className="mt-6 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
            <p className="text-sm text-orange-800 dark:text-orange-300">
              <strong>Note:</strong> Your order is being prepared. You will be notified when it&apos;s ready.
            </p>
          </div>
        )}
        {booking && (
          <div className="mt-6 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
            <p className="text-sm text-emerald-800 dark:text-emerald-300">
              <strong>Note:</strong> A confirmation email has been sent. Please present your booking number at check-in.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-center">
          <Link href={`/${propertySlug}/${slug}`}>
            <Button variant="outline">Back to {moduleName}</Button>
          </Link>
          {ticket && (
            <Button
              variant="outline"
              onClick={() => window.print()}
              className="gap-2"
            >
              <Receipt className="w-4 h-4" />
              Print Ticket
            </Button>
          )}
          <Link href={`/${propertySlug}/profile`}>
            <Button className="gap-2">
              {confirmationType === 'order' ? 'View My Orders' : confirmationType === 'booking' ? 'View My Bookings' : 'View My Tickets'}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
        </Container>
      </Section>
    </div>
  );
}

export default function UnifiedConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    }>
      <ConfirmationContent />
    </Suspense>
  );
}
