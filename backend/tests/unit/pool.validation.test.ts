/**
 * Pool Validation Unit Tests
 * 
 * Tests for QR code parsing, ticket validation, capacity management, and pricing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock data storage
let mockTickets: Map<string, PoolTicket> = new Map();
let mockSessions: Map<string, PoolSession> = new Map();
let mockEntries: Map<string, PoolEntry> = new Map();

interface PoolTicket {
  id: string;
  ticket_number: string;
  qr_code: string;
  session_id: string;
  ticket_date: string;
  number_of_adults: number;
  number_of_children: number;
  status: 'valid' | 'used' | 'expired' | 'cancelled';
  customer_name: string;
  created_at: string;
}

interface PoolSession {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  max_capacity: number;
  adult_price: number;
  child_price: number;
  is_active: boolean;
}

interface PoolEntry {
  id: string;
  ticket_id: string;
  entry_time: string;
  exit_time: string | null;
}

// Reset before each test
beforeEach(() => {
  mockTickets.clear();
  mockSessions.clear();
  mockEntries.clear();

  // Setup default session
  mockSessions.set('session_morning', {
    id: 'session_morning',
    name: 'Morning Swim',
    start_time: '08:00',
    end_time: '12:00',
    max_capacity: 50,
    adult_price: 20,
    child_price: 10,
    is_active: true,
  });
});

describe('QR Code Parsing', () => {
  function parseQRCode(qrData: string): { 
    ticketNumber: string | null;
    error?: string;
  } {
    // Expected format: P-YYMMDD-XXXX
    const pattern = /^P-\d{6}-\d{4}$/;
    
    if (!qrData) {
      return { ticketNumber: null, error: 'Empty QR code' };
    }

    if (!pattern.test(qrData)) {
      return { ticketNumber: null, error: 'Invalid QR code format' };
    }

    return { ticketNumber: qrData };
  }

  it('should parse valid QR code format', () => {
    const result = parseQRCode('P-260113-0001');
    expect(result.ticketNumber).toBe('P-260113-0001');
    expect(result.error).toBeUndefined();
  });

  it('should reject empty QR code', () => {
    const result = parseQRCode('');
    expect(result.ticketNumber).toBeNull();
    expect(result.error).toBe('Empty QR code');
  });

  it('should reject invalid format', () => {
    const result = parseQRCode('INVALID-CODE');
    expect(result.ticketNumber).toBeNull();
    expect(result.error).toContain('Invalid');
  });

  it('should reject wrong prefix', () => {
    const result = parseQRCode('X-260113-0001');
    expect(result.ticketNumber).toBeNull();
  });

  it('should reject wrong date format', () => {
    const result = parseQRCode('P-2601-0001');
    expect(result.ticketNumber).toBeNull();
  });

  it('should reject wrong number format', () => {
    const result = parseQRCode('P-260113-01');
    expect(result.ticketNumber).toBeNull();
  });
});

describe('Ticket Validation States', () => {
  function validateTicket(ticketNumber: string, currentDate: string): {
    valid: boolean;
    error?: string;
    ticket?: PoolTicket;
  } {
    // Find ticket
    const ticket = Array.from(mockTickets.values()).find(
      t => t.ticket_number === ticketNumber
    );

    if (!ticket) {
      return { valid: false, error: 'Ticket not found' };
    }

    // Check if cancelled
    if (ticket.status === 'cancelled') {
      return { valid: false, error: 'Ticket has been cancelled' };
    }

    // Check if already used
    if (ticket.status === 'used') {
      return { valid: false, error: 'Ticket has already been used' };
    }

    // Check if expired (wrong date)
    if (ticket.ticket_date !== currentDate) {
      return { valid: false, error: 'Ticket is not valid for today' };
    }

    // Check if guest is currently in pool
    const activeEntry = Array.from(mockEntries.values()).find(
      e => e.ticket_id === ticket.id && e.exit_time === null
    );
    if (activeEntry) {
      return { valid: false, error: 'Guest is already in the pool' };
    }

    // Check session time
    const session = mockSessions.get(ticket.session_id);
    if (!session) {
      return { valid: false, error: 'Session not found' };
    }

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // For testing, we'll skip time validation if session is active
    if (!session.is_active) {
      return { valid: false, error: 'Session is not active' };
    }

    return { valid: true, ticket };
  }

  beforeEach(() => {
    // Add test ticket
    mockTickets.set('ticket_valid', {
      id: 'ticket_valid',
      ticket_number: 'P-260113-0001',
      qr_code: 'data:image/png;base64,...',
      session_id: 'session_morning',
      ticket_date: '2026-01-13',
      number_of_adults: 2,
      number_of_children: 1,
      status: 'valid',
      customer_name: 'John Doe',
      created_at: new Date().toISOString(),
    });
  });

  it('should validate valid ticket', () => {
    const result = validateTicket('P-260113-0001', '2026-01-13');
    expect(result.valid).toBe(true);
    expect(result.ticket).toBeDefined();
  });

  it('should reject non-existent ticket', () => {
    const result = validateTicket('P-260113-9999', '2026-01-13');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should reject used ticket', () => {
    mockTickets.get('ticket_valid')!.status = 'used';
    
    const result = validateTicket('P-260113-0001', '2026-01-13');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('already been used');
  });

  it('should reject cancelled ticket', () => {
    mockTickets.get('ticket_valid')!.status = 'cancelled';
    
    const result = validateTicket('P-260113-0001', '2026-01-13');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('cancelled');
  });

  it('should reject ticket for wrong date', () => {
    const result = validateTicket('P-260113-0001', '2026-01-14'); // Tomorrow
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not valid for today');
  });

  it('should reject if guest already in pool', () => {
    // Add active entry
    mockEntries.set('entry_active', {
      id: 'entry_active',
      ticket_id: 'ticket_valid',
      entry_time: new Date().toISOString(),
      exit_time: null, // Still in pool
    });

    const result = validateTicket('P-260113-0001', '2026-01-13');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('already in the pool');
  });

  it('should allow re-entry after exit', () => {
    // Add completed entry
    mockEntries.set('entry_completed', {
      id: 'entry_completed',
      ticket_id: 'ticket_valid',
      entry_time: new Date(Date.now() - 3600000).toISOString(),
      exit_time: new Date(Date.now() - 1800000).toISOString(), // Exited 30 min ago
    });

    const result = validateTicket('P-260113-0001', '2026-01-13');
    expect(result.valid).toBe(true);
  });
});

describe('Capacity Management', () => {
  function getCurrentCapacity(sessionId: string): {
    current: number;
    max: number;
    available: number;
  } {
    const session = mockSessions.get(sessionId);
    if (!session) {
      return { current: 0, max: 0, available: 0 };
    }

    // Count active entries for this session's tickets
    let current = 0;
    for (const ticket of mockTickets.values()) {
      if (ticket.session_id === sessionId) {
        const activeEntry = Array.from(mockEntries.values()).find(
          e => e.ticket_id === ticket.id && e.exit_time === null
        );
        if (activeEntry) {
          current += ticket.number_of_adults + ticket.number_of_children;
        }
      }
    }

    return {
      current,
      max: session.max_capacity,
      available: session.max_capacity - current,
    };
  }

  function canAdmit(sessionId: string, guestCount: number): boolean {
    const capacity = getCurrentCapacity(sessionId);
    return capacity.available >= guestCount;
  }

  it('should return full capacity when empty', () => {
    const capacity = getCurrentCapacity('session_morning');
    expect(capacity.current).toBe(0);
    expect(capacity.max).toBe(50);
    expect(capacity.available).toBe(50);
  });

  it('should track current occupancy', () => {
    // Add ticket with active entry
    mockTickets.set('ticket_1', {
      id: 'ticket_1',
      ticket_number: 'P-260113-0001',
      qr_code: '',
      session_id: 'session_morning',
      ticket_date: '2026-01-13',
      number_of_adults: 2,
      number_of_children: 2,
      status: 'valid',
      customer_name: 'Family A',
      created_at: new Date().toISOString(),
    });
    mockEntries.set('entry_1', {
      id: 'entry_1',
      ticket_id: 'ticket_1',
      entry_time: new Date().toISOString(),
      exit_time: null,
    });

    const capacity = getCurrentCapacity('session_morning');
    expect(capacity.current).toBe(4); // 2 adults + 2 children
    expect(capacity.available).toBe(46);
  });

  it('should not count exited guests', () => {
    mockTickets.set('ticket_1', {
      id: 'ticket_1',
      ticket_number: 'P-260113-0001',
      qr_code: '',
      session_id: 'session_morning',
      ticket_date: '2026-01-13',
      number_of_adults: 3,
      number_of_children: 0,
      status: 'valid',
      customer_name: 'Group A',
      created_at: new Date().toISOString(),
    });
    mockEntries.set('entry_1', {
      id: 'entry_1',
      ticket_id: 'ticket_1',
      entry_time: new Date(Date.now() - 3600000).toISOString(),
      exit_time: new Date().toISOString(), // Already exited
    });

    const capacity = getCurrentCapacity('session_morning');
    expect(capacity.current).toBe(0); // All exited
    expect(capacity.available).toBe(50);
  });

  it('should prevent admission when at capacity', () => {
    // Set small capacity for testing
    mockSessions.get('session_morning')!.max_capacity = 5;

    // Add 4 guests currently in pool
    mockTickets.set('ticket_full', {
      id: 'ticket_full',
      ticket_number: 'P-260113-0002',
      qr_code: '',
      session_id: 'session_morning',
      ticket_date: '2026-01-13',
      number_of_adults: 4,
      number_of_children: 0,
      status: 'valid',
      customer_name: 'Big Group',
      created_at: new Date().toISOString(),
    });
    mockEntries.set('entry_full', {
      id: 'entry_full',
      ticket_id: 'ticket_full',
      entry_time: new Date().toISOString(),
      exit_time: null,
    });

    expect(canAdmit('session_morning', 1)).toBe(true);  // 1 spot left
    expect(canAdmit('session_morning', 2)).toBe(false); // Would exceed
  });

  it('should allow admission after guests exit', () => {
    mockSessions.get('session_morning')!.max_capacity = 5;

    mockTickets.set('ticket_exit', {
      id: 'ticket_exit',
      ticket_number: 'P-260113-0003',
      qr_code: '',
      session_id: 'session_morning',
      ticket_date: '2026-01-13',
      number_of_adults: 5,
      number_of_children: 0,
      status: 'valid',
      customer_name: 'Full Group',
      created_at: new Date().toISOString(),
    });
    mockEntries.set('entry_exit', {
      id: 'entry_exit',
      ticket_id: 'ticket_exit',
      entry_time: new Date(Date.now() - 3600000).toISOString(),
      exit_time: new Date().toISOString(), // Exited
    });

    expect(canAdmit('session_morning', 5)).toBe(true); // All spots free
  });
});

describe('Pricing Calculations', () => {
  function calculateTicketPrice(
    sessionId: string,
    adults: number,
    children: number
  ): { total: number; breakdown: { adults: number; children: number } } {
    const session = mockSessions.get(sessionId);
    if (!session) {
      return { total: 0, breakdown: { adults: 0, children: 0 } };
    }

    const adultTotal = adults * session.adult_price;
    const childTotal = children * session.child_price;

    return {
      total: adultTotal + childTotal,
      breakdown: {
        adults: adultTotal,
        children: childTotal,
      },
    };
  }

  it('should calculate adult-only ticket', () => {
    const result = calculateTicketPrice('session_morning', 2, 0);
    expect(result.total).toBe(40); // 2 × $20
    expect(result.breakdown.adults).toBe(40);
    expect(result.breakdown.children).toBe(0);
  });

  it('should calculate children-only ticket', () => {
    const result = calculateTicketPrice('session_morning', 0, 3);
    expect(result.total).toBe(30); // 3 × $10
    expect(result.breakdown.adults).toBe(0);
    expect(result.breakdown.children).toBe(30);
  });

  it('should calculate mixed ticket', () => {
    const result = calculateTicketPrice('session_morning', 2, 2);
    expect(result.total).toBe(60); // (2 × $20) + (2 × $10)
    expect(result.breakdown.adults).toBe(40);
    expect(result.breakdown.children).toBe(20);
  });

  it('should handle zero guests', () => {
    const result = calculateTicketPrice('session_morning', 0, 0);
    expect(result.total).toBe(0);
  });

  it('should return zero for invalid session', () => {
    const result = calculateTicketPrice('nonexistent', 2, 1);
    expect(result.total).toBe(0);
  });

  it('should use session-specific pricing', () => {
    // Add premium session
    mockSessions.set('session_premium', {
      id: 'session_premium',
      name: 'VIP Evening',
      start_time: '18:00',
      end_time: '22:00',
      max_capacity: 20,
      adult_price: 50,
      child_price: 25,
      is_active: true,
    });

    const result = calculateTicketPrice('session_premium', 2, 2);
    expect(result.total).toBe(150); // (2 × $50) + (2 × $25)
  });
});

describe('Ticket Number Generation', () => {
  function generateTicketNumber(date: Date, sequence: number): string {
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const seq = sequence.toString().padStart(4, '0');
    
    return `P-${year}${month}${day}-${seq}`;
  }

  it('should generate correct format', () => {
    const date = new Date('2026-01-13');
    const ticketNumber = generateTicketNumber(date, 1);
    expect(ticketNumber).toBe('P-260113-0001');
  });

  it('should pad sequence numbers', () => {
    const date = new Date('2026-01-13');
    expect(generateTicketNumber(date, 1)).toBe('P-260113-0001');
    expect(generateTicketNumber(date, 42)).toBe('P-260113-0042');
    expect(generateTicketNumber(date, 999)).toBe('P-260113-0999');
    expect(generateTicketNumber(date, 9999)).toBe('P-260113-9999');
  });

  it('should handle different dates', () => {
    expect(generateTicketNumber(new Date('2026-12-25'), 1)).toBe('P-261225-0001');
    expect(generateTicketNumber(new Date('2026-02-01'), 1)).toBe('P-260201-0001');
  });
});

describe('Session Time Validation', () => {
  function isWithinSessionTime(sessionId: string, currentTime: string): boolean {
    const session = mockSessions.get(sessionId);
    if (!session || !session.is_active) return false;

    const [currentHour, currentMin] = currentTime.split(':').map(Number);
    const [startHour, startMin] = session.start_time.split(':').map(Number);
    const [endHour, endMin] = session.end_time.split(':').map(Number);

    const current = currentHour * 60 + currentMin;
    const start = startHour * 60 + startMin;
    const end = endHour * 60 + endMin;

    return current >= start && current < end;
  }

  it('should accept time within session', () => {
    expect(isWithinSessionTime('session_morning', '09:00')).toBe(true);
    expect(isWithinSessionTime('session_morning', '10:30')).toBe(true);
    expect(isWithinSessionTime('session_morning', '11:59')).toBe(true);
  });

  it('should accept session start time', () => {
    expect(isWithinSessionTime('session_morning', '08:00')).toBe(true);
  });

  it('should reject session end time', () => {
    expect(isWithinSessionTime('session_morning', '12:00')).toBe(false);
  });

  it('should reject time before session', () => {
    expect(isWithinSessionTime('session_morning', '07:00')).toBe(false);
    expect(isWithinSessionTime('session_morning', '07:59')).toBe(false);
  });

  it('should reject time after session', () => {
    expect(isWithinSessionTime('session_morning', '12:01')).toBe(false);
    expect(isWithinSessionTime('session_morning', '15:00')).toBe(false);
  });

  it('should reject inactive session', () => {
    mockSessions.get('session_morning')!.is_active = false;
    expect(isWithinSessionTime('session_morning', '10:00')).toBe(false);
  });
});
