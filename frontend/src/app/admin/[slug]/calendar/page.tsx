'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useSiteSettings } from '@/lib/settings-context';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
  Users,
  Home,
  Eye,
  X,
} from 'lucide-react';

interface ChaletOption {
  id: string;
  name: string;
  base_price: number;
  weekend_price: number;
}

interface Booking {
  id: string;
  booking_number: string;
  customer_name: string;
  check_in_date: string;
  check_out_date: string;
  status: string;
  number_of_guests: number;
  total_amount: number;
}

interface BlockedDate {
  id: string;
  chalet_id: string;
  blocked_date: string;
  reason: string | null;
}

function formatDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

export default function AdminCalendarPage() {
  const params = useParams();
  const { modules } = useSiteSettings();
  const t = useTranslations('admin');
  const rawSlug = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  const slug = rawSlug ? decodeURIComponent(rawSlug).toLowerCase() : '';
  const currentModule = modules.find(m => m.slug.toLowerCase() === slug);

  const [chalets, setChalets] = useState<ChaletOption[]>([]);
  const [selectedChaletId, setSelectedChaletId] = useState<string>('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [blockReason, setBlockReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [viewBooking, setViewBooking] = useState<Booking | null>(null);

  // Fetch chalets for this module
  useEffect(() => {
    const fetchChalets = async () => {
      try {
        const moduleId = currentModule?.id;
        const response = await api.get('/chalets', { params: { moduleId } });
        const data = response.data?.data || [];
        setChalets(data);
        if (data.length > 0 && !selectedChaletId) {
          setSelectedChaletId(data[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch chalets:', error);
      }
    };
    if (currentModule) fetchChalets();
  }, [currentModule]);

  // Fetch calendar data when chalet or month changes
  useEffect(() => {
    if (!selectedChaletId) return;
    fetchCalendarData();
  }, [selectedChaletId, currentMonth]);

  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const startDate = formatDateStr(new Date(year, month, 1));
      const endDate = formatDateStr(new Date(year, month + 1, 0));
      
      const response = await api.get(`/chalets/admin/chalets/${selectedChaletId}/calendar`, {
        params: { startDate, endDate },
      });
      
      setBookings(response.data?.data?.bookings || []);
      setBlockedDates(response.data?.data?.blockedDates || []);
    } catch (error) {
      console.error('Failed to fetch calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Build lookup maps
  const bookingsByDate = useMemo(() => {
    const map = new Map<string, Booking[]>();
    bookings.forEach(b => {
      const start = new Date(b.check_in_date);
      const end = new Date(b.check_out_date);
      const current = new Date(start);
      while (current < end) {
        const dateStr = formatDateStr(current);
        if (!map.has(dateStr)) map.set(dateStr, []);
        map.get(dateStr)!.push(b);
        current.setDate(current.getDate() + 1);
      }
    });
    return map;
  }, [bookings]);

  const blockedDateSet = useMemo(() => {
    return new Set(blockedDates.map(b => b.blocked_date));
  }, [blockedDates]);

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: Array<{ date: Date; dayOfMonth: number; isCurrentMonth: boolean }> = [];

    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        dayOfMonth: prevMonthLastDay - i,
        isCurrentMonth: false,
      });
    }

    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        dayOfMonth: i,
        isCurrentMonth: true,
      });
    }

    // Pad to 42 (6 rows)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        dayOfMonth: i,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentMonth]);

  const toggleDateSelection = (dateStr: string) => {
    setSelectedDates(prev => {
      const next = new Set(prev);
      if (next.has(dateStr)) {
        next.delete(dateStr);
      } else {
        next.add(dateStr);
      }
      return next;
    });
  };

  const handleBlockDates = async () => {
    if (selectedDates.size === 0) return;
    try {
      await api.post(`/chalets/admin/chalets/${selectedChaletId}/block-dates`, {
        dates: Array.from(selectedDates),
        reason: blockReason || undefined,
      });
      toast.success(`${selectedDates.size} date(s) blocked`);
      setSelectedDates(new Set());
      setBlockReason('');
      fetchCalendarData();
    } catch (error) {
      toast.error('Failed to block dates');
    }
  };

  const handleUnblockDates = async () => {
    if (selectedDates.size === 0) return;
    try {
      await api.post(`/chalets/admin/chalets/${selectedChaletId}/unblock-dates`, {
        dates: Array.from(selectedDates),
      });
      toast.success(`${selectedDates.size} date(s) unblocked`);
      setSelectedDates(new Set());
      fetchCalendarData();
    } catch (error) {
      toast.error('Failed to unblock dates');
    }
  };

  const navigateMonth = (delta: number) => {
    setCurrentMonth(prev => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + delta);
      return d;
    });
  };

  const monthYearString = currentMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const selectedChalet = chalets.find(c => c.id === selectedChaletId);

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    checked_in: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    checked_out: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-6 h-6" />
            Availability Calendar
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            View bookings and manage date availability
          </p>
        </div>
      </div>

      {/* Chalet Selector */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Chalet:</label>
        <select
          value={selectedChaletId}
          onChange={e => setSelectedChaletId(e.target.value)}
          className="input max-w-xs"
        >
          {chalets.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-6">
              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => navigateMonth(-1)}
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="text-lg font-semibold">{monthYearString}</h3>
                <button
                  onClick={() => navigateMonth(1)}
                  className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {weekDays.map(day => (
                  <div key={day} className="text-center text-xs font-medium text-slate-500 py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => {
                  const dateStr = formatDateStr(day.date);
                  const dayBookings = bookingsByDate.get(dateStr) || [];
                  const isBlocked = blockedDateSet.has(dateStr);
                  const isSelected = selectedDates.has(dateStr);
                  const isWeekend = day.date.getDay() === 5 || day.date.getDay() === 6;
                  const today = new Date();
                  const isToday = dateStr === formatDateStr(today);

                  if (!day.isCurrentMonth) {
                    return (
                      <div key={index} className="h-20 rounded-lg bg-slate-50 dark:bg-slate-800/30 p-1">
                        <span className="text-xs text-slate-300 dark:text-slate-600">{day.dayOfMonth}</span>
                      </div>
                    );
                  }

                  let bgClass = 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700';
                  if (isSelected) {
                    bgClass = 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500';
                  } else if (isBlocked) {
                    bgClass = 'bg-red-50 dark:bg-red-900/20';
                  } else if (dayBookings.length > 0) {
                    bgClass = 'bg-green-50 dark:bg-green-900/20';
                  }

                  return (
                    <button
                      key={index}
                      onClick={() => toggleDateSelection(dateStr)}
                      className={`h-20 rounded-lg p-1 text-left transition-all cursor-pointer border ${bgClass} ${
                        isToday ? 'border-blue-500 border-2' : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-medium ${
                          isWeekend ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'
                        }`}>
                          {day.dayOfMonth}
                        </span>
                        {isBlocked && <Lock className="w-3 h-3 text-red-500" />}
                      </div>
                      {/* Booking indicators */}
                      <div className="mt-1 space-y-0.5 overflow-hidden">
                        {dayBookings.slice(0, 2).map((b, i) => (
                          <div
                            key={i}
                            className={`text-[9px] px-1 py-0.5 rounded truncate cursor-pointer ${statusColors[b.status] || 'bg-slate-100'}`}
                            onClick={e => { e.stopPropagation(); setViewBooking(b); }}
                            title={`${b.customer_name} (${b.booking_number})`}
                          >
                            {b.customer_name?.split(' ')[0]}
                          </div>
                        ))}
                        {dayBookings.length > 2 && (
                          <div className="text-[9px] text-slate-500">+{dayBookings.length - 2} more</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-green-100 dark:bg-green-900/20 rounded border border-green-300"></div>
                  <span className="text-slate-600 dark:text-slate-400">Booked</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-red-100 dark:bg-red-900/20 rounded border border-red-300"></div>
                  <span className="text-slate-600 dark:text-slate-400">Blocked</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-blue-100 dark:bg-blue-900/20 rounded ring-2 ring-blue-500"></div>
                  <span className="text-slate-600 dark:text-slate-400">Selected</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-yellow-100 rounded border border-yellow-300"></div>
                  <span className="text-slate-600 dark:text-slate-400">Pending</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-blue-100 rounded border border-blue-300"></div>
                  <span className="text-slate-600 dark:text-slate-400">Confirmed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 bg-green-100 rounded border border-green-300"></div>
                  <span className="text-slate-600 dark:text-slate-400">Checked In</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: Actions & Booking Details */}
        <div className="space-y-4">
          {/* Block/Unblock Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Date Blocking
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedDates.size > 0 ? (
                <>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {selectedDates.size} date(s) selected
                  </p>
                  <input
                    type="text"
                    value={blockReason}
                    onChange={e => setBlockReason(e.target.value)}
                    placeholder="Reason (optional)..."
                    className="input w-full text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleBlockDates}
                      className="flex-1"
                    >
                      <Lock className="w-3 h-3 mr-1" />
                      Block
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleUnblockDates}
                      className="flex-1"
                    >
                      <Unlock className="w-3 h-3 mr-1" />
                      Unblock
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedDates(new Set())}
                    className="w-full"
                  >
                    Clear Selection
                  </Button>
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  Click on dates in the calendar to select them, then block or unblock.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Bookings for this month */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4" />
                Bookings This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bookings.length === 0 ? (
                <p className="text-sm text-slate-500">No bookings this month</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {bookings.map(b => (
                    <button
                      key={b.id}
                      onClick={() => setViewBooking(b)}
                      className="w-full text-left p-2 rounded-lg border hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{b.customer_name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusColors[b.status]}`}>
                          {b.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {new Date(b.check_in_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {' → '}
                        {new Date(b.check_out_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Booking Detail Modal */}
      {viewBooking && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewBooking(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Booking Details</h3>
              <button onClick={() => setViewBooking(null)} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Booking #</span>
                <span className="text-sm font-medium">{viewBooking.booking_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Guest</span>
                <span className="text-sm font-medium">{viewBooking.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Check-in</span>
                <span className="text-sm">{new Date(viewBooking.check_in_date).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Check-out</span>
                <span className="text-sm">{new Date(viewBooking.check_out_date).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Guests</span>
                <span className="text-sm">{viewBooking.number_of_guests}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Status</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[viewBooking.status]}`}>
                  {viewBooking.status}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="text-sm text-slate-500">Total</span>
                <span className="text-sm font-bold text-green-600">${viewBooking.total_amount}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
