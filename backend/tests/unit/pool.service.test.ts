/**
 * Pool Service Unit Tests
 * 
 * These tests demonstrate the new DI-based architecture.
 * All dependencies are mocked, no database required.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PoolService, PoolServiceError, createPoolService } from '../../src/lib/services/pool.service';
import { InMemoryPoolRepository, createInMemoryPoolRepository } from '../../src/lib/repositories/pool.repository.memory';
import type {
  EmailService,
  QRCodeService,
  LoggerService,
  ActivityLoggerService,
  SocketEmitter,
  AppConfig,
} from '../../src/lib/container/types';

// ============================================
// Test Doubles (Mocks)
// ============================================

function createMockEmailService(): EmailService {
  return {
    sendEmail: vi.fn().mockResolvedValue(true),
    sendTemplatedEmail: vi.fn().mockResolvedValue(true),
    sendPoolTicketConfirmation: vi.fn().mockResolvedValue(true),
    sendBookingConfirmation: vi.fn().mockResolvedValue(true),
    sendOrderConfirmation: vi.fn().mockResolvedValue(true),
  };
}

function createMockQRCodeService(): QRCodeService {
  return {
    generate: vi.fn().mockResolvedValue('data:image/png;base64,mockQRCode'),
    generateAsBuffer: vi.fn().mockResolvedValue(Buffer.from('mockQR')),
  };
}

function createMockLogger(): LoggerService {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

function createMockActivityLogger(): ActivityLoggerService {
  return {
    log: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockSocketEmitter(): SocketEmitter {
  return {
    emitToUnit: vi.fn(),
    emitToRoom: vi.fn(),
  };
}

function createMockConfig(): AppConfig {
  return {
    env: 'test',
    port: 3000,
    apiUrl: 'http://localhost:3000',
    frontendUrl: 'http://localhost:3000',
    database: { url: 'postgres://test' },
    supabase: { url: '', anonKey: '', serviceKey: '' },
    jwt: { secret: 'test', refreshSecret: 'test', expiresIn: '15m', refreshExpiresIn: '7d' },
    stripe: { secretKey: '', webhookSecret: '' },
    email: { host: '', port: 587, user: '', pass: '', from: '' },
  };
}

// ============================================
// Test Suite
// ============================================

describe('PoolService', () => {
  let poolRepository: InMemoryPoolRepository;
  let emailService: ReturnType<typeof createMockEmailService>;
  let qrCodeService: ReturnType<typeof createMockQRCodeService>;
  let logger: ReturnType<typeof createMockLogger>;
  let activityLogger: ReturnType<typeof createMockActivityLogger>;
  let socketEmitter: ReturnType<typeof createMockSocketEmitter>;
  let poolService: PoolService;

  beforeEach(() => {
    // Create fresh mocks for each test
    poolRepository = createInMemoryPoolRepository();
    emailService = createMockEmailService();
    qrCodeService = createMockQRCodeService();
    logger = createMockLogger();
    activityLogger = createMockActivityLogger();
    socketEmitter = createMockSocketEmitter();

    // Create service with all mocked dependencies
    poolService = createPoolService({
      poolRepository,
      emailService,
      qrCodeService,
      logger,
      activityLogger,
      socketEmitter,
      config: createMockConfig(),
    });
  });

  // ============================================
  // Session Queries
  // ============================================

  describe('getSessions', () => {
    it('should return empty array when no sessions exist', async () => {
      const sessions = await poolService.getSessions();
      expect(sessions).toEqual([]);
    });

    it('should return all active sessions', async () => {
      poolRepository.addSession({ name: 'Morning Swim', capacity: 50 });
      poolRepository.addSession({ name: 'Afternoon Swim', capacity: 100 });
      poolRepository.addSession({ name: 'Inactive Session', is_active: false });

      const sessions = await poolService.getSessions();
      
      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.name)).toContain('Morning Swim');
      expect(sessions.map(s => s.name)).toContain('Afternoon Swim');
      expect(sessions.map(s => s.name)).not.toContain('Inactive Session');
    });

    it('should filter sessions by moduleId', async () => {
      poolRepository.addSession({ name: 'Pool A Session', module_id: 'pool-a' });
      poolRepository.addSession({ name: 'Pool B Session', module_id: 'pool-b' });

      const sessions = await poolService.getSessions('pool-a');
      
      expect(sessions).toHaveLength(1);
      expect(sessions[0].name).toBe('Pool A Session');
    });
  });

  describe('getSessionById', () => {
    it('should return null for non-existent session', async () => {
      const session = await poolService.getSessionById('non-existent-id');
      expect(session).toBeNull();
    });

    it('should return session by id', async () => {
      const created = poolRepository.addSession({ name: 'Test Session', capacity: 75 });
      
      const session = await poolService.getSessionById(created.id);
      
      expect(session).not.toBeNull();
      expect(session?.name).toBe('Test Session');
      expect(session?.capacity).toBe(75);
    });
  });

  // ============================================
  // Availability
  // ============================================

  describe('getAvailability', () => {
    it('should return full capacity when no tickets sold', async () => {
      poolRepository.addSession({ name: 'Morning', capacity: 100 });

      const availability = await poolService.getAvailability('2024-06-15');
      
      expect(availability).toHaveLength(1);
      expect(availability[0].available).toBe(100);
      expect(availability[0].booked).toBe(0);
    });

    it('should calculate correct availability with existing tickets', async () => {
      const session = poolRepository.addSession({ name: 'Morning', capacity: 100 });
      
      // Add some tickets for this session
      poolRepository.addTicket({
        session_id: session.id,
        guest_name: 'John Doe',
        date: '2024-06-15',
        adults: 2,
        children: 1,
        status: 'valid',
      });
      poolRepository.addTicket({
        session_id: session.id,
        guest_name: 'Jane Doe',
        date: '2024-06-15',
        adults: 3,
        children: 0,
        status: 'valid',
      });

      const availability = await poolService.getAvailability('2024-06-15');
      
      expect(availability[0].booked).toBe(6); // 2+1+3+0
      expect(availability[0].available).toBe(94); // 100-6
    });

    it('should not count cancelled tickets', async () => {
      const session = poolRepository.addSession({ name: 'Morning', capacity: 100 });
      
      poolRepository.addTicket({
        session_id: session.id,
        guest_name: 'Cancelled Guest',
        date: '2024-06-15',
        adults: 5,
        children: 0,
        status: 'cancelled',
      });

      const availability = await poolService.getAvailability('2024-06-15');
      
      expect(availability[0].booked).toBe(0);
      expect(availability[0].available).toBe(100);
    });
  });

  // ============================================
  // Ticket Purchase
  // ============================================

  describe('purchaseTicket', () => {
    it('should throw error for non-existent session', async () => {
      await expect(poolService.purchaseTicket({
        sessionId: 'non-existent',
        date: '2024-06-15',
        guestName: 'John Doe',
        adults: 2,
        children: 0,
        infants: 0,
        paymentMethod: 'cash',
      })).rejects.toThrow(PoolServiceError);

      await expect(poolService.purchaseTicket({
        sessionId: 'non-existent',
        date: '2024-06-15',
        guestName: 'John Doe',
        adults: 2,
        children: 0,
        infants: 0,
        paymentMethod: 'cash',
      })).rejects.toMatchObject({
        code: 'SESSION_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('should throw error when capacity exceeded', async () => {
      const session = poolRepository.addSession({ name: 'Small Pool', capacity: 5 });
      
      // Fill up the pool
      poolRepository.addTicket({
        session_id: session.id,
        guest_name: 'Existing',
        date: '2024-06-15',
        adults: 4,
        children: 0,
      });

      await expect(poolService.purchaseTicket({
        sessionId: session.id,
        date: '2024-06-15',
        guestName: 'Too Many',
        adults: 3,
        children: 0,
        infants: 0,
        paymentMethod: 'cash',
      })).rejects.toMatchObject({
        code: 'INSUFFICIENT_CAPACITY',
        statusCode: 400,
      });
    });

    it('should create ticket and return QR code', async () => {
      const session = poolRepository.addSession({
        name: 'Morning Swim',
        capacity: 100,
        price: 25,
        adult_price: 25,
        child_price: 15,
      });

      const result = await poolService.purchaseTicket({
        sessionId: session.id,
        date: '2024-06-15',
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        adults: 2,
        children: 1,
        infants: 0,
        paymentMethod: 'cash',
      });

      // Verify ticket created
      expect(result.ticket).toBeDefined();
      expect(result.ticket.guest_name).toBe('John Doe');
      expect(result.ticket.adults).toBe(2);
      expect(result.ticket.children).toBe(1);
      expect(result.ticket.status).toBe('valid');
      expect(result.ticket.payment_status).toBe('paid');

      // Verify price calculation: 2*25 + 1*15 = 65
      expect(result.ticket.total_price).toBe(65);

      // Verify QR code generated
      expect(result.qrCode).toBe('data:image/png;base64,mockQRCode');
      expect(qrCodeService.generate).toHaveBeenCalled();

      // Verify ticket number format
      expect(result.ticket.ticket_number).toMatch(/^P-\d{6}-\d{4}$/);
    });

    it('should log activity after purchase', async () => {
      const session = poolRepository.addSession({ name: 'Test', capacity: 100 });

      await poolService.purchaseTicket({
        sessionId: session.id,
        date: '2024-06-15',
        guestName: 'John',
        adults: 1,
        children: 0,
        infants: 0,
        paymentMethod: 'cash',
        userId: 'user-123',
      });

      expect(activityLogger.log).toHaveBeenCalledWith(
        'pool_ticket_purchased',
        expect.objectContaining({
          sessionId: session.id,
          totalGuests: 1,
          paymentMethod: 'cash',
        }),
        'user-123'
      );
    });

    it('should emit socket event after purchase', async () => {
      const session = poolRepository.addSession({ name: 'Test', capacity: 100 });

      await poolService.purchaseTicket({
        sessionId: session.id,
        date: '2024-06-15',
        guestName: 'John',
        adults: 2,
        children: 1,
        infants: 0,
        paymentMethod: 'cash',
      });

      expect(socketEmitter.emitToUnit).toHaveBeenCalledWith(
        'pool',
        'ticket_purchased',
        expect.objectContaining({
          sessionId: session.id,
          guestsAdded: 3,
        })
      );
    });

    it('should send confirmation email when email provided', async () => {
      const session = poolRepository.addSession({ name: 'Test', capacity: 100 });

      await poolService.purchaseTicket({
        sessionId: session.id,
        date: '2024-06-15',
        guestName: 'John',
        guestEmail: 'john@example.com',
        adults: 1,
        children: 0,
        infants: 0,
        paymentMethod: 'cash',
      });

      expect(emailService.sendPoolTicketConfirmation).toHaveBeenCalled();
    });

    it('should not send email when email not provided', async () => {
      const session = poolRepository.addSession({ name: 'Test', capacity: 100 });

      await poolService.purchaseTicket({
        sessionId: session.id,
        date: '2024-06-15',
        guestName: 'John',
        adults: 1,
        children: 0,
        infants: 0,
        paymentMethod: 'cash',
      });

      expect(emailService.sendPoolTicketConfirmation).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Ticket Validation
  // ============================================

  describe('validateTicket', () => {
    it('should return invalid for non-existent ticket', async () => {
      const result = await poolService.validateTicket('P-999999-9999');
      
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Ticket not found');
    });

    it('should return invalid for wrong date', async () => {
      const session = poolRepository.addSession({ name: 'Test' });
      poolRepository.addTicket({
        session_id: session.id,
        ticket_number: 'P-240615-0001',
        guest_name: 'John',
        date: '2024-06-15', // Different from today
        status: 'valid',
        payment_status: 'paid',
      });

      const result = await poolService.validateTicket('P-240615-0001');
      
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('not today');
    });

    it('should return invalid for used ticket', async () => {
      const today = new Date().toISOString().split('T')[0];
      const session = poolRepository.addSession({ name: 'Test' });
      poolRepository.addTicket({
        session_id: session.id,
        ticket_number: 'P-TODAY-0001',
        guest_name: 'John',
        date: today,
        status: 'used',
        payment_status: 'paid',
      });

      const result = await poolService.validateTicket('P-TODAY-0001');
      
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Ticket already used');
    });

    it('should return valid for correct ticket', async () => {
      const today = new Date().toISOString().split('T')[0];
      const session = poolRepository.addSession({ name: 'Test' });
      poolRepository.addTicket({
        session_id: session.id,
        ticket_number: 'P-TODAY-0002',
        guest_name: 'John',
        date: today,
        status: 'valid',
        payment_status: 'paid',
      });

      const result = await poolService.validateTicket('P-TODAY-0002');
      
      expect(result.valid).toBe(true);
      expect(result.ticket).toBeDefined();
    });
  });

  // ============================================
  // Entry/Exit
  // ============================================

  describe('recordEntry', () => {
    it('should throw error for non-existent ticket', async () => {
      await expect(poolService.recordEntry('non-existent'))
        .rejects.toMatchObject({ code: 'TICKET_NOT_FOUND' });
    });

    it('should throw error for already entered ticket', async () => {
      const session = poolRepository.addSession({ name: 'Test' });
      const ticket = poolRepository.addTicket({
        session_id: session.id,
        guest_name: 'John',
        entry_time: new Date().toISOString(),
      });

      await expect(poolService.recordEntry(ticket.id))
        .rejects.toMatchObject({ code: 'ALREADY_ENTERED' });
    });

    it('should record entry time and emit event', async () => {
      const session = poolRepository.addSession({ name: 'Test' });
      const ticket = poolRepository.addTicket({
        session_id: session.id,
        guest_name: 'John',
        adults: 2,
        children: 1,
      });

      const updated = await poolService.recordEntry(ticket.id, 'staff-123');

      expect(updated.entry_time).toBeDefined();
      expect(updated.status).toBe('used');
      
      expect(socketEmitter.emitToUnit).toHaveBeenCalledWith(
        'pool',
        'guest_entered',
        expect.objectContaining({
          ticketId: ticket.id,
          guestCount: 3,
        })
      );
    });
  });

  describe('recordExit', () => {
    it('should throw error when no entry recorded', async () => {
      const session = poolRepository.addSession({ name: 'Test' });
      const ticket = poolRepository.addTicket({
        session_id: session.id,
        guest_name: 'John',
      });

      await expect(poolService.recordExit(ticket.id))
        .rejects.toMatchObject({ code: 'NO_ENTRY' });
    });

    it('should record exit time', async () => {
      const session = poolRepository.addSession({ name: 'Test' });
      const ticket = poolRepository.addTicket({
        session_id: session.id,
        guest_name: 'John',
        entry_time: new Date().toISOString(),
      });

      const updated = await poolService.recordExit(ticket.id);

      expect(updated.exit_time).toBeDefined();
    });
  });

  // ============================================
  // Admin Session Management
  // ============================================

  describe('createSession', () => {
    it('should create session and log activity', async () => {
      const session = await poolService.createSession({
        name: 'New Session',
        start_time: '10:00',
        end_time: '13:00',
        capacity: 50,
        price: 30,
        is_active: true,
      }, 'admin-123');

      expect(session.id).toBeDefined();
      expect(session.name).toBe('New Session');

      expect(activityLogger.log).toHaveBeenCalledWith(
        'pool_session_created',
        expect.objectContaining({ name: 'New Session' }),
        'admin-123'
      );
    });
  });

  describe('updateSession', () => {
    it('should update session', async () => {
      const original = poolRepository.addSession({ name: 'Old Name', capacity: 50 });

      const updated = await poolService.updateSession(
        original.id,
        { name: 'New Name', capacity: 75 },
        'admin-123'
      );

      expect(updated.name).toBe('New Name');
      expect(updated.capacity).toBe(75);
    });
  });

  describe('deleteSession', () => {
    it('should soft-delete session', async () => {
      const session = poolRepository.addSession({ name: 'To Delete' });

      await poolService.deleteSession(session.id, 'admin-123');

      // Session should be inactive
      const sessions = await poolService.getSessions();
      expect(sessions.find(s => s.id === session.id)).toBeUndefined();

      expect(activityLogger.log).toHaveBeenCalledWith(
        'pool_session_deleted',
        { sessionId: session.id },
        'admin-123'
      );
    });
  });
});
