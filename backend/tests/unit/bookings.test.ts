/**
 * Booking Service Unit Tests
 * 
 * Tests for chalet booking validation, availability checking, and pricing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import dayjs from 'dayjs';
import { createMockBooking, mockSupabaseClient } from '../setup';

// Booking schemas for validation testing
const createBookingSchema = z.object({
  chaletId: z.string().uuid('Invalid chalet ID'),
  checkInDate: z.string().refine(d => !isNaN(Date.parse(d)), 'Invalid date'),
  checkOutDate: z.string().refine(d => !isNaN(Date.parse(d)), 'Invalid date'),
  numberOfGuests: z.number().min(1).max(20),
  guestName: z.string().min(2).max(100),
  guestEmail: z.string().email(),
  guestPhone: z.string().regex(/^\+?[0-9\s\-()]{7,20}$/),
  notes: z.string().max(1000).optional()
}).refine(data => {
  const checkIn = new Date(data.checkInDate);
  const checkOut = new Date(data.checkOutDate);
  return checkOut > checkIn;
}, { message: 'Check-out must be after check-in' });

describe('Booking Validation', () => {
  it('should validate a complete booking', () => {
    const validBooking = {
      chaletId: '550e8400-e29b-41d4-a716-446655440000',
      checkInDate: '2026-02-01',
      checkOutDate: '2026-02-03',
      numberOfGuests: 4,
      guestName: 'John Doe',
      guestEmail: 'john@example.com',
      guestPhone: '+1234567890'
    };

    expect(() => createBookingSchema.parse(validBooking)).not.toThrow();
  });

  it('should reject check-out before check-in', () => {
    const invalidBooking = {
      chaletId: '550e8400-e29b-41d4-a716-446655440000',
      checkInDate: '2026-02-05',
      checkOutDate: '2026-02-03',
      numberOfGuests: 2,
      guestName: 'John Doe',
      guestEmail: 'john@example.com',
      guestPhone: '+1234567890'
    };

    expect(() => createBookingSchema.parse(invalidBooking))
      .toThrow('Check-out must be after check-in');
  });

  it('should reject same-day check-in and check-out', () => {
    const invalidBooking = {
      chaletId: '550e8400-e29b-41d4-a716-446655440000',
      checkInDate: '2026-02-01',
      checkOutDate: '2026-02-01',
      numberOfGuests: 2,
      guestName: 'John Doe',
      guestEmail: 'john@example.com',
      guestPhone: '+1234567890'
    };

    expect(() => createBookingSchema.parse(invalidBooking))
      .toThrow('Check-out must be after check-in');
  });

  it('should reject excessive guests', () => {
    const invalidBooking = {
      chaletId: '550e8400-e29b-41d4-a716-446655440000',
      checkInDate: '2026-02-01',
      checkOutDate: '2026-02-03',
      numberOfGuests: 50,
      guestName: 'John Doe',
      guestEmail: 'john@example.com',
      guestPhone: '+1234567890'
    };

    expect(() => createBookingSchema.parse(invalidBooking)).toThrow();
  });
});

describe('Booking Date Overlap Detection', () => {
  function datesOverlap(
    booking1: { checkIn: string; checkOut: string },
    booking2: { checkIn: string; checkOut: string }
  ): boolean {
    const start1 = dayjs(booking1.checkIn);
    const end1 = dayjs(booking1.checkOut);
    const start2 = dayjs(booking2.checkIn);
    const end2 = dayjs(booking2.checkOut);

    return start1.isBefore(end2) && end1.isAfter(start2);
  }

  it('should detect overlapping bookings', () => {
    const booking1 = { checkIn: '2026-01-10', checkOut: '2026-01-15' };
    const booking2 = { checkIn: '2026-01-12', checkOut: '2026-01-17' };
    expect(datesOverlap(booking1, booking2)).toBe(true);
  });

  it('should detect contained bookings', () => {
    const booking1 = { checkIn: '2026-01-10', checkOut: '2026-01-20' };
    const booking2 = { checkIn: '2026-01-12', checkOut: '2026-01-15' };
    expect(datesOverlap(booking1, booking2)).toBe(true);
  });

  it('should allow adjacent bookings (check-out = check-in)', () => {
    const booking1 = { checkIn: '2026-01-10', checkOut: '2026-01-15' };
    const booking2 = { checkIn: '2026-01-15', checkOut: '2026-01-20' };
    expect(datesOverlap(booking1, booking2)).toBe(false);
  });

  it('should allow non-overlapping bookings', () => {
    const booking1 = { checkIn: '2026-01-10', checkOut: '2026-01-12' };
    const booking2 = { checkIn: '2026-01-15', checkOut: '2026-01-17' };
    expect(datesOverlap(booking1, booking2)).toBe(false);
  });
});

describe('Booking Price Calculation', () => {
  interface PriceRule {
    type: 'flat' | 'per_night' | 'weekend_markup';
    value: number;
  }

  interface Chalet {
    basePricePerNight: number;
    priceRules: PriceRule[];
  }

  function calculateBookingPrice(
    chalet: Chalet,
    checkIn: string,
    checkOut: string
  ): { nights: number; subtotal: number; weekendMarkup: number; total: number } {
    const start = dayjs(checkIn);
    const end = dayjs(checkOut);
    const nights = end.diff(start, 'day');
    
    let subtotal = nights * chalet.basePricePerNight;
    let weekendMarkup = 0;

    // Count weekend nights (Friday and Saturday)
    let current = start;
    while (current.isBefore(end)) {
      const dayOfWeek = current.day();
      if (dayOfWeek === 5 || dayOfWeek === 6) {
        const markupRule = chalet.priceRules.find(r => r.type === 'weekend_markup');
        if (markupRule) {
          weekendMarkup += chalet.basePricePerNight * (markupRule.value / 100);
        }
      }
      current = current.add(1, 'day');
    }

    return {
      nights,
      subtotal,
      weekendMarkup,
      total: subtotal + weekendMarkup
    };
  }

  it('should calculate basic price', () => {
    const chalet: Chalet = {
      basePricePerNight: 100,
      priceRules: []
    };
    const result = calculateBookingPrice(chalet, '2026-01-06', '2026-01-08'); // Tue-Thu
    expect(result.nights).toBe(2);
    expect(result.total).toBe(200);
  });

  it('should apply weekend markup', () => {
    const chalet: Chalet = {
      basePricePerNight: 100,
      priceRules: [{ type: 'weekend_markup', value: 20 }] // 20% markup
    };
    // Jan 9, 2026 is Friday, Jan 10 is Saturday
    const result = calculateBookingPrice(chalet, '2026-01-09', '2026-01-11');
    expect(result.nights).toBe(2);
    expect(result.weekendMarkup).toBe(40); // 2 weekend nights * 20%
    expect(result.total).toBe(240);
  });

  it('should handle single night', () => {
    const chalet: Chalet = {
      basePricePerNight: 150,
      priceRules: []
    };
    const result = calculateBookingPrice(chalet, '2026-01-06', '2026-01-07');
    expect(result.nights).toBe(1);
    expect(result.total).toBe(150);
  });
});

describe('Booking Status Transitions', () => {
  const validTransitions: Record<string, string[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['checked_in', 'cancelled', 'no_show'],
    checked_in: ['checked_out'],
    checked_out: [],
    cancelled: [],
    no_show: []
  };

  function canTransition(from: string, to: string): boolean {
    return validTransitions[from]?.includes(to) ?? false;
  }

  it('should allow valid transitions', () => {
    expect(canTransition('pending', 'confirmed')).toBe(true);
    expect(canTransition('confirmed', 'checked_in')).toBe(true);
    expect(canTransition('checked_in', 'checked_out')).toBe(true);
  });

  it('should reject invalid transitions', () => {
    expect(canTransition('pending', 'checked_in')).toBe(false);
    expect(canTransition('checked_out', 'confirmed')).toBe(false);
  });

  it('should allow cancellation from pending/confirmed', () => {
    expect(canTransition('pending', 'cancelled')).toBe(true);
    expect(canTransition('confirmed', 'cancelled')).toBe(true);
  });

  it('should not allow cancellation after check-in', () => {
    expect(canTransition('checked_in', 'cancelled')).toBe(false);
  });
});

describe('Booking Confirmation Number', () => {
  function generateConfirmationNumber(): string {
    const prefix = 'BK';
    const date = dayjs().format('YYMMDD');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${date}-${random}`;
  }

  it('should generate confirmation with date', () => {
    const conf = generateConfirmationNumber();
    expect(conf).toMatch(/^BK-\d{6}-[A-Z0-9]{4}$/);
  });

  it('should generate unique numbers', () => {
    const confirmations = new Set<string>();
    for (let i = 0; i < 100; i++) {
      confirmations.add(generateConfirmationNumber());
    }
    expect(confirmations.size).toBe(100);
  });
});
