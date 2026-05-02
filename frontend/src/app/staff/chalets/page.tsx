'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { bookingsStore, cacheManager, isOnline } from '@/lib/offline/offline-storage';
import { createOfflineBookingStatusUpdate, createOfflineCashPayment } from '@/lib/offline/offline-sync';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import { useSocket } from '@/lib/socket';
import { DataFreshnessFooter } from '@/components/offline/DataFreshnessFooter';
import {
  Home,
  Clock,
  CheckCircle2,
  LogIn,
  LogOut,
  Calendar,
  Users,
  Phone,
  Mail,
  RefreshCw,
  Search,
  AlertCircle,
  Sparkles,
  XCircle,
} from 'lucide-react';

interface ChaletBooking {
  id: string;
  booking_number: string;
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
  check_in_date: string;
  check_out_date: string;
  total_amount: number;
  guests?: number;
  number_of_guests?: number;
  number_of_nights?: number;
  base_amount?: number;
  add_ons_amount?: number;
  discount_amount?: number;
  deposit_amount?: number;
  special_requests?: string;
  notes?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  payment_status?: string;
  payment_method?: string;
  chalets?: {
    id?: string;
    name: string;
    capacity: number;
  };
  users?: {
    full_name: string;
    email: string;
    phone?: string;
  };
}

// IMPROVE Iter-24: Split statusConfig — colors/icons outside, labels inside component with i18n
const statusConfigBase: Record<string, { color: string; icon: React.ElementType }> = {
  pending: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
  confirmed: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: CheckCircle2 },
  checked_in: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: LogIn },
  checked_out: { color: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300', icon: LogOut },
  cancelled: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: AlertCircle },
  no_show: { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: AlertCircle },
};

