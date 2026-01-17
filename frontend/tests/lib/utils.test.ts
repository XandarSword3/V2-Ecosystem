/**
 * Utils Unit Tests
 * 
 * Tests for frontend utility functions in lib/utils.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cn,
  formatCurrency,
  formatDate,
  formatTime,
  formatDateTime,
  getOrderStatusColor,
  getPaymentStatusColor,
  getBookingStatusColor,
  calculateNights,
  isWeekend,
  truncateText,
  debounce,
} from '../../src/lib/utils';

describe('Utils', () => {
  // ============================================
  // CN (Class Name Merge) TESTS
  // ============================================

  describe('cn', () => {
    it('should merge class names', () => {
      expect(cn('px-4', 'py-2')).toBe('px-4 py-2');
    });

    it('should handle conditional classes', () => {
      expect(cn('base', true && 'active', false && 'hidden')).toBe('base active');
    });

    it('should merge conflicting tailwind classes', () => {
      expect(cn('px-4', 'px-8')).toBe('px-8');
    });

    it('should handle arrays', () => {
      expect(cn(['px-4', 'py-2'])).toBe('px-4 py-2');
    });

    it('should handle undefined and null', () => {
      expect(cn('px-4', undefined, null, 'py-2')).toBe('px-4 py-2');
    });

    it('should handle objects', () => {
      expect(cn({ 'text-red': true, 'bg-blue': false })).toBe('text-red');
    });
  });

  // ============================================
  // FORMAT CURRENCY TESTS
  // ============================================

  describe('formatCurrency', () => {
    it('should format USD correctly', () => {
      const result = formatCurrency(100, 'USD');
      expect(result).toBe('$100.00');
    });

    it('should format EUR correctly', () => {
      const result = formatCurrency(100, 'EUR');
      // EUR rate is approximately 0.93
      expect(result).toContain('€');
    });

    it('should format LBP correctly with custom symbol', () => {
      const result = formatCurrency(1, 'LBP');
      // LBP rate is 89500
      expect(result).toContain('ل.ل');
      expect(result).toContain('89,500');
    });

    it('should handle undefined amount', () => {
      expect(formatCurrency(undefined, 'USD')).toBe('$0.00');
    });

    it('should handle null amount', () => {
      expect(formatCurrency(null, 'USD')).toBe('$0.00');
    });

    it('should handle string amounts', () => {
      expect(formatCurrency('50.5', 'USD')).toBe('$50.50');
    });

    it('should default to USD if no currency specified', () => {
      expect(formatCurrency(100)).toBe('$100.00');
    });
  });

  // ============================================
  // FORMAT DATE TESTS
  // ============================================

  describe('formatDate', () => {
    it('should format date string correctly', () => {
      const result = formatDate('2024-01-15');
      expect(result).toBe('January 15, 2024');
    });

    it('should format Date object correctly', () => {
      const result = formatDate(new Date('2024-06-20'));
      expect(result).toBe('June 20, 2024');
    });

    it('should respect custom options', () => {
      const result = formatDate('2024-01-15', { month: 'short' });
      expect(result).toContain('Jan');
    });
  });

  describe('formatTime', () => {
    it('should format time correctly', () => {
      const date = new Date('2024-01-15T14:30:00');
      const result = formatTime(date);
      expect(result).toMatch(/02:30 PM|14:30/);
    });
  });

  describe('formatDateTime', () => {
    it('should format date and time together', () => {
      const date = new Date('2024-01-15T14:30:00');
      const result = formatDateTime(date);
      expect(result).toContain('Jan');
      expect(result).toContain('15');
      expect(result).toContain('2024');
    });
  });

  // ============================================
  // STATUS COLOR TESTS
  // ============================================

  describe('getOrderStatusColor', () => {
    it('should return correct color for pending', () => {
      expect(getOrderStatusColor('pending')).toBe('status-pending');
    });

    it('should return correct color for confirmed', () => {
      expect(getOrderStatusColor('confirmed')).toBe('status-confirmed');
    });

    it('should return correct color for preparing', () => {
      expect(getOrderStatusColor('preparing')).toBe('status-preparing');
    });

    it('should return correct color for ready', () => {
      expect(getOrderStatusColor('ready')).toBe('status-ready');
    });

    it('should return correct color for completed', () => {
      expect(getOrderStatusColor('completed')).toBe('status-completed');
    });

    it('should return correct color for cancelled', () => {
      expect(getOrderStatusColor('cancelled')).toBe('status-cancelled');
    });

    it('should return default for unknown status', () => {
      expect(getOrderStatusColor('unknown')).toBe('badge-info');
    });
  });

  describe('getPaymentStatusColor', () => {
    it('should return correct color for pending', () => {
      expect(getPaymentStatusColor('pending')).toBe('badge-warning');
    });

    it('should return correct color for paid', () => {
      expect(getPaymentStatusColor('paid')).toBe('badge-success');
    });

    it('should return correct color for refunded', () => {
      expect(getPaymentStatusColor('refunded')).toBe('badge-danger');
    });

    it('should return default for unknown status', () => {
      expect(getPaymentStatusColor('unknown')).toBe('badge-info');
    });
  });

  describe('getBookingStatusColor', () => {
    it('should return correct color for pending', () => {
      expect(getBookingStatusColor('pending')).toBe('badge-warning');
    });

    it('should return correct color for confirmed', () => {
      expect(getBookingStatusColor('confirmed')).toBe('badge-info');
    });

    it('should return correct color for checked_in', () => {
      expect(getBookingStatusColor('checked_in')).toBe('badge-success');
    });

    it('should return correct color for cancelled', () => {
      expect(getBookingStatusColor('cancelled')).toBe('badge-danger');
    });
  });

  // ============================================
  // DATE CALCULATION TESTS
  // ============================================

  describe('calculateNights', () => {
    it('should calculate nights correctly', () => {
      const checkIn = new Date('2024-01-15');
      const checkOut = new Date('2024-01-18');
      expect(calculateNights(checkIn, checkOut)).toBe(3);
    });

    it('should handle same day (0 nights)', () => {
      const date = new Date('2024-01-15');
      expect(calculateNights(date, date)).toBe(0);
    });

    it('should handle single night', () => {
      const checkIn = new Date('2024-01-15');
      const checkOut = new Date('2024-01-16');
      expect(calculateNights(checkIn, checkOut)).toBe(1);
    });
  });

  describe('isWeekend', () => {
    it('should return true for Friday (Lebanese weekend)', () => {
      const friday = new Date('2024-01-19'); // Friday
      expect(isWeekend(friday)).toBe(true);
    });

    it('should return true for Saturday', () => {
      const saturday = new Date('2024-01-20'); // Saturday
      expect(isWeekend(saturday)).toBe(true);
    });

    it('should return false for Sunday', () => {
      const sunday = new Date('2024-01-21'); // Sunday
      expect(isWeekend(sunday)).toBe(false);
    });

    it('should return false for weekdays', () => {
      const wednesday = new Date('2024-01-17'); // Wednesday
      expect(isWeekend(wednesday)).toBe(false);
    });
  });

  // ============================================
  // TEXT MANIPULATION TESTS
  // ============================================

  describe('truncateText', () => {
    it('should not truncate if text is shorter than max', () => {
      expect(truncateText('Hello', 10)).toBe('Hello');
    });

    it('should truncate and add ellipsis if text is longer', () => {
      expect(truncateText('Hello World', 5)).toBe('Hello...');
    });

    it('should handle exact length', () => {
      expect(truncateText('Hello', 5)).toBe('Hello');
    });

    it('should handle empty string', () => {
      expect(truncateText('', 10)).toBe('');
    });
  });

  // ============================================
  // DEBOUNCE TESTS
  // ============================================

  describe('debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should delay function execution', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should only execute once for rapid calls', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      debouncedFn();
      debouncedFn();

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to debounced function', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn('arg1', 'arg2');

      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should reset timer on new call', () => {
      const fn = vi.fn();
      const debouncedFn = debounce(fn, 100);

      debouncedFn();
      vi.advanceTimersByTime(50);
      debouncedFn(); // Reset timer
      vi.advanceTimersByTime(50);
      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
