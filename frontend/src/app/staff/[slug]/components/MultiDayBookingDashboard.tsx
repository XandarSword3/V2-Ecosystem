'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSocket } from '@/lib/socket';
import { formatCurrency, formatTime } from '@/lib/utils';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import {
  Clock,
  CheckCircle,
  RefreshCw,
  LogOut,
  LogIn,
  XCircle,
  LayoutDashboard,
  Calendar,
  Users,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';

export interface MultiDayBookingDashboardProps {
  slug: string;
  moduleName: string;
  moduleId: string;
}

export function MultiDayBookingDashboard({ slug, moduleName, moduleId }: MultiDayBookingDashboardProps) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'today' | 'all'>('today');
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const { socket } = useSocket();

  const fetchBookings = useCallback(async () => {
    try {
      const response = await api.get(`/staff/modules/${slug}/bookings`, {
        params: {
          moduleId,
          ...(filter === 'today' ? { date: new Date().toISOString().split('T')[0] } : {}),
        },
      });
      setBookings(response.data.data || []);
    } catch (error) {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [moduleId, slug, filter]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    if (socket && moduleId) {
      socket.emit('join:unit', moduleId);
      socket.on('booking:new', fetchBookings);
      socket.on('booking:updated', fetchBookings);
      return () => {
        socket.off('booking:new', fetchBookings);
        socket.off('booking:updated', fetchBookings);
      };
    }
  }, [socket, moduleId, fetchBookings]);

  const updateBookingStatus = async (bookingId: string, status: string) => {
    try {
      await api.patch(`/staff/modules/${slug}/bookings/${bookingId}/status`, { status });
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status } : b)));
      toast.success(`Booking ${status.replace('_', ' ')}`);
      setSelectedBooking(null);
    } catch (error: any) {
      if (status === 'checked_in' && error?.response?.status === 402) {
        const outstanding = Number(error?.response?.data?.outstanding || 0);
        const shouldRecord = window.confirm(
          `Outstanding balance: ${outstanding.toFixed(2)}. Record cash payment now?`,
        );
        if (shouldRecord) {
          await api.post('/payments/record-cash', {
            referenceType: 'chalet_booking',
            referenceId: bookingId,
            amount: outstanding,
            notes: 'Recorded during check-in',
          });
          await api.patch(`/staff/modules/${slug}/bookings/${bookingId}/status`, { status: 'checked_in' });
          setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status: 'checked_in' } : b)));
          toast.success('Payment recorded and guest checked in');
          setSelectedBooking(null);
          return;
        }
      }
      toast.error(error?.response?.data?.error || 'Failed to update booking');
    }
  };

  const createStaffBooking = async () => {
    try {
      const chaletId = window.prompt('Chalet ID');
      if (!chaletId) return;
      const customerName = window.prompt('Guest name') || 'Walk-in Guest';
      const customerPhone = window.prompt('Guest phone') || '';
      const checkIn = window.prompt('Check-in date (YYYY-MM-DD)');
      const checkOut = window.prompt('Check-out date (YYYY-MM-DD)');
      if (!checkIn || !checkOut) {
        toast.error('Check-in and check-out are required');
        return;
      }
      await api.post('/chalets/staff/bookings', {
        chalet_id: chaletId,
        customer_name: customerName,
        customer_phone: customerPhone,
        check_in_date: checkIn,
        check_out_date: checkOut,
        payment_method: 'cash',
      });
      toast.success('Staff booking created');
      fetchBookings();
    } catch (error) {
      toast.error('Failed to create booking');
    }
  };

  const statusConfig: Record<string, { color: string; label: string }> = {
    pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
    confirmed: { color: 'bg-blue-100 text-blue-800', label: 'Confirmed' },
    checked_in: { color: 'bg-green-100 text-green-800', label: 'Checked In' },
    checked_out: { color: 'bg-slate-100 text-slate-800', label: 'Checked Out' },
    cancelled: { color: 'bg-red-100 text-red-800', label: 'Cancelled' },
  };

  const filteredBookings = useMemo(() => {
    if (!searchQuery.trim()) return bookings;
    const q = searchQuery.toLowerCase();
    return bookings.filter((b) =>
      (b.booking_number || '').toLowerCase().includes(q) ||
      (b.users?.full_name || b.customer_name || '').toLowerCase().includes(q) ||
      (b.customer_phone || '').includes(q)
    );
  }, [bookings, searchQuery]);

  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: Array<{ day: number; date: string; bookings: any[] }> = [];

    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayBookings = bookings.filter((b) => {
        const checkIn = b.check_in_date?.split('T')[0];
        const checkOut = b.check_out_date?.split('T')[0];
        return checkIn && checkOut && dateStr >= checkIn && dateStr <= checkOut;
      });
      days.push({ day: i, date: dateStr, bookings: dayBookings });
    }

    const padded: Array<{ day: number; date: string; bookings: any[] } | null> = [];
    for (let i = 0; i < firstDay; i++) {
      padded.push(null);
    }
    return padded.concat(days);
  }, [calendarMonth, bookings]);

  const navigateMonth = (delta: number) => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const monthLabel = calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <LayoutDashboard className="h-8 w-8 text-primary" />
            {moduleName} Bookings
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage check-ins, check-outs, and bookings
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={createStaffBooking}>New Booking</Button>
          <div className="flex bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <button
              onClick={() => setView('list')}
              className={`px-3 py-2 text-sm font-medium rounded-l-lg transition ${
                view === 'list' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setView('calendar'); setFilter('all'); }}
              className={`px-3 py-2 text-sm font-medium rounded-r-lg transition ${
                view === 'calendar' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Calendar className="w-4 h-4" />
            </button>
          </div>
          {view === 'list' && (
            <div className="flex bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <button
                onClick={() => setFilter('today')}
                className={`px-4 py-2 text-sm font-medium rounded-l-lg transition ${
                  filter === 'today' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 text-sm font-medium rounded-r-lg transition ${
                  filter === 'all' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                All
              </button>
            </div>
          )}
          <Button variant="outline" size="icon" onClick={() => fetchBookings()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {view === 'list' && (
        <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by booking #, guest name, or phone..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Check-ins Today</p>
                <p className="text-2xl font-bold">{bookings.filter((b) => b.status === 'confirmed').length}</p>
              </div>
              <LogIn className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Check-outs Today</p>
                <p className="text-2xl font-bold">{bookings.filter((b) => b.status === 'checked_in').length}</p>
              </div>
              <LogOut className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pending</p>
                <p className="text-2xl font-bold">{bookings.filter((b) => b.status === 'pending').length}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Bookings</p>
                <p className="text-2xl font-bold">{bookings.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {view === 'calendar' && (
        <div className="mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => navigateMonth(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="text-lg font-semibold">{monthLabel}</h3>
                <button onClick={() => navigateMonth(1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">{day}</div>
                ))}
                {calendarDays.map((item, idx) => (
                  <div
                    key={idx}
                    className={`min-h-[72px] p-1 border border-gray-100 dark:border-gray-800 rounded-lg ${
                      item ? 'bg-white dark:bg-gray-800' : ''
                    } ${item?.date === new Date().toISOString().split('T')[0] ? 'ring-2 ring-primary' : ''}`}
                  >
                    {item && (
                      <>
                        <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{item.day}</div>
                        {item.bookings.length > 0 && (
                          <div className="space-y-0.5">
                            {item.bookings.slice(0, 3).map((b: any) => (
                              <div
                                key={b.id}
                                onClick={() => setSelectedBooking(b)}
                                className={`text-[10px] px-1 py-0.5 rounded cursor-pointer truncate ${
                                  b.status === 'checked_in' ? 'bg-green-100 text-green-700' :
                                  b.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                                  b.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {b.users?.full_name || b.customer_name || `#${b.booking_number}`}
                              </div>
                            ))}
                            {item.bookings.length > 3 && (
                              <div className="text-[10px] text-gray-400 text-center">+{item.bookings.length - 3} more</div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {view === 'list' && (
        <>
          {filteredBookings.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500">
                  No bookings {filter === 'today' ? 'for today' : 'found'}
                  {searchQuery ? ' matching your search' : ''}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBookings.map((booking) => (
                <Card key={booking.id} className="cursor-pointer hover:shadow-lg transition" onClick={() => setSelectedBooking(booking)}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">#{booking.booking_number}</h3>
                        <p className="text-sm text-gray-500">{booking.users?.full_name || booking.customer_name || 'Guest'}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig[booking.status]?.color || 'bg-gray-100'}`}>
                        {statusConfig[booking.status]?.label || booking.status}
                      </span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="w-4 h-4" />
                        <span>{formatTime(booking.check_in_date)} - {formatTime(booking.check_out_date)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Users className="w-4 h-4" />
                        <span>{booking.guests || booking.number_of_guests || 1} guests</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t flex gap-2">
                      {booking.status === 'confirmed' && (
                        <Button size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); updateBookingStatus(booking.id, 'checked_in'); }}>
                          <LogIn className="w-4 h-4 mr-1" /> Check In
                        </Button>
                      )}
                      {booking.status === 'checked_in' && (
                        <Button size="sm" variant="outline" className="flex-1" onClick={(e) => { e.stopPropagation(); updateBookingStatus(booking.id, 'checked_out'); }}>
                          <LogOut className="w-4 h-4 mr-1" /> Check Out
                        </Button>
                      )}
                      {booking.status === 'pending' && (
                        <Button size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); updateBookingStatus(booking.id, 'confirmed'); }}>
                          <CheckCircle className="w-4 h-4 mr-1" /> Confirm
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {selectedBooking && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-detail-title"
          onClick={() => setSelectedBooking(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') setSelectedBooking(null); }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 id="booking-detail-title" className="text-xl font-semibold">Booking #{selectedBooking.booking_number}</h3>
              <Button variant="ghost" size="icon" aria-label="Close booking details" onClick={() => setSelectedBooking(null)}>
                <XCircle className="w-5 h-5" />
              </Button>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Guest</span>
                <span>{selectedBooking.users?.full_name || selectedBooking.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Check-in</span>
                <span>{formatTime(selectedBooking.check_in_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Check-out</span>
                <span>{formatTime(selectedBooking.check_out_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Guests</span>
                <span>{selectedBooking.guests || selectedBooking.number_of_guests || 1}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total</span>
                <span className="font-bold">{formatCurrency(selectedBooking.total_amount || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Deposit Status</span>
                <span className="font-medium">{selectedBooking.payment_status || 'pending'}</span>
              </div>
              {selectedBooking.special_requests && (
                <div className="bg-yellow-50 p-3 rounded">
                  <span className="font-medium">Notes:</span> {selectedBooking.special_requests}
                </div>
              )}
            </div>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setSelectedBooking(null)}>Close</Button>
              {selectedBooking.status === 'confirmed' && (
                <Button className="flex-1" onClick={() => updateBookingStatus(selectedBooking.id, 'checked_in')}>Check In</Button>
              )}
              {selectedBooking.status === 'checked_in' && (
                <Button className="flex-1" onClick={() => updateBookingStatus(selectedBooking.id, 'checked_out')}>Check Out</Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
