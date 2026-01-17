'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { useSiteSettings } from '@/lib/settings-context';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
  special_requests?: string;
  notes?: string;
  created_at: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  payment_status?: string;
  module_id?: string;
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

export default function DynamicBookingsPage() {
  const params = useParams();
  const { modules } = useSiteSettings();
  const tc = useTranslations('adminCommon');
  const rawSlug = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  const slug = rawSlug ? decodeURIComponent(rawSlug).toLowerCase() : '';
  const currentModule = modules.find(m => m.slug.toLowerCase() === slug);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const fetchBookings = useCallback(async () => {
    if (!currentModule) return;
    try {
      const response = await api.get('/chalets/staff/bookings', { params: { moduleId: currentModule.id } });
      setBookings(response.data.data || []);
    } catch (error) {
      toast.error(tc('errors.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [currentModule]);

  useEffect(() => {
    if (currentModule) {
      fetchBookings();
    }
  }, [currentModule, fetchBookings]);

  const updateBookingStatus = async (bookingId: string, status: string) => {
    try {
      await api.patch(`/chalets/staff/bookings/${bookingId}/status`, { status });
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: status as Booking['status'] } : b)));
      toast.success(tc('success.updated'));
    } catch (error) {
      toast.error(tc('errors.failedToSave'));
    }
  };

  const filteredBookings = bookings.filter((b) => {
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        b.booking_number.toLowerCase().includes(query) ||
        b.chalets?.name?.toLowerCase().includes(query) ||
        b.users?.full_name?.toLowerCase().includes(query) ||
        b.customer_name?.toLowerCase().includes(query)
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

  if (!currentModule) return null;

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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{currentModule.name} {tc('bookings.title')}</h1>
          <p className="text-slate-500 dark:text-slate-400">{tc('bookings.manageReservations')}</p>
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
                  <p className="text-slate-500 text-sm">{tc('tables.total')}</p>
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
                  <p className="text-slate-500 text-sm">{tc('bookings.confirmed')}</p>
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
                  <p className="text-slate-500 text-sm">{tc('bookings.checkedIn')}</p>
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
                  <p className="text-slate-500 text-sm">{tc('orders.pending')}</p>
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
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder={tc('bookings.searchBookings')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
            >
              <option value="all">{tc('filters.allStatus')}</option>
              <option value="pending">{tc('orders.pending')}</option>
              <option value="confirmed">{tc('bookings.confirmed')}</option>
              <option value="checked_in">{tc('bookings.checkedIn')}</option>
              <option value="checked_out">{tc('bookings.checkedOut')}</option>
              <option value="cancelled">{tc('orders.cancelled')}</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Bookings List */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-900/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">{tc('bookings.bookingNumber')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">{tc('bookings.unit')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">{tc('bookings.guest')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">{tc('bookings.dates')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">{tc('tables.amount')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">{tc('tables.status')}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">{tc('tables.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredBookings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">{tc('bookings.noBookingsFound')}</td>
                  </tr>
                ) : (
                  filteredBookings.map((booking) => {
                    const config = statusConfig[booking.status] || statusConfig.pending;
                    const StatusIcon = config.icon;
                    return (
                      <tr key={booking.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm">{booking.booking_number}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Home className="w-4 h-4 text-slate-400" />
                            <span>{booking.chalets?.name || 'N/A'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-900 dark:text-white">{booking.customer_name || booking.users?.full_name || 'Guest'}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {booking.number_of_guests || booking.guests || 1} guests
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div>{new Date(booking.check_in_date).toLocaleDateString()}</div>
                          <div className="text-slate-500">to {new Date(booking.check_out_date).toLocaleDateString()}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-medium">{formatCurrency(booking.total_amount)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {config.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setSelectedBooking(booking)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                              <Eye className="w-4 h-4 text-blue-500" />
                            </button>
                            {booking.status === 'confirmed' && (
                              <button onClick={() => updateBookingStatus(booking.id, 'checked_in')} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                                <LogIn className="w-4 h-4 text-green-500" />
                              </button>
                            )}
                            {booking.status === 'checked_in' && (
                              <button onClick={() => updateBookingStatus(booking.id, 'checked_out')} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                                <LogOut className="w-4 h-4 text-orange-500" />
                              </button>
                            )}
                            {booking.status === 'pending' && (
                              <>
                                <button onClick={() => updateBookingStatus(booking.id, 'confirmed')} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                                </button>
                                <button onClick={() => updateBookingStatus(booking.id, 'cancelled')} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                                  <XCircle className="w-4 h-4 text-red-500" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Booking Detail Modal */}
      <AnimatePresence>
        {selectedBooking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedBooking(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">{tc('bookings.bookingDetails')}</h3>
                <button onClick={() => setSelectedBooking(null)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500">{tc('bookings.bookingNumber')}</p>
                  <p className="font-mono font-bold text-lg">{selectedBooking.booking_number}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">{tc('bookings.unit')}</p>
                    <p className="font-medium">{selectedBooking.chalets?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{tc('tables.status')}</p>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig[selectedBooking.status]?.color}`}>
                      {statusConfig[selectedBooking.status]?.label}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-500">{tc('bookings.checkIn')}</p>
                    <p className="font-medium">{new Date(selectedBooking.check_in_date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">{tc('bookings.checkOut')}</p>
                    <p className="font-medium">{new Date(selectedBooking.check_out_date).toLocaleDateString()}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-500">{tc('bookings.guest')}</p>
                  <p className="font-medium">{selectedBooking.customer_name || selectedBooking.users?.full_name || 'Guest'}</p>
                  {(selectedBooking.customer_email || selectedBooking.users?.email) && (
                    <p className="text-sm text-slate-500 flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {selectedBooking.customer_email || selectedBooking.users?.email}
                    </p>
                  )}
                  {(selectedBooking.customer_phone || selectedBooking.users?.phone) && (
                    <p className="text-sm text-slate-500 flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {selectedBooking.customer_phone || selectedBooking.users?.phone}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-slate-500">{tc('tables.totalAmount')}</p>
                  <p className="font-bold text-lg text-green-600">{formatCurrency(selectedBooking.total_amount)}</p>
                </div>
                {selectedBooking.special_requests && (
                  <div>
                    <p className="text-sm text-slate-500">{tc('bookings.specialRequests')}</p>
                    <p className="text-sm">{selectedBooking.special_requests}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
