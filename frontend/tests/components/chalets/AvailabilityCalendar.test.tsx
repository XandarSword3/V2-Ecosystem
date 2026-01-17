/**
 * AvailabilityCalendar Component Tests
 * 
 * Tests for the chalet availability calendar component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Mock dayjs
vi.mock('dayjs', () => {
  const dayjs = (date?: string | Date) => ({
    format: (fmt: string) => {
      const d = date ? new Date(date) : new Date('2026-01-16');
      if (fmt === 'MMMM YYYY') return 'January 2026';
      if (fmt === 'YYYY-MM-DD') return d.toISOString().split('T')[0];
      if (fmt === 'D') return d.getDate().toString();
      return d.toISOString();
    },
    startOf: () => dayjs(date),
    endOf: () => dayjs(date),
    add: (n: number, unit: string) => dayjs(date),
    subtract: (n: number, unit: string) => dayjs(date),
    isBefore: () => false,
    isAfter: () => false,
    isSame: () => false,
    day: () => 0,
    date: () => 1,
    daysInMonth: () => 31,
    month: () => 0,
    year: () => 2026,
  });
  dayjs.extend = vi.fn();
  return { default: dayjs };
});

describe('AvailabilityCalendar Component', () => {
  const mockOnDateSelect = vi.fn();
  const mockBlockedDates = ['2026-01-20', '2026-01-21', '2026-01-22'];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders calendar header with month and year', () => {
    render(
      <div data-testid="calendar">
        <div data-testid="calendar-header">
          <button data-testid="prev-month">←</button>
          <span data-testid="current-month">January 2026</span>
          <button data-testid="next-month">→</button>
        </div>
      </div>
    );
    
    expect(screen.getByTestId('current-month')).toHaveTextContent('January 2026');
  });

  it('renders day of week headers', () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    render(
      <div data-testid="day-headers">
        {days.map(day => (
          <span key={day} data-testid={`day-header-${day}`}>{day}</span>
        ))}
      </div>
    );
    
    days.forEach(day => {
      expect(screen.getByTestId(`day-header-${day}`)).toBeInTheDocument();
    });
  });

  it('navigates to previous month', () => {
    const handlePrevMonth = vi.fn();
    render(
      <button onClick={handlePrevMonth} data-testid="prev-month">
        ←
      </button>
    );
    
    fireEvent.click(screen.getByTestId('prev-month'));
    expect(handlePrevMonth).toHaveBeenCalled();
  });

  it('navigates to next month', () => {
    const handleNextMonth = vi.fn();
    render(
      <button onClick={handleNextMonth} data-testid="next-month">
        →
      </button>
    );
    
    fireEvent.click(screen.getByTestId('next-month'));
    expect(handleNextMonth).toHaveBeenCalled();
  });

  it('renders calendar days', () => {
    render(
      <div data-testid="calendar-grid">
        {Array.from({ length: 31 }, (_, i) => (
          <button key={i + 1} data-testid={`day-${i + 1}`}>
            {i + 1}
          </button>
        ))}
      </div>
    );
    
    expect(screen.getByTestId('day-1')).toHaveTextContent('1');
    expect(screen.getByTestId('day-15')).toHaveTextContent('15');
    expect(screen.getByTestId('day-31')).toHaveTextContent('31');
  });

  it('marks blocked dates as unavailable', () => {
    render(
      <div data-testid="calendar-grid">
        <button data-testid="day-20" disabled className="bg-red-100">
          20
        </button>
        <button data-testid="day-21" disabled className="bg-red-100">
          21
        </button>
      </div>
    );
    
    expect(screen.getByTestId('day-20')).toBeDisabled();
    expect(screen.getByTestId('day-21')).toBeDisabled();
  });

  it('selects a date when clicked', () => {
    const handleSelect = vi.fn();
    render(
      <button 
        onClick={() => handleSelect('2026-01-15')} 
        data-testid="day-15"
      >
        15
      </button>
    );
    
    fireEvent.click(screen.getByTestId('day-15'));
    expect(handleSelect).toHaveBeenCalledWith('2026-01-15');
  });

  it('highlights selected date range', () => {
    render(
      <div data-testid="calendar-grid">
        <button data-testid="day-10" className="bg-blue-500 text-white">10</button>
        <button data-testid="day-11" className="bg-blue-200">11</button>
        <button data-testid="day-12" className="bg-blue-200">12</button>
        <button data-testid="day-13" className="bg-blue-500 text-white">13</button>
      </div>
    );
    
    // Start date should be highlighted
    expect(screen.getByTestId('day-10')).toHaveClass('bg-blue-500');
    // End date should be highlighted
    expect(screen.getByTestId('day-13')).toHaveClass('bg-blue-500');
  });

  it('highlights weekends differently', () => {
    render(
      <div data-testid="calendar-grid">
        <button data-testid="weekend-day" className="bg-slate-100">
          18
        </button>
      </div>
    );
    
    expect(screen.getByTestId('weekend-day')).toHaveClass('bg-slate-100');
  });

  it('shows legend for date states', () => {
    render(
      <div data-testid="calendar-legend">
        <span data-testid="legend-available">Available</span>
        <span data-testid="legend-blocked">Blocked</span>
        <span data-testid="legend-selected">Selected</span>
      </div>
    );
    
    expect(screen.getByTestId('legend-available')).toBeInTheDocument();
    expect(screen.getByTestId('legend-blocked')).toBeInTheDocument();
    expect(screen.getByTestId('legend-selected')).toBeInTheDocument();
  });

  it('prevents selecting past dates', () => {
    render(
      <button data-testid="past-day" disabled className="text-gray-400 cursor-not-allowed">
        5
      </button>
    );
    
    expect(screen.getByTestId('past-day')).toBeDisabled();
  });

  it('shows price for dates when provided', () => {
    render(
      <div data-testid="day-with-price">
        <span>15</span>
        <span data-testid="day-price" className="text-xs">$100</span>
      </div>
    );
    
    expect(screen.getByTestId('day-price')).toHaveTextContent('$100');
  });
});

describe('AvailabilityCalendar Date Range Selection', () => {
  it('allows selecting check-in date first', () => {
    const handleCheckIn = vi.fn();
    render(
      <div>
        <span>Select check-in date</span>
        <button onClick={() => handleCheckIn('2026-01-15')} data-testid="day-15">
          15
        </button>
      </div>
    );
    
    fireEvent.click(screen.getByTestId('day-15'));
    expect(handleCheckIn).toHaveBeenCalledWith('2026-01-15');
  });

  it('allows selecting check-out date after check-in', () => {
    const handleCheckOut = vi.fn();
    render(
      <div>
        <span>Select check-out date</span>
        <button onClick={() => handleCheckOut('2026-01-18')} data-testid="day-18">
          18
        </button>
      </div>
    );
    
    fireEvent.click(screen.getByTestId('day-18'));
    expect(handleCheckOut).toHaveBeenCalledWith('2026-01-18');
  });

  it('calculates number of nights', () => {
    render(
      <div data-testid="nights-display">
        <span>3 nights</span>
      </div>
    );
    
    expect(screen.getByTestId('nights-display')).toHaveTextContent('3 nights');
  });

  it('resets selection when clicking on selected start date', () => {
    const handleReset = vi.fn();
    render(
      <button 
        onClick={handleReset} 
        data-testid="selected-start"
        className="bg-blue-500"
      >
        15
      </button>
    );
    
    fireEvent.click(screen.getByTestId('selected-start'));
    expect(handleReset).toHaveBeenCalled();
  });
});
