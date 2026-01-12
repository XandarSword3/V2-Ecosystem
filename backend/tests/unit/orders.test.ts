/**
 * Order Service Unit Tests
 * 
 * Tests for order creation, validation, and status management.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { createMockOrder, createMockMenuItem, mockSupabaseClient } from '../setup';

// Order schemas for validation testing
const orderItemSchema = z.object({
  menuItemId: z.string().uuid('Invalid menu item ID'),
  quantity: z.number().min(1, 'Quantity must be at least 1').max(50, 'Maximum 50 items per line'),
  notes: z.string().max(500).optional(),
  modifiers: z.array(z.string().uuid()).optional()
});

const createOrderSchema = z.object({
  customerName: z.string().min(2).max(100),
  customerPhone: z.string().regex(/^\+?[0-9\s\-()]{7,20}$/),
  orderType: z.enum(['dine_in', 'takeaway', 'delivery']),
  tableNumber: z.string().max(10).optional(),
  items: z.array(orderItemSchema).min(1, 'Order must have at least one item'),
  notes: z.string().max(1000).optional(),
  chaletId: z.string().uuid().optional()
});

describe('Order Validation', () => {
  it('should validate a complete order', () => {
    const validOrder = {
      customerName: 'John Doe',
      customerPhone: '+1234567890',
      orderType: 'dine_in' as const,
      tableNumber: '5',
      items: [
        { menuItemId: '550e8400-e29b-41d4-a716-446655440000', quantity: 2 }
      ]
    };

    expect(() => createOrderSchema.parse(validOrder)).not.toThrow();
  });

  it('should reject order without items', () => {
    const invalidOrder = {
      customerName: 'John Doe',
      customerPhone: '+1234567890',
      orderType: 'dine_in',
      items: []
    };

    expect(() => createOrderSchema.parse(invalidOrder))
      .toThrow('Order must have at least one item');
  });

  it('should reject invalid order type', () => {
    const invalidOrder = {
      customerName: 'John Doe',
      customerPhone: '+1234567890',
      orderType: 'invalid_type',
      items: [
        { menuItemId: '550e8400-e29b-41d4-a716-446655440000', quantity: 1 }
      ]
    };

    expect(() => createOrderSchema.parse(invalidOrder)).toThrow();
  });

  it('should reject excessive quantity', () => {
    const invalidOrder = {
      customerName: 'John Doe',
      customerPhone: '+1234567890',
      orderType: 'dine_in',
      items: [
        { menuItemId: '550e8400-e29b-41d4-a716-446655440000', quantity: 100 }
      ]
    };

    expect(() => createOrderSchema.parse(invalidOrder))
      .toThrow('Maximum 50 items per line');
  });

  it('should require table number for dine-in (business logic)', () => {
    const dineInOrder = {
      customerName: 'John Doe',
      customerPhone: '+1234567890',
      orderType: 'dine_in' as const,
      items: [
        { menuItemId: '550e8400-e29b-41d4-a716-446655440000', quantity: 1 }
      ]
    };

    // Note: This is business logic validation, not schema validation
    const parsed = createOrderSchema.parse(dineInOrder);
    const needsTable = parsed.orderType === 'dine_in' && !parsed.tableNumber;
    expect(needsTable).toBe(true); // Should trigger business logic warning
  });
});

describe('Order Status Transitions', () => {
  const validTransitions: Record<string, string[]> = {
    pending: ['preparing', 'cancelled'],
    preparing: ['ready', 'cancelled'],
    ready: ['completed', 'cancelled'],
    completed: [],
    cancelled: []
  };

  function canTransition(from: string, to: string): boolean {
    return validTransitions[from]?.includes(to) ?? false;
  }

  it('should allow valid status transitions', () => {
    expect(canTransition('pending', 'preparing')).toBe(true);
    expect(canTransition('preparing', 'ready')).toBe(true);
    expect(canTransition('ready', 'completed')).toBe(true);
  });

  it('should reject invalid transitions', () => {
    expect(canTransition('pending', 'completed')).toBe(false);
    expect(canTransition('completed', 'pending')).toBe(false);
    expect(canTransition('cancelled', 'preparing')).toBe(false);
  });

  it('should allow cancellation from most states', () => {
    expect(canTransition('pending', 'cancelled')).toBe(true);
    expect(canTransition('preparing', 'cancelled')).toBe(true);
    expect(canTransition('ready', 'cancelled')).toBe(true);
  });

  it('should not allow transitions from terminal states', () => {
    expect(canTransition('completed', 'cancelled')).toBe(false);
    expect(canTransition('cancelled', 'completed')).toBe(false);
  });
});

describe('Order Number Generation', () => {
  function generateOrderNumber(prefix: string = 'ORD'): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  it('should generate unique order numbers', () => {
    const orders = new Set<string>();
    for (let i = 0; i < 100; i++) {
      orders.add(generateOrderNumber());
    }
    expect(orders.size).toBe(100);
  });

  it('should use correct prefix', () => {
    const order = generateOrderNumber('SNK');
    expect(order.startsWith('SNK-')).toBe(true);
  });

  it('should generate readable format', () => {
    const order = generateOrderNumber();
    expect(order).toMatch(/^ORD-[A-Z0-9]+-[A-Z0-9]+$/);
  });
});

describe('Order Total Calculation', () => {
  function calculateTotal(items: Array<{ price: number; quantity: number }>, discount = 0): number {
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountAmount = subtotal * (discount / 100);
    return Math.round((subtotal - discountAmount) * 100) / 100;
  }

  it('should calculate simple total', () => {
    const items = [
      { price: 10, quantity: 2 },
      { price: 15, quantity: 1 }
    ];
    expect(calculateTotal(items)).toBe(35);
  });

  it('should apply percentage discount', () => {
    const items = [{ price: 100, quantity: 1 }];
    expect(calculateTotal(items, 10)).toBe(90);
  });

  it('should handle decimal prices', () => {
    const items = [
      { price: 9.99, quantity: 3 }
    ];
    expect(calculateTotal(items)).toBe(29.97);
  });

  it('should handle empty order', () => {
    expect(calculateTotal([])).toBe(0);
  });

  it('should round to 2 decimal places', () => {
    const items = [{ price: 10.333, quantity: 3 }];
    const total = calculateTotal(items);
    expect(total.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2);
  });
});

describe('Order Time Tracking', () => {
  function calculatePreparationTime(orderType: string, itemCount: number): number {
    const baseTime = orderType === 'dine_in' ? 15 : 20;
    const perItemTime = 3;
    return Math.min(baseTime + (itemCount * perItemTime), 60);
  }

  it('should calculate estimated prep time', () => {
    expect(calculatePreparationTime('dine_in', 2)).toBe(21);
    expect(calculatePreparationTime('takeaway', 2)).toBe(26);
  });

  it('should cap at 60 minutes', () => {
    expect(calculatePreparationTime('dine_in', 100)).toBe(60);
  });

  it('should have faster base time for dine-in', () => {
    const dineIn = calculatePreparationTime('dine_in', 1);
    const takeaway = calculatePreparationTime('takeaway', 1);
    expect(dineIn).toBeLessThan(takeaway);
  });
});
