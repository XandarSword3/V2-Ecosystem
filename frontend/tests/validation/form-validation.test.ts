/**
 * Form Validation Tests
 * 
 * Tests for form validation utilities and hooks
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Common validation schemas matching typical resort app forms
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const bookingSchema = z.object({
  chaletId: z.string().uuid('Invalid chalet ID'),
  checkIn: z.string().refine((date) => {
    const checkInDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return checkInDate >= today;
  }, 'Check-in date must be today or later'),
  checkOut: z.string(),
  guests: z.number().min(1, 'At least 1 guest required').max(10, 'Maximum 10 guests'),
  specialRequests: z.string().max(500, 'Maximum 500 characters').optional(),
}).refine((data) => {
  const checkIn = new Date(data.checkIn);
  const checkOut = new Date(data.checkOut);
  return checkOut > checkIn;
}, { message: 'Check-out must be after check-in', path: ['checkOut'] });

const menuItemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  price: z.number().positive('Price must be positive'),
  category: z.enum(['appetizer', 'main', 'dessert', 'beverage']),
  isAvailable: z.boolean(),
  spicyLevel: z.number().min(0).max(5).optional(),
});

const poolTicketSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  sessionId: z.string().uuid('Invalid session ID'),
  guestCount: z.number().min(1, 'At least 1 guest').max(10, 'Maximum 10 guests'),
  email: z.string().email('Invalid email'),
  phone: z.string().regex(/^\+?[\d\s-()]+$/, 'Invalid phone number').optional(),
});

describe('Login Form Validation', () => {
  it('should validate correct login data', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'invalid-email',
      password: 'password123',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Invalid email address');
    }
  });

  it('should reject short password', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: '123',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Password must be at least 6 characters');
    }
  });

  it('should reject empty fields', () => {
    const result = loginSchema.safeParse({
      email: '',
      password: '',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('Booking Form Validation', () => {
  const futureDate = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  it('should validate correct booking data', () => {
    const result = bookingSchema.safeParse({
      chaletId: '550e8400-e29b-41d4-a716-446655440000',
      checkIn: futureDate(1),
      checkOut: futureDate(3),
      guests: 4,
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid chalet ID', () => {
    const result = bookingSchema.safeParse({
      chaletId: 'not-a-uuid',
      checkIn: futureDate(1),
      checkOut: futureDate(3),
      guests: 4,
    });
    expect(result.success).toBe(false);
  });

  it('should reject check-out before check-in', () => {
    const result = bookingSchema.safeParse({
      chaletId: '550e8400-e29b-41d4-a716-446655440000',
      checkIn: futureDate(3),
      checkOut: futureDate(1),
      guests: 4,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const checkOutError = result.error.issues.find(i => i.path[0] === 'checkOut');
      expect(checkOutError).toBeDefined();
    }
  });

  it('should reject zero guests', () => {
    const result = bookingSchema.safeParse({
      chaletId: '550e8400-e29b-41d4-a716-446655440000',
      checkIn: futureDate(1),
      checkOut: futureDate(3),
      guests: 0,
    });
    expect(result.success).toBe(false);
  });

  it('should reject too many guests', () => {
    const result = bookingSchema.safeParse({
      chaletId: '550e8400-e29b-41d4-a716-446655440000',
      checkIn: futureDate(1),
      checkOut: futureDate(3),
      guests: 15,
    });
    expect(result.success).toBe(false);
  });

  it('should allow optional special requests', () => {
    const result = bookingSchema.safeParse({
      chaletId: '550e8400-e29b-41d4-a716-446655440000',
      checkIn: futureDate(1),
      checkOut: futureDate(3),
      guests: 2,
      specialRequests: 'Please prepare a birthday cake',
    });
    expect(result.success).toBe(true);
  });
});

describe('Menu Item Validation', () => {
  it('should validate correct menu item', () => {
    const result = menuItemSchema.safeParse({
      name: 'Grilled Salmon',
      description: 'Fresh Atlantic salmon with herbs',
      price: 24.99,
      category: 'main',
      isAvailable: true,
      spicyLevel: 1,
    });
    expect(result.success).toBe(true);
  });

  it('should reject empty name', () => {
    const result = menuItemSchema.safeParse({
      name: '',
      price: 24.99,
      category: 'main',
      isAvailable: true,
    });
    expect(result.success).toBe(false);
  });

  it('should reject negative price', () => {
    const result = menuItemSchema.safeParse({
      name: 'Test Item',
      price: -5,
      category: 'main',
      isAvailable: true,
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid category', () => {
    const result = menuItemSchema.safeParse({
      name: 'Test Item',
      price: 10,
      category: 'invalid_category',
      isAvailable: true,
    });
    expect(result.success).toBe(false);
  });

  it('should reject spicy level above 5', () => {
    const result = menuItemSchema.safeParse({
      name: 'Spicy Wings',
      price: 15,
      category: 'appetizer',
      isAvailable: true,
      spicyLevel: 10,
    });
    expect(result.success).toBe(false);
  });
});

describe('Pool Ticket Validation', () => {
  it('should validate correct ticket data', () => {
    const result = poolTicketSchema.safeParse({
      date: '2026-02-15',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      guestCount: 3,
      email: 'guest@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid date format', () => {
    const result = poolTicketSchema.safeParse({
      date: '02/15/2026',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      guestCount: 3,
      email: 'guest@example.com',
    });
    expect(result.success).toBe(false);
  });

  it('should validate phone number formats', () => {
    const validPhones = ['+1 234 567 8900', '(123) 456-7890', '+33612345678'];
    
    for (const phone of validPhones) {
      const result = poolTicketSchema.safeParse({
        date: '2026-02-15',
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        guestCount: 2,
        email: 'guest@example.com',
        phone,
      });
      expect(result.success).toBe(true);
    }
  });

  it('should reject invalid phone number', () => {
    const result = poolTicketSchema.safeParse({
      date: '2026-02-15',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      guestCount: 2,
      email: 'guest@example.com',
      phone: 'not-a-phone',
    });
    expect(result.success).toBe(false);
  });
});

describe('Error Message Formatting', () => {
  function formatZodErrors(error: z.ZodError): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const issue of error.issues) {
      const path = issue.path.join('.');
      if (!errors[path]) {
        errors[path] = issue.message;
      }
    }
    return errors;
  }

  it('should format single field error', () => {
    const result = loginSchema.safeParse({ email: 'invalid', password: 'pass' });
    if (!result.success) {
      const formatted = formatZodErrors(result.error);
      expect(formatted.email).toBe('Invalid email address');
    }
  });

  it('should format multiple field errors', () => {
    const result = loginSchema.safeParse({ email: '', password: '' });
    if (!result.success) {
      const formatted = formatZodErrors(result.error);
      expect(Object.keys(formatted).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('should format nested path errors', () => {
    const nestedSchema = z.object({
      user: z.object({
        profile: z.object({
          name: z.string().min(1),
        }),
      }),
    });

    const result = nestedSchema.safeParse({ user: { profile: { name: '' } } });
    if (!result.success) {
      const formatted = formatZodErrors(result.error);
      expect(formatted['user.profile.name']).toBeDefined();
    }
  });
});
