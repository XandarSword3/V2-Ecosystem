'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface Booking {
  id: string;
  booking_number: string;
  status: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
  check_in_date: string;
  check_out_date: string;
  total_amount: number;
  guests: number;
  notes?: string;
  chalets?: {
    id: string;
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

export default function StaffBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/chalets/staff/bookings');
      setBookings(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
      toast.error('Failed to fetch bookings');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleCheckIn = async (bookingId: string) => {
    try {
      await api.patch(`/chalets/staff/bookings/${bookingId}/check-in`);
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: 'checked_in' as const } : b)));
      toast.success('Guest checked in successfully');
    } catch (error) {
      toast.error('Failed to check in guest');
    }
  };

  const handleCheckOut = async (bookingId: string) => {
    try {
      await api.patch(`/chalets/staff/bookings/${bookingId}/check-out`);
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: 'checked_out' as const } : b)));
      toast.success('Guest checked out successfully');
    } catch (error) {
      toast.error('Failed to check out guest');
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const days = viewMode === 'week' ? 7 : 1;
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? days : -days));
    setSelectedDate(newDate);
  };

  const getBookingsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return bookings.filter((b) => {
      const checkIn = b.check_in_date.split('T')[0];
      const checkOut = b.check_out_date.split('T')[0];
      return dateStr >= checkIn && dateStr <= checkOut;
    });
  };

  const todayBookings = getBookingsForDate(selectedDate);

  const stats = {
    checkingInToday: bookings.filter((b) => {
      const today = new Date().toISOString().split('T')[0];
      return b.check_in_date.split('T')[0] === today && b.status === 'confirmed';
    }).length,
    checkingOutToday: bookings.filter((b) => {
      const today = new Date().toISOString().split('T')[0];
      return b.check_out_date.split('T')[0] === today && b.status === 'checked_in';
    }).length,
    currentlyStaying: bookings.filter((b) => b.status === 'checked_in').length,
  };

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
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            Booking Calendar
          </h1>
          <p className="text-slate-500 dark:text-slate-400">View and manage today&apos;s check-ins and check-outs</p>
        </div>
        <Button variant="outline" onClick={fetchBookings}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div variants={fadeInUp}>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm">Checking In Today</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.checkingInToday}</p>
                </div>
                <LogIn className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm">Checking Out Today</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.checkingOutToday}</p>
                </div>
                <LogOut className="w-8 h-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm">Currently Staying</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.currentlyStaying}</p>
                </div>
                <Home className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Date Navigation */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigateDate('prev')}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date())}>
                Today
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigateDate('next')}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {todayBookings.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500 dark:text-slate-400">No bookings for this date</p>
            </div>
          ) : (
            <div className="space-y-4">
              {todayBookings.map((booking) => {
                const config = statusConfig[booking.status] || statusConfig.pending;
                const StatusIcon = config.icon;
                const isCheckInDate = booking.check_in_date.split('T')[0] === selectedDate.toISOString().split('T')[0];
                const isCheckOutDate = booking.check_out_date.split('T')[0] === selectedDate.toISOString().split('T')[0];

                return (
                  <motion.div key={booking.id} variants={fadeInUp} className="border rounded-lg p-4 dark:border-slate-700">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono text-sm bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                            {booking.booking_number}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${config.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {config.label}
                          </span>
                          {isCheckInDate && booking.status === 'confirmed' && (
                            <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              Check-in Today
                            </span>
                          )}
                          {isCheckOutDate && booking.status === 'checked_in' && (
                            <span className="px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                              Check-out Today
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <Home className="w-4 h-4" />
                            <span>{booking.chalets?.name || 'Unknown Chalet'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <Users className="w-4 h-4" />
                            <span>{booking.guests} guests</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <Calendar className="w-4 h-4" />
                            <span>{formatDate(booking.check_in_date)} - {formatDate(booking.check_out_date)}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <span className="font-semibold">{formatCurrency(booking.total_amount)}</span>
                          </div>
                        </div>

                        {booking.users && (
                          <div className="mt-2 flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                            <span className="font-medium text-slate-700 dark:text-slate-300">{booking.users.full_name}</span>
                            {booking.users.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {booking.users.phone}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {booking.users.email}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        {booking.status === 'confirmed' && (
                          <Button size="sm" onClick={() => handleCheckIn(booking.id)}>
                            <LogIn className="w-4 h-4 mr-1" />
                            Check In
                          </Button>
                        )}
                        {booking.status === 'checked_in' && (
                          <Button size="sm" variant="outline" onClick={() => handleCheckOut(booking.id)}>
                            <LogOut className="w-4 h-4 mr-1" />
                            Check Out
                          </Button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
