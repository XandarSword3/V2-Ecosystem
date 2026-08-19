'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/Card';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import { Calendar, Clock, MapPin, AlertCircle, Info } from 'lucide-react';

// Raw staff_shifts row shape returned by GET /staff/shifts/me (select('*'),
// snake_case). Kept local rather than importing the shared StaffShift type
// because that type is camelCase while this endpoint returns the DB columns
// verbatim.
interface StaffShiftRow {
  id: string;
  shift_date: string; // YYYY-MM-DD
  start_time: string; // HH:mm or HH:mm:ss
  end_time: string;   // HH:mm or HH:mm:ss
  department?: string | null;
  status: 'scheduled' | 'active' | 'completed' | 'missed' | 'cancelled';
  late_reason?: string | null;
  early_leave_reason?: string | null;
  notes?: string | null;
}

const STATUS_STYLE: Record<StaffShiftRow['status'], { chip: string; dot: string; label: string }> = {
  scheduled: { chip: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', dot: 'bg-blue-500', label: 'Scheduled' },
  active: { chip: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', dot: 'bg-green-500', label: 'Active' },
  completed: { chip: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300', dot: 'bg-slate-400', label: 'Completed' },
  missed: { chip: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', dot: 'bg-red-500', label: 'Missed' },
  cancelled: { chip: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400', dot: 'bg-slate-300', label: 'Cancelled' },
};

// Parse "YYYY-MM-DD" with local time (avoid new Date(dateStr) shifting the day
// across timezones).
function formatShiftDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatRelativeDay(dateStr: string): string {
  const today = new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  const target = new Date(year, month - 1, day);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((target.getTime() - startOfToday.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return '';
}

// "HH:mm" or "HH:mm:ss" → minutes since midnight
function timeToMinutes(time: string): number {
  const [h = 0, m = 0] = time.split(':').map(Number);
  return h * 60 + m;
}

// Handle overnight shifts (end_time <= start_time, e.g. 22:00 → 06:00).
function shiftDuration(start: string, end: string): number {
  const startMin = timeToMinutes(start);
  let endMin = timeToMinutes(end);
  if (endMin <= startMin) endMin += 24 * 60;
  return endMin - startMin;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatClockTime(time: string): string {
  const [hStr = '0', mStr = '0'] = time.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

export default function MySchedulePage() {
  const [shifts, setShifts] = useState<StaffShiftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchShifts = async () => {
      try {
        const res = await api.get('/staff/shifts/me');
        const rows = res.data?.data;
        setShifts(Array.isArray(rows) ? rows : []);
      } catch (err) {
        console.error('Failed to fetch shifts:', err);
        setError('Could not load your schedule. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchShifts();
  }, []);

  // Group by day, sorted ascending by date then start time.
  const days = useMemo(() => {
    const byDay = new Map<string, StaffShiftRow[]>();
    for (const shift of shifts) {
      const list = byDay.get(shift.shift_date) ?? [];
      list.push(shift);
      byDay.set(shift.shift_date, list);
    }
    return Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [shifts]);

  // Soonest shift that hasn't finished yet — the hero highlight.
  const nextShift = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return shifts
      .filter((s) => (s.status === 'scheduled' || s.status === 'active') && s.shift_date >= today)
      .sort((a, b) => `${a.shift_date}T${a.start_time}`.localeCompare(`${b.shift_date}T${b.start_time}`))[0];
  }, [shifts]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Calendar className="w-7 h-7 text-blue-500" />
            My Schedule
          </h1>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto" />
            <p className="text-slate-500 mt-4">Loading schedule…</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Calendar className="w-7 h-7 text-blue-500" />
            My Schedule
          </h1>
        </div>
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              Couldn&apos;t load your schedule
            </h3>
            <p className="text-slate-500">{error}</p>
          </CardContent>
        </Card>
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
      <motion.div variants={fadeInUp} className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Calendar className="w-7 h-7 text-blue-500" />
            My Schedule
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Your upcoming and recent shifts
          </p>
        </div>
      </motion.div>

      {/* Next shift hero */}
      {nextShift && (
        <motion.div variants={fadeInUp}>
          <Card className="overflow-hidden border-blue-200 dark:border-blue-900/60">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-white">
              <p className="text-sm font-medium text-blue-100 uppercase tracking-wide">
                Up next
              </p>
            </div>
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                    <Clock className="w-7 h-7 text-blue-600 dark:text-blue-300" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                      {formatRelativeDay(nextShift.shift_date) || formatShiftDate(nextShift.shift_date)}
                    </p>
                    <p className="text-slate-500 dark:text-slate-400">
                      {formatClockTime(nextShift.start_time)} – {formatClockTime(nextShift.end_time)}
                      <span className="mx-1.5">·</span>
                      {formatDuration(shiftDuration(nextShift.start_time, nextShift.end_time))}
                    </p>
                    {nextShift.department && (
                      <p className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {nextShift.department}
                      </p>
                    )}
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_STYLE[nextShift.status].chip}`}>
                  {STATUS_STYLE[nextShift.status].label}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {days.length === 0 ? (
        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="p-12 text-center">
              <Calendar className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                No shifts scheduled
              </h3>
              <p className="text-slate-500 max-w-md mx-auto">
                You have no shifts in the next two weeks. Check back later or
                contact your manager.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="space-y-8">
          {days.map(([date, dayShifts]) => (
            <motion.section key={date} variants={fadeInUp}>
              {/* Day header */}
              <div className="flex items-center gap-3 mb-3">
                <span className={`w-2.5 h-2.5 rounded-full ${STATUS_STYLE[dayShifts[0]?.status]?.dot ?? 'bg-slate-400'}`} />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {formatShiftDate(date)}
                  {formatRelativeDay(date) && (
                    <span className="ml-2 text-sm font-medium text-blue-600 dark:text-blue-400">
                      {formatRelativeDay(date)}
                    </span>
                  )}
                </h2>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {dayShifts.length} shift{dayShifts.length === 1 ? '' : 's'}
                </span>
              </div>

              {/* Timeline */}
              <div className="relative pl-6">
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200 dark:bg-slate-700" />
                <div className="space-y-3">
                  {dayShifts.map((shift) => {
                    const status = STATUS_STYLE[shift.status] ?? STATUS_STYLE.scheduled;
                    return (
                      <div key={shift.id} className="relative">
                        <span className={`absolute -left-6 top-4 w-[15px] h-[15px] rounded-full border-2 border-white dark:border-slate-900 ${status.dot}`} />
                        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {formatClockTime(shift.start_time)} – {formatClockTime(shift.end_time)}
                              </p>
                              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                {formatDuration(shiftDuration(shift.start_time, shift.end_time))}
                              </p>
                            </div>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${status.chip}`}>
                              {status.label}
                            </span>
                          </div>

                          {(shift.department || shift.notes) && (
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm text-slate-500 dark:text-slate-400">
                              {shift.department && (
                                <span className="flex items-center gap-1.5">
                                  <MapPin className="w-4 h-4" />
                                  {shift.department}
                                </span>
                              )}
                              {shift.notes && (
                                <span className="flex items-center gap-1.5">
                                  <Info className="w-4 h-4" />
                                  {shift.notes}
                                </span>
                              )}
                            </div>
                          )}

                          {shift.late_reason && (
                            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                              Late: {shift.late_reason}
                            </p>
                          )}
                          {shift.early_leave_reason && (
                            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                              Early leave: {shift.early_leave_reason}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.section>
          ))}
        </div>
      )}
    </motion.div>
  );
}
