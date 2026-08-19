'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  Calendar,
  Clock,
  MapPin,
  AlertCircle,
  Info,
  LogIn,
  LogOut,
  Repeat,
  Loader2,
} from 'lucide-react';

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
  actual_start?: string | null;
  actual_end?: string | null;
  late_reason?: string | null;
  early_leave_reason?: string | null;
  notes?: string | null;
}

// Row shape from GET /staff/shifts/swap/me. We only read the fields needed to
// key a swap request back to its shift and render its state.
interface SwapRequestRow {
  id: string;
  original_shift_id: string;
  requesting_staff_id: string;
  target_staff_id?: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'approved';
  reason?: string | null;
  created_at?: string;
}

const STATUS_STYLE: Record<StaffShiftRow['status'], { chip: string; dot: string; label: string }> = {
  scheduled: { chip: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', dot: 'bg-blue-500', label: 'Scheduled' },
  active: { chip: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', dot: 'bg-green-500', label: 'Active' },
  completed: { chip: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300', dot: 'bg-slate-400', label: 'Completed' },
  missed: { chip: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', dot: 'bg-red-500', label: 'Missed' },
  cancelled: { chip: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400', dot: 'bg-slate-300', label: 'Cancelled' },
};

const SWAP_STATUS_STYLE: Record<SwapRequestRow['status'], { chip: string; label: string }> = {
  pending: { chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', label: 'Swap pending' },
  accepted: { chip: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', label: 'Swap accepted' },
  approved: { chip: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', label: 'Swap approved' },
  rejected: { chip: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400', label: 'Swap declined' },
  cancelled: { chip: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400', label: 'Swap cancelled' },
};

// Statuses that block a new swap request for the same shift.
const ACTIVE_SWAP_STATUSES = new Set(['pending', 'accepted', 'approved']);

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
  const [currentShift, setCurrentShift] = useState<StaffShiftRow | null>(null);
  const [swapRequests, setSwapRequests] = useState<SwapRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Which shift's clock-in/out is in flight (disables that card's buttons).
  const [busyShiftId, setBusyShiftId] = useState<string | null>(null);
  // Swap request modal state.
  const [swapModal, setSwapModal] = useState<{ shiftId: string; shiftLabel: string } | null>(null);
  const [swapReason, setSwapReason] = useState('');
  const [swapSubmitting, setSwapSubmitting] = useState(false);
  // Optional late/early-leave reason prompt after a clock event.
  const [reasonModal, setReasonModal] = useState<{ shiftId: string; kind: 'late' | 'early' } | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [reasonSubmitting, setReasonSubmitting] = useState(false);
  // Live clock for the "on shift now" elapsed timer.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadSchedule = async () => {
    try {
      const [shiftsRes, swapsRes, currentRes] = await Promise.all([
        api.get('/staff/shifts/me'),
        api.get('/staff/shifts/swap/me'),
        api.get('/staff/shifts/me/current'),
      ]);
      const rows = shiftsRes.data?.data;
      setShifts(Array.isArray(rows) ? rows : []);
      const swapRows = swapsRes.data?.data;
      setSwapRequests(Array.isArray(swapRows) ? swapRows : []);
      setCurrentShift(currentRes.data?.data ?? null);
    } catch (err) {
      console.error('Failed to fetch shifts:', err);
      setError('Could not load your schedule. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedule();
  }, []);

  const clockIn = async (shiftId: string) => {
    setBusyShiftId(shiftId);
    try {
      const res = await api.post(`/staff/shifts/${shiftId}/clock-in`);
      const updated = res.data?.data;
      const lateMinutes = Number(res.data?.lateMinutes ?? 0);
      setShifts((prev) =>
        prev.map((s) =>
          s.id === shiftId
            ? { ...s, status: 'active', actual_start: updated?.actual_start ?? new Date().toISOString() }
            : s
        )
      );
      setCurrentShift((prev) =>
        prev?.id === shiftId
          ? { ...prev, status: 'active', actual_start: updated?.actual_start ?? new Date().toISOString() }
          : prev
      );
      if (lateMinutes > 0) {
        setReasonText('');
        setReasonModal({ shiftId, kind: 'late' });
        toast.info(`Clocked in ${lateMinutes} minutes late`);
      } else {
        toast.success('Clocked in on time');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not clock in');
    } finally {
      setBusyShiftId(null);
    }
  };

  const clockOut = async (shiftId: string) => {
    setBusyShiftId(shiftId);
    try {
      const res = await api.post(`/staff/shifts/${shiftId}/clock-out`, {});
      const updated = res.data?.data;
      const earlyLeave = Boolean(res.data?.earlyLeave);
      setShifts((prev) =>
        prev.map((s) =>
          s.id === shiftId
            ? { ...s, status: 'completed', actual_end: updated?.actual_end ?? new Date().toISOString() }
            : s
        )
      );
      setCurrentShift((prev) =>
        prev?.id === shiftId
          ? { ...prev, status: 'completed', actual_end: updated?.actual_end ?? new Date().toISOString() }
          : prev
      );
      if (earlyLeave) {
        setReasonText('');
        setReasonModal({ shiftId, kind: 'early' });
        toast.info(res.data?.message || 'Clocked out early');
      } else {
        toast.success(res.data?.message || 'Clocked out');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not clock out');
    } finally {
      setBusyShiftId(null);
    }
  };

  const submitReason = async () => {
    if (!reasonModal) return;
    const text = reasonText.trim();
    if (!text) {
      setReasonModal(null);
      return;
    }
    setReasonSubmitting(true);
    try {
      const body =
        reasonModal.kind === 'late' ? { lateReason: text } : { earlyLeaveReason: text };
      await api.patch(`/staff/shifts/${reasonModal.shiftId}/reasons`, body);
      setShifts((prev) =>
        prev.map((s) =>
          s.id === reasonModal.shiftId
            ? reasonModal.kind === 'late'
              ? { ...s, late_reason: text }
              : { ...s, early_leave_reason: text }
            : s
        )
      );
      setReasonModal(null);
      setReasonText('');
      toast.success('Reason recorded');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not save reason');
    } finally {
      setReasonSubmitting(false);
    }
  };

  const submitSwap = async () => {
    if (!swapModal) return;
    const reason = swapReason.trim();
    if (!reason) {
      toast.error('Please enter a reason for the swap');
      return;
    }
    setSwapSubmitting(true);
    try {
      await api.post('/staff/shifts/swap', { shiftId: swapModal.shiftId, reason });
      toast.success('Swap requested');
      setSwapModal(null);
      setSwapReason('');
      const res = await api.get('/staff/shifts/swap/me');
      setSwapRequests(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not request swap');
    } finally {
      setSwapSubmitting(false);
    }
  };

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

  // Soonest shift that hasn't finished yet — the fallback hero when there is
  // no "right now" shift from /staff/shifts/me/current.
  const nextShift = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return shifts
      .filter((s) => (s.status === 'scheduled' || s.status === 'active') && s.shift_date >= today)
      .sort((a, b) => `${a.shift_date}T${a.start_time}`.localeCompare(`${b.shift_date}T${b.start_time}`))[0];
  }, [shifts]);

  // Latest swap request per shift (backend returns created_at desc).
  const swapByShift = useMemo(() => {
    const map = new Map<string, SwapRequestRow>();
    for (const req of swapRequests) {
      if (!map.has(req.original_shift_id)) map.set(req.original_shift_id, req);
    }
    return map;
  }, [swapRequests]);

  // The hero is the "right now" state from /staff/shifts/me/current; only when
  // there is no active/scheduled-for-today shift do we fall back to the next
  // upcoming one.
  const heroShift = currentShift ?? nextShift;
  const isHeroToday = heroShift ? formatRelativeDay(heroShift.shift_date) === 'Today' : false;
  const heroCanClockIn = heroShift?.status === 'scheduled' && isHeroToday && !heroShift.actual_start;
  const heroCanClockOut = heroShift?.status === 'active' && !heroShift.actual_end;
  const heroElapsedMinutes =
    heroShift?.status === 'active' && heroShift.actual_start
      ? Math.max(0, Math.floor((now - new Date(heroShift.actual_start).getTime()) / 60000))
      : null;

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

      {/* Now / next shift hero */}
      {heroShift && (
        <motion.div variants={fadeInUp}>
          <Card className="overflow-hidden border-blue-200 dark:border-blue-900/60">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-white flex items-center justify-between">
              <p className="text-sm font-medium text-blue-100 uppercase tracking-wide">
                {heroShift.status === 'active' ? 'On shift now' : currentShift ? 'Today' : 'Up next'}
              </p>
              {heroElapsedMinutes !== null && (
                <span className="font-mono text-sm font-semibold tabular-nums">
                  {formatDuration(heroElapsedMinutes)} elapsed
                </span>
              )}
            </div>
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                    <Clock className="w-7 h-7 text-blue-600 dark:text-blue-300" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">
                      {formatRelativeDay(heroShift.shift_date) || formatShiftDate(heroShift.shift_date)}
                    </p>
                    <p className="text-slate-500 dark:text-slate-400">
                      {formatClockTime(heroShift.start_time)} – {formatClockTime(heroShift.end_time)}
                      <span className="mx-1.5">·</span>
                      {formatDuration(shiftDuration(heroShift.start_time, heroShift.end_time))}
                    </p>
                    {heroShift.department && (
                      <p className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {heroShift.department}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_STYLE[heroShift.status].chip}`}>
                    {STATUS_STYLE[heroShift.status].label}
                  </span>
                  {heroCanClockIn && (
                    <Button size="sm" onClick={() => clockIn(heroShift.id)} disabled={busyShiftId === heroShift.id}>
                      {busyShiftId === heroShift.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogIn className="h-4 w-4 mr-2" />}
                      Clock in
                    </Button>
                  )}
                  {heroCanClockOut && (
                    <Button size="sm" variant="outline" onClick={() => clockOut(heroShift.id)} disabled={busyShiftId === heroShift.id}>
                      {busyShiftId === heroShift.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogOut className="h-4 w-4 mr-2" />}
                      Clock out
                    </Button>
                  )}
                </div>
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
                    const isToday = formatRelativeDay(shift.shift_date) === 'Today';
                    const canClockIn = shift.status === 'scheduled' && isToday && !shift.actual_start;
                    const canClockOut = shift.status === 'active' && !shift.actual_end;
                    const swap = swapByShift.get(shift.id);
                    const swapActive = !!swap && ACTIVE_SWAP_STATUSES.has(swap.status);
                    const canRequestSwap =
                      (shift.status === 'scheduled' || shift.status === 'active') && !swapActive;
                    const busy = busyShiftId === shift.id;
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
                            <div className="flex flex-col items-end gap-1">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${status.chip}`}>
                                {status.label}
                              </span>
                              {swap && (
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${SWAP_STATUS_STYLE[swap.status].chip}`}>
                                  {SWAP_STATUS_STYLE[swap.status].label}
                                </span>
                              )}
                            </div>
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

                          {(canClockIn || canClockOut || canRequestSwap) && (
                            <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
                              {canClockIn && (
                                <Button size="sm" onClick={() => clockIn(shift.id)} disabled={busy}>
                                  {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogIn className="h-4 w-4 mr-2" />}
                                  Clock in
                                </Button>
                              )}
                              {canClockOut && (
                                <Button size="sm" variant="outline" onClick={() => clockOut(shift.id)} disabled={busy}>
                                  {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogOut className="h-4 w-4 mr-2" />}
                                  Clock out
                                </Button>
                              )}
                              {canRequestSwap && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSwapReason('');
                                    setSwapModal({
                                      shiftId: shift.id,
                                      shiftLabel: `${formatShiftDate(shift.shift_date)} · ${formatClockTime(shift.start_time)} – ${formatClockTime(shift.end_time)}`,
                                    });
                                  }}
                                >
                                  <Repeat className="h-4 w-4 mr-2" />
                                  Request Swap
                                </Button>
                              )}
                            </div>
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

      {/* Swap Request Modal */}
      {swapModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="swap-modal-title"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setSwapModal(null);
          }}
        >
          <Card className="max-w-md w-full">
            <CardContent className="p-6">
              <h3 id="swap-modal-title" className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                Request a shift swap
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                {swapModal.shiftLabel}
              </p>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Reason
              </label>
              <textarea
                value={swapReason}
                onChange={(e) => setSwapReason(e.target.value)}
                placeholder="Why do you need this shift covered?"
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
              />
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 mb-4">
                Your request is open to all staff; a manager approves the swap once someone accepts.
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setSwapModal(null)} disabled={swapSubmitting}>
                  Cancel
                </Button>
                <Button onClick={submitSwap} disabled={swapSubmitting}>
                  {swapSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Request Swap
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Late / early-leave reason modal */}
      {reasonModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reason-modal-title"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setReasonModal(null);
          }}
        >
          <Card className="max-w-md w-full">
            <CardContent className="p-6">
              <h3 id="reason-modal-title" className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                {reasonModal.kind === 'late' ? 'Why were you late?' : 'Why are you leaving early?'}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Optional — your manager can see this reason.
              </p>
              <textarea
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                placeholder={reasonModal.kind === 'late' ? 'e.g. traffic, transport delay' : 'e.g. feeling unwell, appointment'}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
              />
              <div className="flex gap-2 justify-end mt-4">
                <Button variant="outline" onClick={() => setReasonModal(null)} disabled={reasonSubmitting}>
                  Skip
                </Button>
                <Button onClick={submitReason} disabled={reasonSubmitting}>
                  {reasonSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Save Reason
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </motion.div>
  );
}
