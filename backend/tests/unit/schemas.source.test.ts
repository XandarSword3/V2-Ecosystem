import { describe, it, expect } from 'vitest';

// Import the actual source validation schemas
import {
  uuidSchema,
  phoneSchema,
  sanitizedString,
  nameSchema,
  emailSchema,
  dateSchema,
  positiveNumberSchema,
  positiveIntSchema,
  paginationSchema,
  purchasePoolTicketSchema,
  createSnackOrderSchema,
  createRestaurantOrderSchema,
  createPaymentIntentSchema,
  recordCashPaymentSchema,
} from '../../src/validation/schemas';

describe('Validation Schemas (Source)', () => {
  describe('uuidSchema', () => {
    it('should accept valid UUIDs', () => {
      expect(uuidSchema.safeParse('123e4567-e89b-12d3-a456-426614174000').success).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(uuidSchema.safeParse('not-a-uuid').success).toBe(false);
    });
  });

  describe('phoneSchema', () => {
    it('should accept valid phone numbers', () => {
      expect(phoneSchema.safeParse('+1234567890').success).toBe(true);
      expect(phoneSchema.safeParse('(555) 123-4567').success).toBe(true);
    });

    it('should accept null', () => {
      expect(phoneSchema.safeParse(null).success).toBe(true);
    });

    it('should accept undefined', () => {
      expect(phoneSchema.safeParse(undefined).success).toBe(true);
    });
  });

  describe('sanitizedString', () => {
    it('should accept valid strings', () => {
      const schema = sanitizedString(100);
      expect(schema.safeParse('Hello World').success).toBe(true);
    });

    it('should strip HTML tags', () => {
      const schema = sanitizedString(100);
      const result = schema.parse('<script>alert("xss")</script>Hello');
      expect(result).toBe('alert("xss")Hello');
    });

    it('should trim whitespace', () => {
      const schema = sanitizedString(100);
      const result = schema.parse('  Hello World  ');
      expect(result).toBe('Hello World');
    });

    it('should reject strings exceeding max length', () => {
      const schema = sanitizedString(10);
      expect(schema.safeParse('a'.repeat(11)).success).toBe(false);
    });
  });

  describe('nameSchema', () => {
    it('should accept valid names', () => {
      expect(nameSchema.safeParse('John Doe').success).toBe(true);
      expect(nameSchema.safeParse("O'Connor").success).toBe(true);
      expect(nameSchema.safeParse('Mary-Jane').success).toBe(true);
    });

    it('should reject names with numbers', () => {
      expect(nameSchema.safeParse('John123').success).toBe(false);
    });

    it('should reject too short names', () => {
      expect(nameSchema.safeParse('A').success).toBe(false);
    });
  });

  describe('emailSchema', () => {
    it('should accept valid emails', () => {
      expect(emailSchema.safeParse('test@example.com').success).toBe(true);
    });

    it('should convert to lowercase', () => {
      expect(emailSchema.parse('TEST@EXAMPLE.COM')).toBe('test@example.com');
    });

    it('should reject invalid emails', () => {
      expect(emailSchema.safeParse('not-an-email').success).toBe(false);
    });
  });

  describe('dateSchema', () => {
    it('should accept valid ISO date strings', () => {
      expect(dateSchema.safeParse('2024-01-15').success).toBe(true);
      expect(dateSchema.safeParse('2024-01-15T10:30:00Z').success).toBe(true);
    });

    it('should reject invalid date strings', () => {
      expect(dateSchema.safeParse('not-a-date').success).toBe(false);
    });
  });

  describe('positiveNumberSchema', () => {
    it('should accept positive numbers', () => {
      expect(positiveNumberSchema.safeParse(1).success).toBe(true);
      expect(positiveNumberSchema.safeParse(0.5).success).toBe(true);
    });

    it('should reject zero', () => {
      expect(positiveNumberSchema.safeParse(0).success).toBe(false);
    });

    it('should reject negative numbers', () => {
      expect(positiveNumberSchema.safeParse(-1).success).toBe(false);
    });
  });

  describe('positiveIntSchema', () => {
    it('should accept positive integers', () => {
      expect(positiveIntSchema.safeParse(1).success).toBe(true);
      expect(positiveIntSchema.safeParse(100).success).toBe(true);
    });

    it('should reject decimals', () => {
      expect(positiveIntSchema.safeParse(1.5).success).toBe(false);
    });

    it('should reject zero', () => {
      expect(positiveIntSchema.safeParse(0).success).toBe(false);
    });
  });

  describe('paginationSchema', () => {
    it('should accept valid pagination', () => {
      const result = paginationSchema.safeParse({ page: 1, limit: 20 });
      expect(result.success).toBe(true);
    });

    it('should use defaults when not provided', () => {
      const result = paginationSchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should coerce string values', () => {
      const result = paginationSchema.parse({ page: '5', limit: '50' });
      expect(result.page).toBe(5);
      expect(result.limit).toBe(50);
    });
  });

  describe('purchasePoolTicketSchema', () => {
    it('should accept valid pool ticket purchase', () => {
      const validTicket = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        ticketDate: '2024-07-15',
        customerName: 'John Doe',
        customerPhone: '+1234567890',
        numberOfGuests: 4,
        paymentMethod: 'card',
      };
      expect(purchasePoolTicketSchema.safeParse(validTicket).success).toBe(true);
    });

    it('should reject more than 20 guests', () => {
      const invalidTicket = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        ticketDate: '2024-07-15',
        customerName: 'John Doe',
        numberOfGuests: 21,
        paymentMethod: 'cash',
      };
      expect(purchasePoolTicketSchema.safeParse(invalidTicket).success).toBe(false);
    });
  });

  describe('createSnackOrderSchema', () => {
    it('should accept valid snack order', () => {
      const validOrder = {
        customerName: 'Jane Doe',
        customerPhone: '+1234567890',
        items: [
          { itemId: '123e4567-e89b-12d3-a456-426614174000', quantity: 2 }
        ],
        paymentMethod: 'cash',
      };
      expect(createSnackOrderSchema.safeParse(validOrder).success).toBe(true);
    });

    it('should reject empty items array', () => {
      const emptyOrder = {
        customerName: 'Jane Doe',
        items: [],
        paymentMethod: 'cash',
      };
      expect(createSnackOrderSchema.safeParse(emptyOrder).success).toBe(false);
    });
  });

  describe('createRestaurantOrderSchema', () => {
    it('should accept valid restaurant order', () => {
      const validOrder = {
        orderType: 'dine_in',
        tableNumber: '5',
        items: [
          { menuItemId: '123e4567-e89b-12d3-a456-426614174000', quantity: 1 }
        ],
      };
      expect(createRestaurantOrderSchema.safeParse(validOrder).success).toBe(true);
    });

    it('should accept takeaway order', () => {
      const takeawayOrder = {
        orderType: 'takeaway',
        customerName: 'John Doe',
        customerPhone: '+1234567890',
        items: [
          { menuItemId: '123e4567-e89b-12d3-a456-426614174000', quantity: 2 }
        ],
      };
      expect(createRestaurantOrderSchema.safeParse(takeawayOrder).success).toBe(true);
    });

    it('should reject invalid order type', () => {
      const invalidOrder = {
        orderType: 'invalid_type',
        items: [
          { menuItemId: '123e4567-e89b-12d3-a456-426614174000', quantity: 1 }
        ],
      };
      expect(createRestaurantOrderSchema.safeParse(invalidOrder).success).toBe(false);
    });
  });

  describe('createPaymentIntentSchema', () => {
    it('should accept valid payment intent', () => {
      const validPayment = {
        amount: 50,
        currency: 'usd',
        referenceType: 'restaurant_order',
        referenceId: '123e4567-e89b-12d3-a456-426614174000',
      };
      expect(createPaymentIntentSchema.safeParse(validPayment).success).toBe(true);
    });

    it('should default currency to usd', () => {
      const payment = {
        amount: 50,
        referenceType: 'snack_order',
        referenceId: '123e4567-e89b-12d3-a456-426614174000',
      };
      const result = createPaymentIntentSchema.parse(payment);
      expect(result.currency).toBe('usd');
    });

    it('should reject amount exceeding maximum', () => {
      const invalidPayment = {
        amount: 100001,
        referenceType: 'chalet_booking',
        referenceId: '123e4567-e89b-12d3-a456-426614174000',
      };
      expect(createPaymentIntentSchema.safeParse(invalidPayment).success).toBe(false);
    });
  });

  describe('recordCashPaymentSchema', () => {
    it('should accept valid cash payment', () => {
      const validPayment = {
        referenceType: 'pool_ticket',
        referenceId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 25.50,
      };
      expect(recordCashPaymentSchema.safeParse(validPayment).success).toBe(true);
    });

    it('should accept optional notes', () => {
      const paymentWithNotes = {
        referenceType: 'restaurant_order',
        referenceId: '123e4567-e89b-12d3-a456-426614174000',
        amount: 100,
        notes: 'Paid in full',
      };
      expect(recordCashPaymentSchema.safeParse(paymentWithNotes).success).toBe(true);
    });
  });
});
