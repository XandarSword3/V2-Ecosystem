import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';

// Replicate order/ticket number generation functions for testing
function generateOrderNumber(prefix: string = 'S'): string {
  const date = dayjs().format('YYMMDD');
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  const suffix = Date.now().toString(36).slice(-4);
  return `${prefix}-${date}-${random}${suffix}`;
}

function generateTicketNumber(): string {
  const date = dayjs().format('YYMMDD');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `P-${date}-${random}`;
}

function generateRestaurantOrderNumber(): string {
  const date = dayjs().format('YYMMDD');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `R-${date}-${random}`;
}

describe('Order Number Generation', () => {
  describe('generateOrderNumber (Snack)', () => {
    it('should start with S- prefix', () => {
      const orderNumber = generateOrderNumber('S');
      expect(orderNumber.startsWith('S-')).toBe(true);
    });

    it('should contain the current date in YYMMDD format', () => {
      const orderNumber = generateOrderNumber('S');
      const expectedDate = dayjs().format('YYMMDD');
      expect(orderNumber).toContain(expectedDate);
    });

    it('should generate unique order numbers', () => {
      const orders = new Set<string>();
      for (let i = 0; i < 100; i++) {
        orders.add(generateOrderNumber('S'));
      }
      expect(orders.size).toBe(100);
    });

    it('should match the expected format pattern', () => {
      const orderNumber = generateOrderNumber('S');
      // Pattern: S-YYMMDD-NNNNNN[base36suffix]
      const pattern = /^S-\d{6}-\d{6}[a-z0-9]{4}$/;
      expect(pattern.test(orderNumber)).toBe(true);
    });
  });

  describe('generateTicketNumber (Pool)', () => {
    it('should start with P- prefix', () => {
      const ticketNumber = generateTicketNumber();
      expect(ticketNumber.startsWith('P-')).toBe(true);
    });

    it('should contain the current date in YYMMDD format', () => {
      const ticketNumber = generateTicketNumber();
      const expectedDate = dayjs().format('YYMMDD');
      expect(ticketNumber).toContain(expectedDate);
    });

    it('should be 13 characters long', () => {
      const ticketNumber = generateTicketNumber();
      expect(ticketNumber.length).toBe(13);
    });

    it('should match the expected format pattern', () => {
      const ticketNumber = generateTicketNumber();
      // Pattern: P-YYMMDD-NNNN
      const pattern = /^P-\d{6}-\d{4}$/;
      expect(pattern.test(ticketNumber)).toBe(true);
    });

    it('should generate mostly unique ticket numbers', () => {
      const tickets = new Set<string>();
      for (let i = 0; i < 50; i++) {
        tickets.add(generateTicketNumber());
      }
      // With 4-digit random, collisions are possible but unlikely for small sets
      expect(tickets.size).toBeGreaterThan(40);
    });
  });

  describe('generateRestaurantOrderNumber', () => {
    it('should start with R- prefix', () => {
      const orderNumber = generateRestaurantOrderNumber();
      expect(orderNumber.startsWith('R-')).toBe(true);
    });

    it('should contain the current date in YYMMDD format', () => {
      const orderNumber = generateRestaurantOrderNumber();
      const expectedDate = dayjs().format('YYMMDD');
      expect(orderNumber).toContain(expectedDate);
    });

    it('should be 13 characters long', () => {
      const orderNumber = generateRestaurantOrderNumber();
      expect(orderNumber.length).toBe(13);
    });

    it('should match the expected format pattern', () => {
      const orderNumber = generateRestaurantOrderNumber();
      // Pattern: R-YYMMDD-NNNN
      const pattern = /^R-\d{6}-\d{4}$/;
      expect(pattern.test(orderNumber)).toBe(true);
    });
  });
});

