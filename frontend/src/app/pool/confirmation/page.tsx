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
  Clock,
  Mail,
  Phone,
  ArrowRight,
  Loader2,
  AlertCircle,
  Waves,
  Download,
  QrCode,
} from 'lucide-react';

interface PoolTicket {
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

function PoolConfirmationContent() {
  const searchParams = useSearchParams();
  const t = useTranslations('pool');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const currency = useSettingsStore((s) => s.currency);
  const [ticket, setTicket] = useState<PoolTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const ticketId = searchParams.get('id');

  useEffect(() => {
    if (ticketId) {
      fetchTicket();
    } else {
      setError(tErrors('noTicketId'));
      setLoading(false);
    }
  }, [ticketId]);

  const fetchTicket = async () => {
    try {
      const response = await api.get(`/pool/tickets/${ticketId}`);
      setTicket(response.data.data);
    } catch (err) {
      setError(tErrors('failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800">
        <Card className="max-w-md mx-auto">
          <CardContent className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{error || tErrors('ticketNotFound')}</h2>
            <Link href="/pool">
              <Button className="mt-4">{t('backToPool')}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-cyan-50 to-white dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 py-12">
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
            className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <CheckCircle2 className="w-10 h-10 text-blue-600 dark:text-blue-400" />
          </motion.div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            {t('ticketConfirmed')}
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            {t('ticketConfirmationMessage')}
          </p>
        </motion.div>

        <Card className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white border-b-0">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Waves className="w-5 h-5" />
                {t('poolTicket')}
              </span>
              <span className="text-sm font-mono bg-white/20 px-3 py-1 rounded-full">
                #{ticket.ticket_number}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-slate-200 dark:divide-slate-700">
            {/* QR Code */}
            {ticket.qr_code && (
              <div className="py-6 flex justify-center">
                <div className="bg-white p-4 rounded-lg shadow-inner">
                  <img 
                    src={ticket.qr_code} 
                    alt="Ticket QR Code" 
                    className="w-40 h-40"
                  />
                </div>
              </div>
            )}

            {/* Session */}
            <div className="py-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <Waves className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">{t('sessionLabel')}</p>
                <p className="font-semibold">{ticket.session?.name || 'Pool Session'}</p>
              </div>
            </div>

            {/* Date & Time */}
            <div className="py-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-primary-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-500">{t('date')}</p>
                <p className="font-semibold">{formatDate(ticket.ticket_date)}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Clock className="w-4 h-4" />
                <span>{ticket.session?.start_time} - {ticket.session?.end_time}</span>
              </div>
            </div>

            {/* Guests */}
            <div className="py-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">{tCommon('guests')}</p>
                <p className="font-semibold">{ticket.number_of_guests} {ticket.number_of_guests > 1 ? 'guests' : 'guest'}</p>
              </div>
            </div>

            {/* Contact */}
            <div className="py-4 space-y-2">
              <p className="text-sm text-slate-500">{t('contactInfo')}</p>
              <p className="font-medium">{ticket.customer_name}</p>
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Phone className="w-4 h-4" />
                <span>{ticket.customer_phone}</span>
              </div>
            </div>

            {/* Total */}
            <div className="py-4">
              <div className="flex justify-between items-center">
                <span className="font-semibold">{tCommon('total')}</span>
                <span className="text-2xl font-bold text-blue-600">{formatCurrency(ticket.total_amount, currency)}</span>
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

        <div className="mt-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <strong>{t('importantNote')}:</strong> {t('showQrAtEntrance')}
          </p>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/pool">
            <Button variant="outline">{t('backToPool')}</Button>
          </Link>
          <Link href="/profile">
            <Button className="gap-2">
              {t('viewMyTickets')}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function PoolConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    }>
      <PoolConfirmationContent />
    </Suspense>
  );
}
