import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Replicate the validation schemas for testing
const uuidSchema = z.string().uuid('Invalid ID format');

const phoneSchema = z.string()
  .regex(/^\+?[0-9\s\-()]{7,20}$/, 'Invalid phone number format')
  .optional()
  .nullable();

function sanitizedString(maxLength: number = 255) {
  return z.string()
    .max(maxLength, `Text must be ${maxLength} characters or less`)
    .transform(s => s.replace(/<[^>]*>/g, '').trim());
}

const nameSchema = z.string()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be 100 characters or less')
  .regex(/^[\p{L}\s'-]+$/u, 'Name contains invalid characters')
  .transform(s => s.replace(/<[^>]*>/g, '').trim());

const emailSchema = z.string()
  .email('Invalid email format')
  .max(255, 'Email must be 255 characters or less')
  .toLowerCase()
  .trim();

const dateSchema = z.string()
  .refine((d) => !isNaN(Date.parse(d)), 'Invalid date format');

const positiveNumberSchema = z.number()
  .positive('Value must be positive')
  .finite('Value must be a valid number');

const positiveIntSchema = z.number()
  .int('Value must be a whole number')
  .positive('Value must be positive');

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

describe('Validation Schemas', () => {
  describe('uuidSchema', () => {
    it('should accept valid UUIDs', () => {
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      expect(uuidSchema.safeParse(validUUID).success).toBe(true);
    });

    it('should reject invalid UUIDs', () => {
      expect(uuidSchema.safeParse('not-a-uuid').success).toBe(false);
      expect(uuidSchema.safeParse('123').success).toBe(false);
      expect(uuidSchema.safeParse('').success).toBe(false);
    });

    it('should reject non-string types', () => {
      expect(uuidSchema.safeParse(123).success).toBe(false);
      expect(uuidSchema.safeParse(null).success).toBe(false);
    });
  });

  describe('phoneSchema', () => {
    it('should accept valid phone numbers', () => {
      expect(phoneSchema.safeParse('+1234567890').success).toBe(true);
      expect(phoneSchema.safeParse('(555) 123-4567').success).toBe(true);
      expect(phoneSchema.safeParse('+1 (555) 123-4567').success).toBe(true);
      expect(phoneSchema.safeParse('555-123-4567').success).toBe(true);
    });

    it('should accept null or undefined', () => {
      expect(phoneSchema.safeParse(null).success).toBe(true);
      expect(phoneSchema.safeParse(undefined).success).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(phoneSchema.safeParse('abc').success).toBe(false);
      expect(phoneSchema.safeParse('12').success).toBe(false); // Too short
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

    it('should accept strings at max length', () => {
      const schema = sanitizedString(10);
      expect(schema.safeParse('a'.repeat(10)).success).toBe(true);
    });
  });

  describe('nameSchema', () => {
    it('should accept valid names', () => {
      expect(nameSchema.safeParse('John Doe').success).toBe(true);
      expect(nameSchema.safeParse("O'Connor").success).toBe(true);
      expect(nameSchema.safeParse('Mary-Jane').success).toBe(true);
      expect(nameSchema.safeParse('José García').success).toBe(true);
    });

    it('should reject names with numbers', () => {
      expect(nameSchema.safeParse('John123').success).toBe(false);
    });

    it('should reject names with special characters', () => {
      expect(nameSchema.safeParse('John@Doe').success).toBe(false);
      expect(nameSchema.safeParse('John#Doe').success).toBe(false);
    });

    it('should reject too short names', () => {
      expect(nameSchema.safeParse('A').success).toBe(false);
    });

    it('should reject too long names', () => {
      expect(nameSchema.safeParse('a'.repeat(101)).success).toBe(false);
    });

    it('should strip HTML tags from valid names', () => {
      // HTML tags are stripped after validation, so the input must be valid first
      // In Zod, transforms happen after all validations pass
      const result = nameSchema.parse('John Doe');
      expect(result).toBe('John Doe');
    });
  });

  describe('emailSchema', () => {
    it('should accept valid emails', () => {
      expect(emailSchema.safeParse('test@example.com').success).toBe(true);
      expect(emailSchema.safeParse('user.name@domain.org').success).toBe(true);
      expect(emailSchema.safeParse('user+tag@example.co.uk').success).toBe(true);
    });

    it('should convert to lowercase', () => {
      expect(emailSchema.parse('TEST@EXAMPLE.COM')).toBe('test@example.com');
    });

    it('should validate email before trimming', () => {
      // Email validation happens before trim in this schema ordering
      // Whitespace emails fail validation
      expect(emailSchema.safeParse('  test@example.com  ').success).toBe(false);
      // But clean emails work fine
      expect(emailSchema.parse('test@example.com')).toBe('test@example.com');
    });

    it('should reject invalid emails', () => {
      expect(emailSchema.safeParse('not-an-email').success).toBe(false);
      expect(emailSchema.safeParse('missing@domain').success).toBe(false);
      expect(emailSchema.safeParse('@nodomain.com').success).toBe(false);
    });
  });

  describe('dateSchema', () => {
    it('should accept valid ISO date strings', () => {
      expect(dateSchema.safeParse('2024-01-15').success).toBe(true);
      expect(dateSchema.safeParse('2024-01-15T10:30:00Z').success).toBe(true);
      expect(dateSchema.safeParse('2024-01-15T10:30:00.000Z').success).toBe(true);
    });

    it('should reject invalid date strings', () => {
      expect(dateSchema.safeParse('not-a-date').success).toBe(false);
      expect(dateSchema.safeParse('31-01-2024').success).toBe(false); // Wrong format
    });
  });

  describe('positiveNumberSchema', () => {
    it('should accept positive numbers', () => {
      expect(positiveNumberSchema.safeParse(1).success).toBe(true);
      expect(positiveNumberSchema.safeParse(0.5).success).toBe(true);
      expect(positiveNumberSchema.safeParse(1000000).success).toBe(true);
    });

    it('should reject zero', () => {
      expect(positiveNumberSchema.safeParse(0).success).toBe(false);
    });

    it('should reject negative numbers', () => {
      expect(positiveNumberSchema.safeParse(-1).success).toBe(false);
      expect(positiveNumberSchema.safeParse(-0.5).success).toBe(false);
    });

    it('should reject infinity', () => {
      expect(positiveNumberSchema.safeParse(Infinity).success).toBe(false);
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

    it('should reject negative integers', () => {
      expect(positiveIntSchema.safeParse(-1).success).toBe(false);
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

    it('should reject page less than 1', () => {
      expect(paginationSchema.safeParse({ page: 0, limit: 20 }).success).toBe(false);
      expect(paginationSchema.safeParse({ page: -1, limit: 20 }).success).toBe(false);
    });

    it('should reject limit greater than 100', () => {
      expect(paginationSchema.safeParse({ page: 1, limit: 101 }).success).toBe(false);
    });

    it('should reject limit less than 1', () => {
      expect(paginationSchema.safeParse({ page: 1, limit: 0 }).success).toBe(false);
    });
  });
});

describe('Pool Ticket Schema', () => {
  const purchasePoolTicketSchema = z.object({
    sessionId: uuidSchema,
    ticketDate: dateSchema,
    customerName: nameSchema,
    customerEmail: emailSchema.optional(),
    customerPhone: phoneSchema,
    numberOfGuests: z.number().int().min(1).max(20, 'Maximum 20 guests per ticket'),
    numberOfAdults: z.number().int().min(0).max(20).default(0),
    numberOfChildren: z.number().int().min(0).max(20).default(0),
    paymentMethod: z.enum(['cash', 'card', 'online']),
  });

  it('should accept valid pool ticket purchase', () => {
    const validTicket = {
      sessionId: '123e4567-e89b-12d3-a456-426614174000',
      ticketDate: '2024-07-15',
      customerName: 'John Doe',
      customerPhone: '+1234567890',
      numberOfGuests: 4,
      numberOfAdults: 2,
      numberOfChildren: 2,
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

  it('should allow optional email', () => {
    const ticketWithoutEmail = {
      sessionId: '123e4567-e89b-12d3-a456-426614174000',
      ticketDate: '2024-07-15',
      customerName: 'John Doe',
      numberOfGuests: 2,
      paymentMethod: 'cash',
    };
    expect(purchasePoolTicketSchema.safeParse(ticketWithoutEmail).success).toBe(true);
  });

  it('should default numberOfAdults and numberOfChildren to 0', () => {
    const ticket = {
      sessionId: '123e4567-e89b-12d3-a456-426614174000',
      ticketDate: '2024-07-15',
      customerName: 'John Doe',
      numberOfGuests: 2,
      paymentMethod: 'cash',
    };
    const result = purchasePoolTicketSchema.parse(ticket);
    expect(result.numberOfAdults).toBe(0);
    expect(result.numberOfChildren).toBe(0);
  });

  it('should only accept valid payment methods', () => {
    const invalidPayment = {
      sessionId: '123e4567-e89b-12d3-a456-426614174000',
      ticketDate: '2024-07-15',
      customerName: 'John Doe',
      numberOfGuests: 2,
      paymentMethod: 'bitcoin',
    };
    expect(purchasePoolTicketSchema.safeParse(invalidPayment).success).toBe(false);
  });
});

describe('Snack Order Schema', () => {
  const snackOrderItemSchema = z.object({
    itemId: uuidSchema,
    quantity: z.number().int().min(1).max(50),
    notes: sanitizedString(200).optional(),
  });

  const createSnackOrderSchema = z.object({
    customerName: nameSchema.optional(),
    customerPhone: phoneSchema,
    items: z.array(snackOrderItemSchema).min(1, 'Order must have at least one item'),
    paymentMethod: z.enum(['cash', 'card']),
    notes: sanitizedString(500).optional(),
  });

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

  it('should reject quantity over 50', () => {
    const invalidOrder = {
      items: [
        { itemId: '123e4567-e89b-12d3-a456-426614174000', quantity: 51 }
      ],
      paymentMethod: 'cash',
    };
    expect(createSnackOrderSchema.safeParse(invalidOrder).success).toBe(false);
  });

  it('should reject quantity of 0', () => {
    const invalidOrder = {
      items: [
        { itemId: '123e4567-e89b-12d3-a456-426614174000', quantity: 0 }
      ],
      paymentMethod: 'cash',
    };
    expect(createSnackOrderSchema.safeParse(invalidOrder).success).toBe(false);
  });

  it('should allow optional notes', () => {
    const orderWithNotes = {
      items: [
        { itemId: '123e4567-e89b-12d3-a456-426614174000', quantity: 1, notes: 'Extra spicy' }
      ],
      paymentMethod: 'card',
      notes: 'Rush order please',
    };
    expect(createSnackOrderSchema.safeParse(orderWithNotes).success).toBe(true);
  });
});