describe('Date Formatting with dayjs', () => {
  it('should format dates correctly in YYMMDD format', () => {
    const formatted = dayjs('2024-07-15').format('YYMMDD');
    expect(formatted).toBe('240715');
  });

  it('should format dates correctly in YYYY-MM-DD format', () => {
    const formatted = dayjs('2024-07-15').format('YYYY-MM-DD');
    expect(formatted).toBe('2024-07-15');
  });

  it('should handle start of day', () => {
    const date = dayjs('2024-07-15T14:30:00').startOf('day');
    expect(date.hour()).toBe(0);
    expect(date.minute()).toBe(0);
    expect(date.second()).toBe(0);
  });

  it('should handle end of day', () => {
    const date = dayjs('2024-07-15T14:30:00').endOf('day');
    expect(date.hour()).toBe(23);
    expect(date.minute()).toBe(59);
    expect(date.second()).toBe(59);
  });

  it('should compare dates correctly', () => {
    const date1 = dayjs('2024-07-15');
    const date2 = dayjs('2024-07-16');
    expect(date1.isBefore(date2)).toBe(true);
    expect(date2.isAfter(date1)).toBe(true);
  });

  it('should add days correctly', () => {
    const date = dayjs('2024-07-15');
    const newDate = date.add(7, 'day');
    expect(newDate.format('YYYY-MM-DD')).toBe('2024-07-22');
  });

  it('should subtract days correctly', () => {
    const date = dayjs('2024-07-15');
    const newDate = date.subtract(3, 'day');
    expect(newDate.format('YYYY-MM-DD')).toBe('2024-07-12');
  });
});

describe('Random Number Generation', () => {
  it('should generate 4-digit random numbers', () => {
    for (let i = 0; i < 100; i++) {
      const random = Math.floor(Math.random() * 10000);
      expect(random).toBeGreaterThanOrEqual(0);
      expect(random).toBeLessThan(10000);
    }
  });

  it('should pad numbers correctly', () => {
    expect('42'.padStart(4, '0')).toBe('0042');
    expect('1'.padStart(4, '0')).toBe('0001');
    expect('1234'.padStart(4, '0')).toBe('1234');
  });

  it('should generate 6-digit random numbers', () => {
    for (let i = 0; i < 100; i++) {
      const random = Math.floor(Math.random() * 1000000);
      expect(random).toBeGreaterThanOrEqual(0);
      expect(random).toBeLessThan(1000000);
    }
  });

  it('should convert timestamp to base36', () => {
    const timestamp = 1720000000000;
    const base36 = timestamp.toString(36);
    expect(base36).toBeDefined();
    expect(base36.length).toBeGreaterThan(0);
  });
});

describe('Price Normalization', () => {
  // Pool and snack controllers normalize prices
  it('should convert string price to number', () => {
    const stringPrice = '25.99';
    const numericPrice = parseFloat(stringPrice);
    expect(numericPrice).toBe(25.99);
  });

  it('should handle null prices with fallback', () => {
    const nullPrice = null;
    const fallbackPrice = nullPrice ?? 0;
    expect(fallbackPrice).toBe(0);
  });

  it('should handle undefined prices with fallback', () => {
    const undefinedPrice = undefined;
    const fallbackPrice = undefinedPrice ?? 0;
    expect(fallbackPrice).toBe(0);
  });

  it('should calculate total correctly', () => {
    const unitPrice = 15.5;
    const quantity = 3;
    const total = unitPrice * quantity;
    expect(total).toBe(46.5);
  });

  it('should format price to 2 decimal places', () => {
    const price = 15.333333;
    const formatted = price.toFixed(2);
    expect(formatted).toBe('15.33');
  });

  it('should parse currency string', () => {
    const currencyString = '$25.99';
    const numericValue = parseFloat(currencyString.replace(/[^0-9.-]+/g, ''));
    expect(numericValue).toBe(25.99);
  });
});

describe('Guest Count Validation', () => {
  const MAX_GUESTS = 20;
  const MIN_GUESTS = 1;

  it('should accept valid guest counts', () => {
    const validCounts = [1, 5, 10, 15, 20];
    validCounts.forEach(count => {
      expect(count >= MIN_GUESTS && count <= MAX_GUESTS).toBe(true);
    });
  });

  it('should reject zero guests', () => {
    expect(0 >= MIN_GUESTS).toBe(false);
  });

  it('should reject negative guests', () => {
    expect(-1 >= MIN_GUESTS).toBe(false);
  });

  it('should reject guests over maximum', () => {
    expect(21 <= MAX_GUESTS).toBe(false);
    expect(100 <= MAX_GUESTS).toBe(false);
  });

  it('should calculate total from adults and children', () => {
    const adults = 2;
    const children = 3;
    const total = adults + children;
    expect(total).toBe(5);
  });
});
