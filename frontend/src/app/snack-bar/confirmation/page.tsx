'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  CheckCircle2,
  Clock,
  Phone,
  MapPin,
  ArrowRight,
  Loader2,
  AlertCircle,
  Cookie,
  Hash,
} from 'lucide-react';
import { QRCode } from '@/components/ui/QRCode';

interface SnackOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  pickup_location: string;
  total_amount: number;
  status: string;
  payment_method: string;
  payment_status: string;
  notes?: string;
  created_at: string;
  items?: {
    snack_items: {
      name: string;
    };
    quantity: number;
    unit_price: number;
    subtotal: number;
  }[];
}

function SnackConfirmationContent() {
  const searchParams = useSearchParams();
  const t = useTranslations('snackBar');
  const tCommon = useTranslations('common');
  const currency = useSettingsStore((s) => s.currency);
  const [order, setOrder] = useState<SnackOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const orderId = searchParams.get('id');

  useEffect(() => {
    if (orderId) {
      fetchOrder();
    } else {
      setError('No order ID provided');
      setLoading(false);
    }
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      const response = await api.get(`/snack/orders/${orderId}`);
      setOrder(response.data.data);
    } catch (err) {
      setError('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{error || 'Order not found'}</h2>
            <Link href="/snack-bar">
              <Button className="mt-4">{t('backToSnackBar')}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    preparing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    ready: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    completed: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 py-12">
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
            className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <CheckCircle2 className="w-10 h-10 text-amber-600 dark:text-amber-400" />
          </motion.div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            {t('orderConfirmed')}
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {t('orderConfirmationMessage')}
          </p>
        </motion.div>

        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-b-0">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Cookie className="w-5 h-5" />
                {t('orderDetails')}
              </span>
              <span className="text-sm font-mono bg-white/20 px-3 py-1 rounded-full">
                #{order.order_number}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-slate-200 dark:divide-slate-700">
            {/* QR Code */}
            <div className="py-6 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800/50">
              <QRCode value={order.id} size={160} />
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {t('qrCode')}
              </p>
            </div>

            {/* Status */}
            <div className="py-4 flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">{tCommon('status')}</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[order.status] || statusColors.pending}`}>
                {order.status.toUpperCase()}
              </span>
            </div>

            {/* Pickup Location */}
            <div className="py-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                <MapPin className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">{t('pickupLocation')}</p>
                <p className="font-semibold">{order.pickup_location || 'Snack Bar Counter'}</p>
              </div>
            </div>

            {/* Estimated Time */}
            <div className="py-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">{t('estimatedTime')}</p>
                <p className="font-semibold">10-15 {t('minutes')}</p>
              </div>
            </div>

            {/* Contact */}
            <div className="py-4 space-y-2">
              <p className="font-medium">{order.customer_name}</p>
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Phone className="w-4 h-4" />
                <span>{order.customer_phone}</span>
              </div>
            </div>

            {/* Order Items */}
            <div className="py-4">
              <p className="text-sm text-slate-500 mb-3">{t('orderItems')}</p>
              <div className="space-y-2">
                {order.items?.map((item, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center text-xs font-medium">
                        {item.quantity}
                      </span>
                      <span>{item.snack_items?.name}</span>
                    </div>
                    <span className="font-medium">{formatCurrency(item.subtotal, currency)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="py-4">
              <div className="flex justify-between items-center">
                <span className="font-semibold">{tCommon('total')}</span>
                <span className="text-2xl font-bold text-amber-600">{formatCurrency(order.total_amount, currency)}</span>
              </div>
              <div className="mt-2">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  order.payment_status === 'paid'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {order.payment_status === 'paid' ? 'PAID' : `PAY ON PICKUP (${order.payment_method?.toUpperCase() || 'CASH'})`}
                </span>
              </div>
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="py-4">
                <p className="text-sm text-slate-500 mb-1">{t('specialNotes')}</p>
                <p className="text-sm">{order.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <strong>{t('tip')}:</strong> {t('weWillCallWhenReady')}
          </p>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/snack-bar">
            <Button variant="outline">{t('orderMore')}</Button>
          </Link>
          <Link href="/profile">
            <Button className="gap-2">
              {t('viewMyOrders')}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SnackConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    }>
      <SnackConfirmationContent />
    </Suspense>
  );
}