export default function StaffChaletsPage() {
  const t = useTranslations('staff');
  const tc = useTranslations('staff.chalets');
  const tst = useTranslations('staff.statuses');
  const tCommon = useTranslations('adminCommon');

  // IMPROVE Iter-24: i18n status labels via tst() hook
  const statusConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
    pending: { ...statusConfigBase.pending, label: tst('pending') },
    confirmed: { ...statusConfigBase.confirmed, label: tst('confirmed') },
    checked_in: { ...statusConfigBase.checked_in, label: tst('checked_in') },
    checked_out: { ...statusConfigBase.checked_out, label: tst('checked_out') },
    cancelled: { ...statusConfigBase.cancelled, label: tst('cancelled') },
    no_show: { ...statusConfigBase.no_show, label: tst('no_show') },
  };
  const [bookings, setBookings] = useState<ChaletBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'today' | 'all'>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<ChaletBooking | null>(null);
  const { socket } = useSocket();

  const fetchBookings = useCallback(async (signal?: AbortSignal) => {
    // 1. Load from offline store immediately
    const offlineBookings = await bookingsStore.getAll();
    if (offlineBookings.length > 0) {
      setBookings(offlineBookings as unknown as ChaletBooking[]);
      setLoading(false); // UI is now interactive with cached data
    }

    // 2. Refresh from API in background if online
    if (isOnline()) {
      try {
        const response = await api.get('/chalets/staff/bookings', {
          params: filter === 'today' ? { date: new Date().toISOString().split('T')[0] } : {},
          signal,
        });
        
        if (!signal?.aborted) {
          const freshData = response.data.data || [];
          setBookings(freshData);
          setLoading(false);
          
          // 3. Update offline store with fresh data
          await bookingsStore.clear();
          await bookingsStore.putMany(freshData);
          await cacheManager.updateMetadata('bookings', freshData.length);
        }
      } catch (error: any) {
        if (error?.name === 'CanceledError') return;
        console.error('Background refresh failed:', error);
        // We stay with cached data, no need to show error if we have cache
        if (offlineBookings.length === 0) {
          toast.error(tCommon('errors.failedToLoad'));
          setBookings([]);
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    } else if (offlineBookings.length === 0) {
      // Offline and no cache
      toast.error(tCommon('errors.failedToLoad'));
      setLoading(false);
    }
  }, [filter, isOnline]);

  useEffect(() => {
    const controller = new AbortController(); // FIX Iter-23: cleanup on unmount
    fetchBookings(controller.signal);
    return () => controller.abort();
  }, [fetchBookings]);

  // Real-time updates
  useEffect(() => {
    if (socket) {
      socket.on('chalet:booking:updated', (booking: ChaletBooking) => {
        setBookings((prev) =>
          prev.map((b) => (b.id === booking.id ? booking : b))
        );
        toast.info(`Booking ${booking.booking_number} updated`);
      });

      return () => {
        socket.off('chalet:booking:updated');
      };
    }
  }, [socket]);

  const updateBookingStatus = async (bookingId: string, newStatus: string) => {
    try {
      await api.patch(`/chalets/staff/bookings/${bookingId}/status`, { status: newStatus });
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus as ChaletBooking['status'] } : b))
      );
      toast.success(tCommon('success.updated'));
    } catch (error) {
      // Offline fallback
      await createOfflineBookingStatusUpdate(bookingId, newStatus);
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus as ChaletBooking['status'] } : b))
      );
      toast.warning(tCommon('offline.actionQueued'));
    }
  };

  const filteredBookings = bookings.filter((b) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        b.booking_number.toLowerCase().includes(query) ||
        b.chalets?.name.toLowerCase().includes(query) ||
        b.users?.full_name?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const todayCheckIns = bookings.filter(
    (b) => b.check_in_date === new Date().toISOString().split('T')[0] && b.status !== 'checked_in'
  ).length;
  const todayCheckOuts = bookings.filter(
    (b) => b.check_out_date === new Date().toISOString().split('T')[0] && b.status === 'checked_in'
  ).length;
  const currentlyOccupied = bookings.filter((b) => b.status === 'checked_in').length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <CardSkeleton />
      </div>
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Home className="w-7 h-7 text-green-500" />
            {tc('title')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            {tc('subtitle')}
          </p>
        </div>
        <Button variant="outline" onClick={() => fetchBookings()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          {tc('refresh')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <motion.div variants={fadeInUp}>
          <Card className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">{tc('todaysCheckIns')}</p>
                  <p className="text-3xl font-bold">{todayCheckIns}</p>
                </div>
                <LogIn className="w-10 h-10 text-blue-200" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="bg-gradient-to-br from-orange-500 to-red-500 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm">{tc('todaysCheckOuts')}</p>
                  <p className="text-3xl font-bold">{todayCheckOuts}</p>
                </div>
                <LogOut className="w-10 h-10 text-orange-200" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="bg-gradient-to-br from-green-500 to-emerald-500 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">{tc('currentlyOccupied')}</p>
                  <p className="text-3xl font-bold">{currentlyOccupied}</p>
                </div>
                <Home className="w-10 h-10 text-green-200" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={tc('searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
              <button
                onClick={() => setFilter('today')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === 'today'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {tc('today')}
              </button>
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {tc('allBookings')}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bookings List */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {filteredBookings.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <Home className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-slate-500 dark:text-slate-400">{tc('noBookings')}</p>
            </motion.div>
          ) : (
            filteredBookings.map((booking, index) => {
              const config = statusConfig[booking.status];
              const StatusIcon = config?.icon || Clock;
              const isCheckInDay = booking.check_in_date === new Date().toISOString().split('T')[0];
              const isCheckOutDay = booking.check_out_date === new Date().toISOString().split('T')[0];

              return (
                <motion.div
                  key={booking.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.05 }}
                  layout
                  onClick={() => setSelectedBooking(booking)}
                  className="cursor-pointer"
                >
                  <Card className={`hover:shadow-lg transition-all ${
                    isCheckInDay && booking.status === 'confirmed' ? 'ring-2 ring-blue-400' :
                    isCheckOutDay && booking.status === 'checked_in' ? 'ring-2 ring-orange-400' : ''
                  }`}>
                    <CardContent className="p-6">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        {/* Chalet Info */}
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Home className="w-5 h-5 text-green-500" />
                            <h3 className="font-semibold text-lg text-slate-900 dark:text-white">
                              {booking.chalets?.name || 'Chalet'}
                            </h3>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config?.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {tst(booking.status)}
                            </span>
                            {isCheckInDay && booking.status === 'confirmed' && (
                              <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded">
                                {tc('checkInToday')}
                              </span>
                            )}
                            {isCheckOutDay && booking.status === 'checked_in' && (
                              <span className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-0.5 rounded">
                                {tc('checkOutToday')}
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">{tc('bookingNumber')}</span>
                              <p className="font-medium text-slate-900 dark:text-white">{booking.booking_number}</p>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">{tc('checkIn')}</span>
                              <p className="font-medium text-slate-900 dark:text-white">{new Date(booking.check_in_date).toLocaleDateString()}</p>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">{tc('checkOut')}</span>
                              <p className="font-medium text-slate-900 dark:text-white">{new Date(booking.check_out_date).toLocaleDateString()}</p>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">{tc('guests')}</span>
                              <p className="font-medium text-slate-900 dark:text-white flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                {booking.number_of_guests || booking.guests || 1}
                              </p>
                            </div>
                          </div>

                          {/* Guest Info */}
                          {(booking.users || booking.customer_name) && (
                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                              <p className="font-medium text-slate-900 dark:text-white">
                                {booking.customer_name || booking.users?.full_name}
                              </p>
                              <div className="flex flex-wrap gap-4 mt-1 text-sm text-slate-500 dark:text-slate-400">
                                <span className="flex items-center gap-1">
                                  <Mail className="w-4 h-4" />
                                  {booking.customer_email || booking.users?.email}
                                </span>
                                {(booking.customer_phone || booking.users?.phone) && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-4 h-4" />
                                    {booking.customer_phone || booking.users?.phone}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2">
                          <p className="text-xl font-bold text-slate-900 dark:text-white text-right">
                            {formatCurrency(booking.total_amount)}
                          </p>

                          {booking.status === 'confirmed' && (
                            <Button onClick={() => updateBookingStatus(booking.id, 'checked_in')}>
                              <LogIn className="w-4 h-4 mr-2" />
                              {tc('checkInAction')}
                            </Button>
                          )}
                          {booking.status === 'checked_in' && (
                            <Button onClick={() => updateBookingStatus(booking.id, 'checked_out')}>
                              <LogOut className="w-4 h-4 mr-2" />
                              {tc('checkOutAction')}
                            </Button>
                          )}
                          {booking.status === 'pending' && (
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => updateBookingStatus(booking.id, 'confirmed')}>
                                {tc('confirm')}
                              </Button>
                              <Button size="sm" variant="danger" onClick={() => updateBookingStatus(booking.id, 'cancelled')}>
                                {tc('cancel')}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      {booking.notes && (
                        <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                          <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            <strong>{tc('notes')}:</strong> {booking.notes}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

       {/* Chalet Booking Details Modal */}
       <AnimatePresence>
        {selectedBooking && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            role="dialog" // FIX Iter-22: modal a11y
            aria-modal="true"
            aria-labelledby="chalets-booking-detail-title"
            onClick={() => setSelectedBooking(null)}
            onKeyDown={(e) => { if (e.key === 'Escape') setSelectedBooking(null); }} // FIX Iter-22: Escape to close
          >
             <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <div>
                  <h2 id="chalets-booking-detail-title" className="text-2xl font-bold text-slate-900 dark:text-white">
                    Booking #{selectedBooking.booking_number}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {selectedBooking.chalets?.name}
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedBooking(null)}
                  aria-label="Close booking details" // FIX Iter-22: close button a11y
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                >
                  <XCircle className="w-6 h-6 text-slate-500" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                
                {/* Status & Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{tc('modalStatus')}</h3>
                     <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-medium ${statusConfig[selectedBooking.status]?.color}`}>
                            {tst(selectedBooking.status)}
                        </span>
                     </div>
                  </div>
                   <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{tc('modalDates')}</h3>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {new Date(selectedBooking.check_in_date).toLocaleDateString()} - {new Date(selectedBooking.check_out_date).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-slate-500">
                        {tc('modalNights', { count: selectedBooking.number_of_nights || 1 })}
                    </p>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">{tc('customerInfo')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <span className="text-xs text-slate-400">{tc('customerName')}</span>
                            <p className="font-medium">{selectedBooking.customer_name || selectedBooking.users?.full_name}</p>
                        </div>
                         <div>
                            <span className="text-xs text-slate-400">{tc('customerEmail')}</span>
                            <p className="font-medium">{selectedBooking.customer_email || selectedBooking.users?.email}</p>
                        </div>
                         <div>
                            <span className="text-xs text-slate-400">{tc('customerPhone')}</span>
                            <p className="font-medium">{selectedBooking.customer_phone || selectedBooking.users?.phone || '-'}</p>
                        </div>
                        <div>
                            <span className="text-xs text-slate-400">{tc('guests')}</span>
                            <p className="font-medium">{selectedBooking.number_of_guests || selectedBooking.guests || 1}</p>
                        </div>
                    </div>
                </div>

                 {/* Financials */}
                 <div className="space-y-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white">{tc('billing')}</h3>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">{tc('baseAmount')}</span>
                        <span>{formatCurrency(selectedBooking.base_amount || selectedBooking.total_amount)}</span>
                    </div>
                     {selectedBooking.add_ons_amount ? (
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">{tc('addOns')}</span>
                            <span>{formatCurrency(selectedBooking.add_ons_amount)}</span>
                        </div>
                     ) : null}
                     <div className="flex justify-between font-bold text-lg pt-2 border-t border-slate-200 dark:border-slate-700">
                        <span>{tc('total')}</span>
                        <span>{formatCurrency(selectedBooking.total_amount)}</span>
                     </div>
                     <div className="flex justify-between text-sm text-slate-500">
                         <span>{tc('paymentStatus')}</span>
                         <span className="capitalize">{selectedBooking.payment_status || tc('paymentPending')}</span>
                     </div>
                 </div>

                 {selectedBooking.special_requests && (
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                        <h3 className="text-sm font-bold text-yellow-800 dark:text-yellow-200 mb-1">{tc('specialRequests')}</h3>
                         <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            {selectedBooking.special_requests}
                        </p>
                    </div>
                 )}

              </div>

              <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                    {/* Action Buttons within Modal */}
                    {selectedBooking.status === 'confirmed' && (
                        <Button onClick={() => {updateBookingStatus(selectedBooking.id, 'checked_in'); setSelectedBooking(null);}}>
                            <LogIn className="w-4 h-4 mr-2" /> {tc('checkInAction')}
                        </Button>
                    )}
                    {selectedBooking.status === 'checked_in' && (
                        <Button onClick={() => {updateBookingStatus(selectedBooking.id, 'checked_out'); setSelectedBooking(null);}}>
                            <LogOut className="w-4 h-4 mr-2" /> {tc('checkOutAction')}
                        </Button>
                    )}
                    {selectedBooking.status === 'pending' && (
                        <Button variant="outline" onClick={() => {updateBookingStatus(selectedBooking.id, 'confirmed'); setSelectedBooking(null);}}>
                            <CheckCircle2 className="w-4 h-4 mr-2" /> {tc('confirmAction')}
                        </Button>
                    )}
                    {selectedBooking.payment_status !== 'paid' && (
                        <Button 
                            variant="default"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={async () => {
                                if (isOnline()) {
                                    await api.post('/payments/cash', { 
                                        referenceType: 'chalet_booking', 
                                        referenceId: selectedBooking.id, 
                                        amount: selectedBooking.total_amount 
                                    });
                                    toast.success('Payment recorded');
                                } else {
                                    await createOfflineCashPayment({ 
                                        referenceType: 'chalet_booking', 
                                        referenceId: selectedBooking.id, 
                                        amount: selectedBooking.total_amount 
                                    });
                                    toast.info('Cash payment queued offline', { icon: '💵' });
                                }
                                setSelectedBooking(null);
                            }}
                        >
                            Record Cash Payment
                        </Button>
                    )}
                    <Button variant="outline" onClick={() => setSelectedBooking(null)}>
                        {tCommon('close')}
                    </Button>
              </div>
            </motion.div>    
          </div>
        )}
      </AnimatePresence>
      {/* Footer */}
      <footer className="mt-8">
        <DataFreshnessFooter storeName="bookings" />
      </footer>
    </motion.div>
  );
}
