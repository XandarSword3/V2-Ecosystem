/**
 * Tests for general utility functions
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatTime,
  getOrderStatusColor,
  getPaymentStatusColor,
  getBookingStatusColor,
  calculateNights,
  isWeekend,
  generateOrderNumber,
  formatNumber,
  truncateText,
  debounce,
} from '@/lib/utils';

describe('formatCurrency', () => {
  it('formats USD correctly', () => {
    expect(formatCurrency(25.5, 'USD')).toBe('$25.50');
  });

  it('formats EUR correctly', () => {
    const result = formatCurrency(100, 'EUR');
    expect(result).toContain('€');
  });

  it('formats LBP without decimals', () => {
    const result = formatCurrency(1, 'LBP');
    expect(result).toContain('ل.ل');
  });

  it('handles undefined amount', () => {
    expect(formatCurrency(undefined)).toBe('$0.00');
  });

  it('handles null amount', () => {
    expect(formatCurrency(null)).toBe('$0.00');
  });

  it('handles string amount', () => {
    const result = formatCurrency('25.50' as any, 'USD');
    expect(result).toBe('$25.50');
  });

  it('handles NaN amount', () => {
    expect(formatCurrency(NaN)).toBe('$0.00');
  });

  it('defaults to USD when no currency specified', () => {
    expect(formatCurrency(10)).toBe('$10.00');
  });
});

describe('formatDate', () => {
  it('formats a date string', () => {
    const result = formatDate('2024-01-15');
    expect(result).toContain('January');
    expect(result).toContain('15');
    expect(result).toContain('2024');
  });

  it('formats a Date object', () => {
    const result = formatDate(new Date(2024, 0, 15));
    expect(result).toContain('January');
    expect(result).toContain('15');
  });

  it('accepts custom options', () => {
    const result = formatDate('2024-06-15', { month: 'short' });
    expect(result).toContain('Jun');
  });
});

describe('formatTime', () => {
  it('formats time from date string', () => {
    const result = formatTime('2024-01-15T14:30:00');
    expect(result).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe('getOrderStatusColor', () => {
  it('returns correct color for known statuses', () => {
    expect(getOrderStatusColor('pending')).toBe('status-pending');
    expect(getOrderStatusColor('confirmed')).toBe('status-confirmed');
    expect(getOrderStatusColor('preparing')).toBe('status-preparing');
    expect(getOrderStatusColor('ready')).toBe('status-ready');
    expect(getOrderStatusColor('delivered')).toBe('status-ready');
    expect(getOrderStatusColor('completed')).toBe('status-completed');
    expect(getOrderStatusColor('cancelled')).toBe('status-cancelled');
  });

  it('returns default for unknown status', () => {
    expect(getOrderStatusColor('unknown')).toBe('badge-info');
  });
});

describe('getPaymentStatusColor', () => {
  it('returns correct color for known statuses', () => {
    expect(getPaymentStatusColor('pending')).toBe('badge-warning');
    expect(getPaymentStatusColor('partial')).toBe('badge-info');
    expect(getPaymentStatusColor('paid')).toBe('badge-success');
    expect(getPaymentStatusColor('refunded')).toBe('badge-danger');
  });

  it('returns default for unknown status', () => {
    expect(getPaymentStatusColor('unknown')).toBe('badge-info');
  });
});

describe('getBookingStatusColor', () => {
  it('returns correct color for known statuses', () => {
    expect(getBookingStatusColor('pending')).toBe('badge-warning');
    expect(getBookingStatusColor('confirmed')).toBe('badge-info');
    expect(getBookingStatusColor('checked_in')).toBe('badge-success');
    expect(getBookingStatusColor('checked_out')).toBe('badge-primary');
    expect(getBookingStatusColor('cancelled')).toBe('badge-danger');
    expect(getBookingStatusColor('no_show')).toBe('badge-danger');
  });

  it('returns default for unknown status', () => {
    expect(getBookingStatusColor('unknown')).toBe('badge-info');
  });
});

describe('calculateNights', () => {
  it('calculates 1 night for consecutive days', () => {
    const checkIn = new Date(2024, 0, 15);
    const checkOut = new Date(2024, 0, 16);
    expect(calculateNights(checkIn, checkOut)).toBe(1);
  });

  it('calculates multiple nights', () => {
    const checkIn = new Date(2024, 0, 15);
    const checkOut = new Date(2024, 0, 20);
    expect(calculateNights(checkIn, checkOut)).toBe(5);
  });

  it('handles reversed dates (absolute diff)', () => {
    const checkIn = new Date(2024, 0, 20);
    const checkOut = new Date(2024, 0, 15);
    expect(calculateNights(checkIn, checkOut)).toBe(5);
  });
});

describe('isWeekend', () => {
  it('returns true for Friday', () => {
    // 2024-01-19 is a Friday
    expect(isWeekend(new Date(2024, 0, 19))).toBe(true);
  });

  it('returns true for Saturday', () => {
    // 2024-01-20 is a Saturday
    expect(isWeekend(new Date(2024, 0, 20))).toBe(true);
  });

  it('returns false for Sunday', () => {
    // 2024-01-21 is a Sunday
    expect(isWeekend(new Date(2024, 0, 21))).toBe(false);
  });

  it('returns false for Monday', () => {
    // 2024-01-22 is a Monday
    expect(isWeekend(new Date(2024, 0, 22))).toBe(false);
  });
});

describe('generateOrderNumber', () => {
  it('returns a string starting with ORD-', () => {
    const order = generateOrderNumber();
    expect(order).toMatch(/^ORD-/);
  });

  it('generates unique numbers', () => {
    const orders = new Set(Array.from({ length: 10 }, () => generateOrderNumber()));
    expect(orders.size).toBe(10);
  });

  it('contains uppercase characters', () => {
    const order = generateOrderNumber();
    expect(order).toMatch(/^ORD-[A-Z0-9]+-[A-Z0-9]+$/);
  });
});

describe('formatNumber', () => {
  it('formats large numbers with commas', () => {
    expect(formatNumber(1000000)).toBe('1,000,000');
  });

  it('returns "0" for undefined', () => {
    expect(formatNumber(undefined)).toBe('0');
  });

  it('returns "0" for null', () => {
    expect(formatNumber(null)).toBe('0');
  });

  it('formats small numbers without commas', () => {
    expect(formatNumber(42)).toBe('42');
  });
});

describe('truncateText', () => {
  it('returns original text if shorter than max', () => {
    expect(truncateText('Hello', 10)).toBe('Hello');
  });

  it('returns original text if equal to max', () => {
    expect(truncateText('Hello', 5)).toBe('Hello');
  });

  it('truncates and adds ellipsis if longer', () => {
    expect(truncateText('Hello World', 5)).toBe('Hello...');
  });

  it('handles empty string', () => {
    expect(truncateText('', 5)).toBe('');
  });
});

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('delays execution', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('resets timer on subsequent calls', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    vi.advanceTimersByTime(50);
    debounced();
    vi.advanceTimersByTime(50);

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('passes arguments to the original function', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('arg1', 'arg2');
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });
});
