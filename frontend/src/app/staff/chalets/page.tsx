'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import { useSocket } from '@/lib/socket';
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
} from 'lucide-react';

interface ChaletBooking {
  id: string;
  booking_number: string;
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
  check_in_date: string;
  check_out_date: string;
  total_amount: number;
  guests: number;
  notes?: string;
  chalets?: {
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
  cancelled: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: AlertCircle, label: 'Cancelled' },
  no_show: { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: AlertCircle, label: 'No Show' },
};

export default function StaffChaletsPage() {
  const [bookings, setBookings] = useState<ChaletBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'today' | 'all'>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const { socket } = useSocket();

  const fetchBookings = useCallback(async () => {
    try {
      const response = await api.get('/chalets/bookings', {
        params: filter === 'today' ? { date: new Date().toISOString().split('T')[0] } : {},
      });
      setBookings(response.data.data || []);
    } catch (error) {
      // Use mock data if API fails
      setBookings(generateMockBookings());
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchBookings();
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

  const generateMockBookings = (): ChaletBooking[] => {
    const today = new Date().toISOString().split('T')[0];
    return [
      {
        id: '1',
        booking_number: 'CB-001',
        status: 'confirmed',
        check_in_date: today,
        check_out_date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
        total_amount: 300,
        guests: 4,
        chalets: { name: 'Mountain View Chalet', capacity: 6 },
        users: { full_name: 'John Doe', email: 'john@example.com', phone: '+961 71 123456' },
      },
      {
        id: '2',
        booking_number: 'CB-002',
        status: 'checked_in',
        check_in_date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
        check_out_date: today,
        total_amount: 450,
        guests: 2,
        chalets: { name: 'Garden Chalet', capacity: 4 },
        users: { full_name: 'Jane Smith', email: 'jane@example.com' },
      },
      {
        id: '3',
        booking_number: 'CB-003',
        status: 'pending',
        check_in_date: today,
        check_out_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        total_amount: 200,
        guests: 3,
        chalets: { name: 'Luxury Villa', capacity: 8 },
        users: { full_name: 'Mike Johnson', email: 'mike@example.com' },
      },
    ];
  };

  const updateBookingStatus = async (bookingId: string, newStatus: string) => {
    try {
      await api.put(`/chalets/bookings/${bookingId}/status`, { status: newStatus });
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus as ChaletBooking['status'] } : b))
      );
      toast.success(`Booking ${newStatus.replace('_', ' ')}`);
    } catch (error) {
      toast.error('Failed to update booking');
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
            Chalets Management
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Handle check-ins and check-outs
          </p>
        </div>
        <Button variant="outline" onClick={fetchBookings}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <motion.div variants={fadeInUp}>
          <Card className="bg-gradient-to-br from-blue-500 to-indigo-500 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Today's Check-ins</p>
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
                  <p className="text-orange-100 text-sm">Today's Check-outs</p>
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
                  <p className="text-green-100 text-sm">Currently Occupied</p>
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
                placeholder="Search bookings..."
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
                Today
              </button>
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                All Bookings
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
              <p className="text-slate-500 dark:text-slate-400">No bookings to display</p>
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
                >
                  <Card className={`${
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
                              {config?.label}
                            </span>
                            {isCheckInDay && booking.status === 'confirmed' && (
                              <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded">
                                Check-in Today
                              </span>
                            )}
                            {isCheckOutDay && booking.status === 'checked_in' && (
                              <span className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-0.5 rounded">
                                Check-out Today
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">Booking #</span>
                              <p className="font-medium text-slate-900 dark:text-white">{booking.booking_number}</p>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">Check-in</span>
                              <p className="font-medium text-slate-900 dark:text-white">{booking.check_in_date}</p>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">Check-out</span>
                              <p className="font-medium text-slate-900 dark:text-white">{booking.check_out_date}</p>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-slate-400">Guests</span>
                              <p className="font-medium text-slate-900 dark:text-white flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                {booking.guests}
                              </p>
                            </div>
                          </div>

                          {/* Guest Info */}
                          {booking.users && (
                            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                              <p className="font-medium text-slate-900 dark:text-white">
                                {booking.users.full_name}
                              </p>
                              <div className="flex flex-wrap gap-4 mt-1 text-sm text-slate-500 dark:text-slate-400">
                                <span className="flex items-center gap-1">
                                  <Mail className="w-4 h-4" />
                                  {booking.users.email}
                                </span>
                                {booking.users.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-4 h-4" />
                                    {booking.users.phone}
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
                              Check In
                            </Button>
                          )}
                          {booking.status === 'checked_in' && (
                            <Button onClick={() => updateBookingStatus(booking.id, 'checked_out')}>
                              <LogOut className="w-4 h-4 mr-2" />
                              Check Out
                            </Button>
                          )}
                          {booking.status === 'pending' && (
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => updateBookingStatus(booking.id, 'confirmed')}>
                                Confirm
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => updateBookingStatus(booking.id, 'cancelled')}>
                                Cancel
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      {booking.notes && (
                        <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                          <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            <strong>Notes:</strong> {booking.notes}
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
    </motion.div>
  );
}
