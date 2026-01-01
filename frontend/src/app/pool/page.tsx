'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { poolApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { Loader2, Waves, Users, Clock, Calendar, AlertCircle, Ticket } from 'lucide-react';
import { toast } from 'sonner';

interface PoolSession {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  maxCapacity: number;
  price: number;
  isActive: boolean;
  availability?: {
    ticketsSold: number;
    remaining: number;
  };
}

export default function PoolPage() {
  const t = useTranslations('pool');
  const tCommon = useTranslations('common');
  const currency = useSettingsStore((s) => s.currency);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSession, setSelectedSession] = useState<PoolSession | null>(null);
  const [guestCount, setGuestCount] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['pool-sessions', selectedDate],
    queryFn: () => poolApi.getSessions(selectedDate),
  });

  const sessions: PoolSession[] = data?.data?.data || [];

  const handlePurchase = async () => {
    if (!selectedSession) {
      toast.error('Please select a session');
      return;
    }

    // This would normally redirect to checkout
    toast.info('Redirecting to checkout...');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-resort-sand dark:bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-resort-sand dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Error loading pool sessions</h2>
          <p className="text-slate-600 dark:text-slate-400">Please try again later</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-resort-sand dark:bg-slate-900">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{t('title')}</h1>
          <p className="text-slate-600 dark:text-slate-400">{t('subtitle')}</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Sessions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Date Picker */}
            <div className="card p-4 bg-white dark:bg-slate-800 border dark:border-slate-700">
              <label className="label flex items-center text-slate-900 dark:text-white">
                <Calendar className="w-5 h-5 mr-2" />
                {t('selectDate')}
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="input"
              />
            </div>

            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {t('availableSessions', { date: formatDate(selectedDate) })}
            </h2>

            {sessions.length > 0 ? (
              <div className="space-y-4">
                {sessions.map((session) => {
                  const remaining = session.availability?.remaining ?? session.maxCapacity;
                  const isSoldOut = remaining === 0;
                  const isSelected = selectedSession?.id === session.id;

                  return (
                    <div
                      key={session.id}
                      className={`card p-4 cursor-pointer transition-all bg-white dark:bg-slate-800 border dark:border-slate-700 ${
                        isSelected
                          ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : isSoldOut
                          ? 'opacity-60 cursor-not-allowed'
                          : 'hover:shadow-md'
                      }`}
                      onClick={() => !isSoldOut && setSelectedSession(session)}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white">{session.name}</h3>
                          <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400 mt-1">
                            <span className="flex items-center">
                              <Clock className="w-4 h-4 mr-1" />
                              {session.startTime} - {session.endTime}
                            </span>
                            <span className="flex items-center">
                              <Users className="w-4 h-4 mr-1" />
                              {tCommon('spotsLeft', { count: remaining })}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {formatCurrency(session.price, currency)}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{tCommon('perPerson')}</p>
                        </div>
                      </div>

                      {/* Capacity Bar */}
                      <div className="mt-3">
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              remaining < 10 ? 'bg-red-500' : remaining < 20 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{
                              width: `${(remaining / session.maxCapacity) * 100}%`,
                            }}
                          />
                        </div>
                      </div>

                      {isSoldOut && (
                        <div className="mt-2">
                          <span className="badge badge-danger">{tCommon('soldOut')}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="card p-8 text-center bg-white dark:bg-slate-800 border dark:border-slate-700">
                <Waves className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="font-medium text-slate-900 dark:text-white">No sessions available</h3>
                <p className="text-slate-600 dark:text-slate-400">Please select a different date</p>
              </div>
            )}
          </div>

          {/* Booking Summary */}
          <div className="lg:col-span-1">
            <div className="card sticky top-24 bg-white dark:bg-slate-800 border dark:border-slate-700">
              <div className="card-header border-b dark:border-slate-700">
                <h3 className="font-semibold text-slate-900 dark:text-white flex items-center">
                  <Ticket className="w-5 h-5 mr-2" />
                  {t('yourBooking')}
                </h3>
              </div>
              <div className="card-body space-y-4">
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

                    <div className="border-t dark:border-slate-700 pt-4">
                      <div className="flex justify-between mb-2">
                        <span className="text-slate-600 dark:text-slate-400">
                          {guestCount} × {formatCurrency(selectedSession.price, currency)}
                        </span>
                        <span className="font-medium text-slate-900 dark:text-white">
                          {formatCurrency(selectedSession.price * guestCount, currency)}
                        </span>
                      </div>
                      <div className="flex justify-between text-lg font-bold">
                        <span className="text-slate-900 dark:text-white">Total</span>
                        <span className="text-blue-600 dark:text-blue-400">
                          {formatCurrency(selectedSession.price * guestCount, currency)}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={handlePurchase}
                      className="btn btn-primary w-full"
                    >
                      {t('purchaseTickets')}
                    </button>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-slate-500 dark:text-slate-400">Select a session to continue</p>
                  </div>
                )}
              </div>

              <div className="card-footer border-t dark:border-slate-700">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('nonRefundable')}
                </p>
              </div>
            </div>
          </div>
        </div>

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
