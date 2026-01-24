'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  Calendar,
  Clock,
  Home,
  Users,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Mail,
  Phone,
  LogIn,
  LogOut,
  Eye,
  X,
  DollarSign,
  Moon,
} from 'lucide-react';

interface Booking {
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
  created_at: string;
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

const statusConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  pending: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock, label: 'Pending' },
  confirmed: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: CheckCircle2, label: 'Confirmed' },
  checked_in: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: LogIn, label: 'Checked In' },
  checked_out: { color: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300', icon: LogOut, label: 'Checked Out' },
  cancelled: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle, label: 'Cancelled' },
  no_show: { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: XCircle, label: 'No Show' },
};

export default function AdminChaletBookingsPage() {
  const t = useTranslations('adminChalets');
  const tc = useTranslations('adminCommon');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const fetchBookings = useCallback(async () => {
    try {
      const response = await api.get('/chalets/staff/bookings');
      setBookings(response.data.data || []);
    } catch (error) {
      toast.error(tc('errors.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const updateBookingStatus = async (bookingId: string, status: string) => {
    try {
      await api.patch(`/chalets/staff/bookings/${bookingId}/status`, { status });
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: status as Booking['status'] } : b)));
      toast.success(t('bookings.statusUpdated'));
    } catch (error) {
      toast.error(tc('errors.failedToUpdate'));
    }
  };

  const filteredBookings = bookings.filter((b) => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        b.booking_number.toLowerCase().includes(query) ||
        b.chalets?.name?.toLowerCase().includes(query) ||
        b.users?.full_name?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const stats = {
    total: bookings.length,
    confirmed: bookings.filter((b) => b.status === 'confirmed').length,
    checkedIn: bookings.filter((b) => b.status === 'checked_in').length,
    pending: bookings.filter((b) => b.status === 'pending').length,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <CardSkeleton />
      </div>
    );
  }

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('bookings.title')}</h1>
          <p className="text-slate-500 dark:text-slate-400">{tc('all')} {tc('bookings.bookingNumber')}</p>
        </div>
        <Button variant="outline" onClick={fetchBookings}>
          <RefreshCw className="w-4 h-4 mr-2" />
          {tc('refresh')}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm">Total</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total}</p>
                </div>
                <Calendar className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm">Confirmed</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.confirmed}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm">Checked In</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.checkedIn}</p>
                </div>
                <LogIn className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm">Pending</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.pending}</p>
                </div>
                <Clock className="w-8 h-8 text-yellow-500" />
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
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="checked_in">Checked In</option>
              <option value="checked_out">Checked Out</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Bookings */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {filteredBookings.length === 0 ? (
            <div className="text-center py-12">
              <Home className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-slate-500 dark:text-slate-400">{tc('noResults')}</p>
            </div>
          ) : (
            filteredBookings.map((booking, index) => {
              const config = statusConfig[booking.status];
              const StatusIcon = config?.icon || Clock;

              return (
                <motion.div
                  key={booking.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  layout
                >
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex flex-col lg:flex-row gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Home className="w-5 h-5 text-green-500" />
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {booking.chalets?.name || 'Chalet'}
                            </span>
                            <span className="font-mono text-sm text-slate-500">
                              #{booking.booking_number}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config?.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {config?.label}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                            <div>
                              <p className="text-slate-500">Check-in</p>
                              <p className="font-medium text-slate-900 dark:text-white">{new Date(booking.check_in_date).toLocaleDateString()}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Check-out</p>
                              <p className="font-medium text-slate-900 dark:text-white">{new Date(booking.check_out_date).toLocaleDateString()}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Guests</p>
                              <p className="font-medium text-slate-900 dark:text-white flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                {booking.number_of_guests || booking.guests || 1}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">Total</p>
                              <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(booking.total_amount)}</p>
                            </div>
                          </div>

                          {(booking.users || booking.customer_name) && (
                            <div className="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-400">
                              <span className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                {booking.customer_name || booking.users?.full_name}
                              </span>
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
                          )}
                        </div>

                        <div className="flex flex-col gap-2">
                          <Button size="sm" variant="outline" onClick={() => setSelectedBooking(booking)}>
                            <Eye className="w-4 h-4 mr-1" />
                            {tc('details')}
                          </Button>
                          {booking.status === 'pending' && (
                            <Button size="sm" onClick={() => updateBookingStatus(booking.id, 'confirmed')}>
                              {tc('bookings.confirmed')}
                            </Button>
                          )}
                          {booking.status === 'confirmed' && (
                            <Button size="sm" onClick={() => updateBookingStatus(booking.id, 'checked_in')}>
                              <LogIn className="w-4 h-4 mr-1" />
                              {tc('bookings.checkIn')}
                            </Button>
                          )}
                          {booking.status === 'checked_in' && (
                            <Button size="sm" onClick={() => updateBookingStatus(booking.id, 'checked_out')}>
                              <LogOut className="w-4 h-4 mr-1" />
                              {tc('bookings.checkOut')}
                            </Button>
                          )}
                          {(booking.status === 'pending' || booking.status === 'confirmed') && (
                            <Button size="sm" variant="danger" onClick={() => updateBookingStatus(booking.id, 'cancelled')}>
                              {tc('bookings.cancelled')}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Booking Details Modal */}
      <AnimatePresence>
        {selectedBooking && (
          <div 
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedBooking(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('bookings.bookingDetails')}</h2>
                  <p className="text-sm text-slate-500">#{selectedBooking.booking_number}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedBooking(null)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                {/* Chalet & Status */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Chalet</h3>
                    <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <Home className="w-5 h-5 text-green-500" />
                      {selectedBooking.chalets?.name || 'Chalet'}
                    </p>
                    {selectedBooking.chalets?.capacity && (
                      <p className="text-sm text-slate-500 mt-1">Capacity: {selectedBooking.chalets.capacity} guests</p>
                    )}
                  </div>
                  <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Status</h3>
                    {(() => {
                      const config = statusConfig[selectedBooking.status];
                      const StatusIcon = config?.icon || Clock;
                      return (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-medium ${config?.color}`}>
                          <StatusIcon className="w-4 h-4" />
                          {config?.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Stay Details */}
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-3">{t('bookings.stayDetails')}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <p className="text-sm text-slate-500 flex items-center gap-1"><Calendar className="w-3 h-3" /> Check-in</p>
                      <p className="font-medium">{new Date(selectedBooking.check_in_date).toLocaleDateString()}</p>
                    </div>
                    <div className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <p className="text-sm text-slate-500 flex items-center gap-1"><Calendar className="w-3 h-3" /> Check-out</p>
                      <p className="font-medium">{new Date(selectedBooking.check_out_date).toLocaleDateString()}</p>
                    </div>
                    <div className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <p className="text-sm text-slate-500 flex items-center gap-1"><Moon className="w-3 h-3" /> Nights</p>
                      <p className="font-medium">{selectedBooking.number_of_nights || 1}</p>
                    </div>
                    <div className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <p className="text-sm text-slate-500 flex items-center gap-1"><Users className="w-3 h-3" /> Guests</p>
                      <p className="font-medium">{selectedBooking.number_of_guests || selectedBooking.guests || 1}</p>
                    </div>
                  </div>
                </div>

                {/* Customer Info */}
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-3">{t('bookings.customerInfo')}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-500">Name</p>
                      <p className="font-medium">{selectedBooking.customer_name || selectedBooking.users?.full_name || 'Guest'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Email</p>
                      <p className="font-medium">{selectedBooking.customer_email || selectedBooking.users?.email || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Phone</p>
                      <p className="font-medium">{selectedBooking.customer_phone || selectedBooking.users?.phone || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Booked On</p>
                      <p className="font-medium">{new Date(selectedBooking.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                {/* Pricing Breakdown */}
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Pricing</h3>
                  <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                    <div className="flex justify-between">
                      <span className="text-slate-600 dark:text-slate-400">Base Amount</span>
                      <span>{formatCurrency(selectedBooking.base_amount || 0)}</span>
                    </div>
                    {(selectedBooking.add_ons_amount || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-400">Add-ons</span>
                        <span>{formatCurrency(selectedBooking.add_ons_amount || 0)}</span>
                      </div>
                    )}
                    {(selectedBooking.discount_amount || 0) > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount</span>
                        <span>-{formatCurrency(selectedBooking.discount_amount || 0)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-600 font-bold">
                      <span>Total</span>
                      <span className="text-lg text-green-600">{formatCurrency(selectedBooking.total_amount)}</span>
                    </div>
                    {(selectedBooking.deposit_amount || 0) > 0 && (
                      <div className="flex justify-between text-sm text-slate-500">
                        <span>Deposit Required</span>
                        <span>{formatCurrency(selectedBooking.deposit_amount || 0)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Payment Status</p>
                    <p className="font-medium capitalize">{selectedBooking.payment_status || 'pending'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Payment Method</p>
                    <p className="font-medium capitalize">{selectedBooking.payment_method || 'N/A'}</p>
                  </div>
                </div>

                {/* Special Requests */}
                {selectedBooking.special_requests && (
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Special Requests</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-100 dark:border-yellow-900/30">
                      {selectedBooking.special_requests}
                    </p>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                {selectedBooking.status === 'pending' && (
                  <Button onClick={() => { updateBookingStatus(selectedBooking.id, 'confirmed'); setSelectedBooking(null); }}>
                    {tc('bookings.confirmed')}
                  </Button>
                )}
                {selectedBooking.status === 'confirmed' && (
                  <Button onClick={() => { updateBookingStatus(selectedBooking.id, 'checked_in'); setSelectedBooking(null); }}>
                    <LogIn className="w-4 h-4 mr-1" />
                    {tc('bookings.checkIn')}
                  </Button>
                )}
                {selectedBooking.status === 'checked_in' && (
                  <Button onClick={() => { updateBookingStatus(selectedBooking.id, 'checked_out'); setSelectedBooking(null); }}>
                    <LogOut className="w-4 h-4 mr-1" />
                    {tc('bookings.checkOut')}
                  </Button>
                )}
                <Button variant="outline" onClick={() => setSelectedBooking(null)}>{tc('close')}</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
