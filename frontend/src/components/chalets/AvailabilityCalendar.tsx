'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface AvailabilityCalendarProps {
  blockedDates?: string[];
  selectedCheckIn?: string;
  selectedCheckOut?: string;
  onDateSelect: (checkIn: string, checkOut: string | null) => void;
  minDate?: Date;
  maxMonthsAhead?: number;
  weekendHighlight?: boolean;
  pricePerNight?: { weekday: number; weekend: number };
  currency?: string;
}

interface CalendarDay {
  date: Date;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isBlocked: boolean;
  isSelected: boolean;
  isInRange: boolean;
  isCheckIn: boolean;
  isCheckOut: boolean;
  isToday: boolean;
  isPast: boolean;
  isWeekend: boolean;
}

function formatDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

function isSameDay(date1: Date, date2: Date): boolean {
  return formatDateString(date1) === formatDateString(date2);
}

function isDateBetween(date: Date, start: Date, end: Date): boolean {
  const d = date.getTime();
  return d > start.getTime() && d < end.getTime();
}

export default function AvailabilityCalendar({
  blockedDates = [],
  selectedCheckIn,
  selectedCheckOut,
  onDateSelect,
  minDate = new Date(),
  maxMonthsAhead = 12,
  weekendHighlight = true,
  pricePerNight,
  currency = 'USD',
}: AvailabilityCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectingCheckOut, setSelectingCheckOut] = useState(false);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  const blockedDateSet = useMemo(() => new Set(blockedDates), [blockedDates]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const checkInDate = useMemo(
    () => (selectedCheckIn ? new Date(selectedCheckIn) : null),
    [selectedCheckIn]
  );

  const checkOutDate = useMemo(
    () => (selectedCheckOut ? new Date(selectedCheckOut) : null),
    [selectedCheckOut]
  );

  // Generate calendar days for current month view
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: CalendarDay[] = [];

    // Add days from previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      days.push(createDayObject(date, false));
    }

    // Add days of current month
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      days.push(createDayObject(date, true));
    }

    // Add days from next month to complete the grid
    const remainingDays = 42 - days.length; // 6 rows x 7 days
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(year, month + 1, i);
      days.push(createDayObject(date, false));
    }

    return days;
  }, [currentMonth, blockedDateSet, checkInDate, checkOutDate, hoverDate, today]);

  function createDayObject(date: Date, isCurrentMonth: boolean): CalendarDay {
    const dateStr = formatDateString(date);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
    const isPast = date < today;
    const isBlocked = blockedDateSet.has(dateStr) || isPast;

    let isSelected = false;
    let isInRange = false;
    let isCheckIn = false;
    let isCheckOut = false;

    if (checkInDate && isSameDay(date, checkInDate)) {
      isCheckIn = true;
      isSelected = true;
    }

    if (checkOutDate && isSameDay(date, checkOutDate)) {
      isCheckOut = true;
      isSelected = true;
    }

    if (checkInDate && checkOutDate && isDateBetween(date, checkInDate, checkOutDate)) {
      isInRange = true;
    }

    // Hover preview when selecting check-out
    if (selectingCheckOut && checkInDate && hoverDate && !checkOutDate) {
      if (isDateBetween(date, checkInDate, hoverDate)) {
        isInRange = true;
      }
      if (isSameDay(date, hoverDate)) {
        isCheckOut = true;
      }
    }

    return {
      date,
      dayOfMonth: date.getDate(),
      isCurrentMonth,
      isBlocked,
      isSelected,
      isInRange,
      isCheckIn,
      isCheckOut,
      isToday: isSameDay(date, today),
      isPast,
      isWeekend,
    };
  }

  const handleDayClick = (day: CalendarDay) => {
    if (day.isBlocked) return;

    const dateStr = formatDateString(day.date);

    if (!selectingCheckOut || !checkInDate) {
      // Selecting check-in date
      onDateSelect(dateStr, null);
      setSelectingCheckOut(true);
    } else {
      // Selecting check-out date
      if (day.date <= checkInDate) {
        // If clicked date is before check-in, make it the new check-in
        onDateSelect(dateStr, null);
      } else {
        // Check if any blocked dates are in between
        const hasBlockedInRange = blockedDates.some(blocked => {
          const blockedDate = new Date(blocked);
          return isDateBetween(blockedDate, checkInDate, day.date);
        });

        if (hasBlockedInRange) {
          // Reset and start over with new check-in
          onDateSelect(dateStr, null);
        } else {
          // Valid check-out selection
          onDateSelect(selectedCheckIn!, dateStr);
          setSelectingCheckOut(false);
        }
      }
    }
  };

  const navigateMonth = (delta: number) => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + delta);
      return newDate;
    });
  };

  const canGoBack = currentMonth > minDate;
  const maxDate = new Date();
  maxDate.setMonth(maxDate.getMonth() + maxMonthsAhead);
  const canGoForward = currentMonth < maxDate;

  const monthYearString = currentMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigateMonth(-1)}
          disabled={!canGoBack}
          className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          {monthYearString}
        </h3>
        <button
          onClick={() => navigateMonth(1)}
          disabled={!canGoForward}
          className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Selection Status */}
      <div className="flex items-center justify-center gap-4 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-green-600" />
          <span className="text-slate-600 dark:text-slate-400">
            {selectingCheckOut && checkInDate ? 'Select check-out' : 'Select check-in'}
          </span>
        </div>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map(day => (
          <div
            key={day}
            className="text-center text-xs font-medium text-slate-500 dark:text-slate-400 py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, index) => {
          const dayClasses = [
            'relative h-12 flex flex-col items-center justify-center rounded-lg text-sm transition-all',
          ];

          if (!day.isCurrentMonth) {
            dayClasses.push('text-slate-300 dark:text-slate-600');
          } else if (day.isBlocked) {
            dayClasses.push('text-slate-300 dark:text-slate-600 line-through cursor-not-allowed');
          } else if (day.isCheckIn) {
            dayClasses.push('bg-green-600 text-white rounded-r-none');
          } else if (day.isCheckOut) {
            dayClasses.push('bg-green-600 text-white rounded-l-none');
          } else if (day.isInRange) {
            dayClasses.push('bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-none');
          } else if (day.isToday) {
            dayClasses.push('border-2 border-green-500 font-bold text-green-600 cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/20');
          } else if (day.isWeekend && weekendHighlight) {
            dayClasses.push('text-amber-600 dark:text-amber-400 cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-900/20');
          } else {
            dayClasses.push('text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700');
          }

          return (
            <button
              key={index}
              onClick={() => handleDayClick(day)}
              onMouseEnter={() => setHoverDate(day.date)}
              onMouseLeave={() => setHoverDate(null)}
              disabled={day.isBlocked || !day.isCurrentMonth}
              className={dayClasses.join(' ')}
            >
              <span>{day.dayOfMonth}</span>
              {pricePerNight && day.isCurrentMonth && !day.isBlocked && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  ${day.isWeekend ? pricePerNight.weekend : pricePerNight.weekday}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-600 rounded"></div>
          <span className="text-slate-600 dark:text-slate-400">Selected</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-100 dark:bg-green-900/30 rounded"></div>
          <span className="text-slate-600 dark:text-slate-400">Your stay</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-slate-200 dark:bg-slate-700 rounded line-through"></div>
          <span className="text-slate-600 dark:text-slate-400">Unavailable</span>
        </div>
        {weekendHighlight && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-amber-400 rounded"></div>
            <span className="text-slate-600 dark:text-slate-400">Weekend</span>
          </div>
        )}
      </div>

      {/* Date Summary */}
      {(checkInDate || checkOutDate) && (
        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Check-in</p>
              <p className="font-semibold text-slate-900 dark:text-white">
                {checkInDate ? checkInDate.toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric' 
                }) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">Check-out</p>
              <p className="font-semibold text-slate-900 dark:text-white">
                {checkOutDate ? checkOutDate.toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric' 
                }) : '—'}
              </p>
            </div>
          </div>
          {checkInDate && checkOutDate && (
            <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24))} nights
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
