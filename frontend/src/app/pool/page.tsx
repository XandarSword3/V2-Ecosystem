'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { poolApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { useSiteSettings } from '@/lib/settings-context';
import { useContentTranslation } from '@/lib/translate';
import { useAuth } from '@/lib/auth-context';
import { useSocket } from '@/lib/socket';
import { Loader2, Waves, Users, Clock, Calendar, AlertCircle, Ticket, Droplets, Sun, Umbrella, QrCode, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

interface PoolSession {
  id: string;
  name: string;
  name_ar?: string;
  name_fr?: string;
  // Support both snake_case (from API) and camelCase
  start_time?: string;
  end_time?: string;
  max_capacity?: number;
  is_active?: boolean;
  startTime?: string;
  endTime?: string;
  maxCapacity?: number;
  price: number | string; // API may return as string
  isActive?: boolean;
  availability?: {
    ticketsSold: number;
    remaining: number;
  };
}

// Helper to normalize session data from API
function normalizeSession(session: any): PoolSession {
  return {
    ...session,
    startTime: session.startTime || session.start_time,
    endTime: session.endTime || session.end_time,
    maxCapacity: session.maxCapacity || session.max_capacity || 50,
    isActive: session.isActive ?? session.is_active ?? true,
    price: Number(session.price) || 0,
  };
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

export default function PoolPage() {
  const t = useTranslations('pool');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { user } = useAuth();
  const { settings } = useSiteSettings();
  const currency = useSettingsStore((s) => s.currency);
  const { translateContent } = useContentTranslation();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSession, setSelectedSession] = useState<PoolSession | null>(null);
  const [guestCount, setGuestCount] = useState(1);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [showBookingForm, setShowBookingForm] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['pool-sessions', selectedDate],
    queryFn: () => poolApi.getSessions(selectedDate),
  });

  // Fetch user's tickets if logged in
  const { data: myTicketsData } = useQuery({
    queryKey: ['my-pool-tickets'],
    queryFn: () => poolApi.getMyTickets(),
    enabled: !!user,
  });
  const myTickets = myTicketsData?.data?.data || [];

  const purchaseMutation = useMutation({
    mutationFn: (data: any) => poolApi.purchaseTicket(data),
    onSuccess: (response) => {
      toast.success(t('ticketPurchased'));
      const ticket = response.data.data;
      router.push(`/pool/confirmation?id=${ticket.id}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || t('purchaseFailed'));
    },
  });

  const { socket } = useSocket();

  useEffect(() => {
    if (socket) {
      const handleUpdate = (data: any) => {
        // If the update is for the current business area and selected date, refetch
        const updateDate = data.ticketDate || data.ticket_date;
        if (updateDate && updateDate.split('T')[0] === selectedDate) {
          refetch();
        }
      };

      socket.on('pool:ticket:new', handleUpdate);
      socket.on('pool:ticket:updated', handleUpdate);

      return () => {
        socket.off('pool:ticket:new', handleUpdate);
        socket.off('pool:ticket:updated', handleUpdate);
      };
    }
  }, [socket, selectedDate, refetch]);

  const rawSessions = data?.data?.data || [];

  const sessions: PoolSession[] = rawSessions.map(normalizeSession);

  const handlePurchase = async () => {
    if (!selectedSession) {
      toast.error(t('selectSession'));
      return;
    }
    if (!customerName.trim() || !customerPhone.trim()) {
      toast.error(t('fillContactInfo'));
      return;
    }

    purchaseMutation.mutate({
      sessionId: selectedSession.id,
      ticketDate: selectedDate,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      numberOfGuests: guestCount,
      paymentMethod: 'cash',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">{tCommon('loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{tCommon('error')}</h2>
          <p className="text-slate-600 dark:text-slate-400">{tCommon('tryAgainLater')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-cyan-50 to-white dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Hero Section */}
      <div className="relative h-80 bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-400 dark:from-blue-800 dark:via-cyan-700 dark:to-teal-600 overflow-hidden">
        {/* Animated water waves */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg className="w-full h-24 fill-blue-50 dark:fill-slate-900" viewBox="0 0 1440 120" preserveAspectRatio="none">
            <motion.path
              d="M0,0 C360,80 720,40 1080,80 C1260,100 1380,60 1440,80 L1440,120 L0,120 Z"
              animate={{
                d: [
                  "M0,40 C360,80 720,40 1080,80 C1260,100 1380,60 1440,80 L1440,120 L0,120 Z",
                  "M0,60 C360,40 720,80 1080,40 C1260,60 1380,100 1440,60 L1440,120 L0,120 Z",
                  "M0,40 C360,80 720,40 1080,80 C1260,100 1380,60 1440,80 L1440,120 L0,120 Z"
                ]
              }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            />
          </svg>
        </div>

        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="text-center text-white px-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center justify-center mb-4">
              <Waves className="w-12 h-12 mr-3" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">{settings.poolName || t('title')}</h1>
            <p className="text-lg md:text-xl opacity-90 max-w-2xl mx-auto">{t('subtitle')}</p>
          </motion.div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-8 relative z-10">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Sessions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Date Picker */}
            <motion.div
              className="card p-6 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <label className="label flex items-center text-slate-900 dark:text-white text-lg font-semibold mb-3">
                <Calendar className="w-6 h-6 mr-2 text-blue-500" />
                {t('selectDate')}
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="input text-lg py-3 bg-slate-50 dark:bg-slate-700"
              />
            </motion.div>

            <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center">
              <Sun className="w-6 h-6 mr-2 text-yellow-500" />
              {t('availableSessions', { date: formatDate(selectedDate) })}
            </h2>

            {sessions.length > 0 ? (
              <motion.div
                className="space-y-4"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                {sessions.map((session, index) => {
                  const remaining = session.availability?.remaining ?? session.maxCapacity ?? 50;
                  const isSoldOut = remaining === 0;
                  const isSelected = selectedSession?.id === session.id;

                  return (
                    <motion.div
                      key={session.id}
                      variants={cardVariants}
                      className={`card p-6 cursor-pointer transition-all duration-300 bg-white dark:bg-slate-800 border-2 rounded-xl ${isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg shadow-blue-200 dark:shadow-blue-900/30'
                          : isSoldOut
                            ? 'border-slate-200 dark:border-slate-700 opacity-60 cursor-not-allowed'
                            : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 hover:shadow-lg'
                        }`}
                      onClick={() => !isSoldOut && setSelectedSession(session)}
                      whileHover={!isSoldOut ? { scale: 1.02 } : {}}
                      whileTap={!isSoldOut ? { scale: 0.98 } : {}}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                            <Droplets className="w-5 h-5 mr-2 text-blue-500" />
                            {translateContent(session, 'name')}
                          </h3>
                          <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400 mt-2">
                            <span className="flex items-center bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full text-sm">
                              <Clock className="w-4 h-4 mr-1" />
                              {session.startTime} - {session.endTime}
                            </span>
                            <span className={`flex items-center px-3 py-1 rounded-full text-sm ${remaining < 10 ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                                remaining < 20 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' :
                                  'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                              }`}>
                              <Users className="w-4 h-4 mr-1" />
                              {remaining} {tCommon('spotsLeft', { count: remaining })}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                            {formatCurrency(session.price, currency)}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{tCommon('perPerson')}</p>
                        </div>
                      </div>

                      {/* Capacity Bar */}
                      <div className="mt-4">
                        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                          <span>{t('capacity')}</span>
                          <span>{remaining}/{session.maxCapacity}</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                          <motion.div
                            className={`h-3 rounded-full ${remaining < 10 ? 'bg-gradient-to-r from-red-500 to-red-400' :
                                remaining < 20 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                                  'bg-gradient-to-r from-green-500 to-emerald-400'
                              }`}
                            initial={{ width: 0 }}
                            animate={{ width: `${(remaining / (session.maxCapacity ?? 50)) * 100}%` }}
                            transition={{ duration: 0.8, delay: index * 0.1 }}
                          />
                        </div>
                      </div>

                      {isSoldOut && (
                        <div className="mt-3">
                          <span className="badge badge-danger text-sm px-4 py-1">{tCommon('soldOut')}</span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>
            ) : (
              <motion.div
                className="card p-12 text-center bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <Waves className="w-16 h-16 text-blue-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">{t('noSessionsAvailable')}</h3>
                <p className="text-slate-600 dark:text-slate-400">{t('selectDifferentDate')}</p>
              </motion.div>
            )}
          </div>

          {/* Booking Summary */}
          <div className="lg:col-span-1">
            <motion.div
              className="card sticky top-24 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl shadow-xl overflow-hidden"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <div className="card-header border-b dark:border-slate-700 bg-gradient-to-r from-blue-600 to-cyan-500 p-4">
                <h3 className="font-bold text-white flex items-center text-lg">
                  <Ticket className="w-6 h-6 mr-2" />
                  {t('yourBooking')}
                </h3>
              </div>
              <div className="card-body p-6 space-y-4">
                {selectedSession ? (
                  <>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="font-medium text-slate-900 dark:text-white">{selectedSession.name}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {formatDate(selectedDate)} • {selectedSession.startTime} - {selectedSession.endTime}
                      </p>
                    </div>

                    <div>
                      <label className="label text-slate-900 dark:text-white">{t('numberOfGuests')}</label>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setGuestCount(Math.max(1, guestCount - 1))}
                          className="btn btn-outline px-3"
                        >
                          -
                        </button>
                        <span className="text-xl font-semibold w-12 text-center text-slate-900 dark:text-white">{guestCount}</span>
                        <button
                          onClick={() => setGuestCount(Math.min(10, guestCount + 1))}
                          className="btn btn-outline px-3"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-3">
                      <div>
                        <label className="label text-slate-900 dark:text-white">{t('yourName')}</label>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder={t('enterYourName')}
                          className="input w-full"
                        />
                      </div>
                      <div>
                        <label className="label text-slate-900 dark:text-white">{t('phoneNumber')}</label>
                        <input
                          type="tel"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder={t('enterPhoneNumber')}
                          className="input w-full"
                        />
                      </div>
                    </div>

                    <div className="border-t dark:border-slate-700 pt-4">
                      <div className="flex justify-between mb-2">
                        <span className="text-slate-600 dark:text-slate-400">
                          {guestCount} × {formatCurrency(selectedSession.price, currency)}
                        </span>
                        <span className="font-medium text-slate-900 dark:text-white">
                          {formatCurrency(Number(selectedSession.price) * guestCount, currency)}
                        </span>
                      </div>
                      <div className="flex justify-between text-lg font-bold">
                        <span className="text-slate-900 dark:text-white">{tCommon('total')}</span>
                        <span className="text-blue-600 dark:text-blue-400">
                          {formatCurrency(Number(selectedSession.price) * guestCount, currency)}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={handlePurchase}
                      disabled={purchaseMutation.isPending}
                      className="btn btn-primary w-full"
                    >
                      {purchaseMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 animate-spin mr-2" />{tCommon('processing')}</>
                      ) : (
                        t('purchaseTickets')
                      )}
                    </button>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-slate-500 dark:text-slate-400">{t('selectSessionToContinue')}</p>
                  </div>
                )}
              </div>

              <div className="card-footer border-t dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('nonRefundable')}
                </p>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Your Tickets Section - Only show if user is logged in and has tickets */}
        {user && myTickets.length > 0 && (
          <motion.div
            className="mt-12 bg-white dark:bg-slate-800 rounded-xl p-6 border dark:border-slate-700 shadow-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6 flex items-center">
              <Ticket className="w-6 h-6 mr-2 text-blue-500" />
              {t('yourTickets')}
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myTickets.slice(0, 6).map((ticket: any) => (
                <Link
                  key={ticket.id}
                  href={`/pool/confirmation?id=${ticket.id}`}
                  className="block p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg border border-blue-100 dark:border-blue-800 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-mono text-sm text-blue-600 dark:text-blue-400">
                      #{ticket.ticket_number}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${ticket.status === 'valid'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : ticket.status === 'used'
                          ? 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      }`}>
                      {ticket.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="font-medium text-slate-900 dark:text-white mb-1">
                    {formatDate(ticket.ticket_date)}
                  </p>
                  <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
                    <span className="flex items-center">
                      <Users className="w-4 h-4 mr-1" />
                      {ticket.number_of_guests} {ticket.number_of_guests > 1 ? 'guests' : 'guest'}
                    </span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {formatCurrency(ticket.total_amount, currency)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center text-xs text-blue-600 dark:text-blue-400">
                    <span>View ticket</span>
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </div>
                </Link>
              ))}
            </div>
            {myTickets.length > 6 && (
              <div className="mt-4 text-center">
                <Link href="/profile" className="text-blue-600 dark:text-blue-400 hover:underline">
                  {t('viewAllTickets')} ({myTickets.length})
                </Link>
              </div>
            )}
          </motion.div>
        )}

        {/* Info Section */}
        <div className="mt-12 bg-white dark:bg-slate-800 rounded-lg p-8 border dark:border-slate-700">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">{t('poolInfo.title')}</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{t('poolInfo.hoursTitle')}</h3>
              <p className="text-slate-600 dark:text-slate-400">
                {t('poolInfo.hours')}
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{t('poolInfo.whatToBring')}</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Swimwear, towel, sunscreen<br />
                Lockers available for valuables
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{t('poolInfo.amenitiesTitle')}</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Changing rooms, showers<br />
                Snack bar nearby, loungers included
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
