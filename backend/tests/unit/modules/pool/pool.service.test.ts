import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { PoolService, PoolServiceError, createPoolService, PoolServiceDeps, PurchaseTicketInput } from '../../../../src/lib/services/pool.service.js';
import dayjs from 'dayjs';

// ============================================
// Mock Factories
// ============================================

function createMockSession(overrides = {}) {
  return {
    id: 'session-1',
    module_id: 'module-1',
    name: 'Morning Session',
    start_time: '09:00',
    end_time: '12:00',
    capacity: 50,
    price: 25.00,
    adult_price: 25.00,
    child_price: 12.50,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function createMockTicket(overrides = {}) {
  return {
    id: 'ticket-1',
    ticket_number: 'P-260201-0001',
    session_id: 'session-1',
    date: dayjs().format('YYYY-MM-DD'),
    guest_name: 'John Doe',
    guest_email: 'john@example.com',
    guest_phone: '+1234567890',
    adults: 2,
    children: 1,
    infants: 0,
    total_price: 62.50,
    payment_method: 'card' as const,
    payment_status: 'paid' as const,
    qr_code: 'mock-qr-code',
    status: 'valid' as const,
    entry_time: null,
    exit_time: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function createMockAvailability(overrides = {}) {
  return {
    session: createMockSession(),
    date: dayjs().format('YYYY-MM-DD'),
    capacity: 50,
    sold: 10,
    available: 40,
    ...overrides,
  };
}

function createMockDeps(): PoolServiceDeps {
  return {
    poolRepository: {
      getSessions: vi.fn().mockResolvedValue([createMockSession()]),
      getSessionById: vi.fn().mockResolvedValue(createMockSession()),
      getAvailability: vi.fn().mockResolvedValue([createMockAvailability()]),
      getTicketById: vi.fn().mockResolvedValue(createMockTicket()),
      getTicketByNumber: vi.fn().mockResolvedValue(createMockTicket()),
      getTicketsByDate: vi.fn().mockResolvedValue([createMockTicket()]),
      getTicketsByUser: vi.fn().mockResolvedValue([createMockTicket()]),
      createTicket: vi.fn().mockImplementation((data) => Promise.resolve({ id: 'new-ticket-1', ...data })),
      updateTicket: vi.fn().mockImplementation((id, data) => Promise.resolve({ ...createMockTicket(), ...data, id })),
      createSession: vi.fn().mockImplementation((data) => Promise.resolve({ id: 'new-session-1', ...data, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })),
      updateSession: vi.fn().mockImplementation((id, data) => Promise.resolve({ ...createMockSession(), ...data, id })),
      deleteSession: vi.fn().mockResolvedValue(undefined),
    },
    emailService: {
      sendPoolTicketConfirmation: vi.fn().mockResolvedValue(undefined),
    },
    qrCodeService: {
      generate: vi.fn().mockResolvedValue('generated-qr-code-data'),
    },
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
    activityLogger: {
      log: vi.fn().mockResolvedValue(undefined),
    },
    socketEmitter: {
      emitToUnit: vi.fn(),
    },
    config: {
      env: 'test',
    },
  } as unknown as PoolServiceDeps;
}

// ============================================
// Tests
// ============================================

describe('PoolService', () => {
  let service: PoolService;
  let mockDeps: PoolServiceDeps;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDeps = createMockDeps();
    service = new PoolService(mockDeps);
  });

  // ============================================
  // Public Query Methods
  // ============================================

  describe('getSessions', () => {
    it('should return all sessions when no moduleId provided', async () => {
      const result = await service.getSessions();

      expect(mockDeps.poolRepository.getSessions).toHaveBeenCalledWith(undefined);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Morning Session');
    });

    it('should return sessions filtered by moduleId', async () => {
      const result = await service.getSessions('module-1');

      expect(mockDeps.poolRepository.getSessions).toHaveBeenCalledWith('module-1');
      expect(result).toBeDefined();
    });

    it('should return empty array when no sessions exist', async () => {
      (mockDeps.poolRepository.getSessions as Mock).mockResolvedValue([]);

      const result = await service.getSessions();

      expect(result).toEqual([]);
    });
  });

  describe('getSessionById', () => {
    it('should return session when found', async () => {
      const result = await service.getSessionById('session-1');

      expect(mockDeps.poolRepository.getSessionById).toHaveBeenCalledWith('session-1');
      expect(result).toBeDefined();
      expect(result?.id).toBe('session-1');
    });

    it('should return null when session not found', async () => {
      (mockDeps.poolRepository.getSessionById as Mock).mockResolvedValue(null);

      const result = await service.getSessionById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getAvailability', () => {
    it('should return availability for date', async () => {
      const date = '2026-02-07';
      const result = await service.getAvailability(date);

      expect(mockDeps.poolRepository.getAvailability).toHaveBeenCalledWith(date, undefined, undefined);
      expect(result).toBeDefined();
      expect(result[0].available).toBe(40);
    });

    it('should return availability filtered by sessionId', async () => {
      const date = '2026-02-07';
      const result = await service.getAvailability(date, 'session-1');

      expect(mockDeps.poolRepository.getAvailability).toHaveBeenCalledWith(date, 'session-1', undefined);
      expect(result).toBeDefined();
    });

    it('should return availability filtered by moduleId', async () => {
      const date = '2026-02-07';
      const result = await service.getAvailability(date, undefined, 'module-1');

      expect(mockDeps.poolRepository.getAvailability).toHaveBeenCalledWith(date, undefined, 'module-1');
      expect(result).toBeDefined();
    });
  });

  describe('getTicketById', () => {
    it('should return ticket when found', async () => {
      const result = await service.getTicketById('ticket-1');

      expect(mockDeps.poolRepository.getTicketById).toHaveBeenCalledWith('ticket-1');
      expect(result).toBeDefined();
      expect(result?.id).toBe('ticket-1');
    });

    it('should return null when ticket not found', async () => {
      (mockDeps.poolRepository.getTicketById as Mock).mockResolvedValue(null);

      const result = await service.getTicketById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getTicketByNumber', () => {
    it('should return ticket when found', async () => {
      const result = await service.getTicketByNumber('P-260201-0001');

      expect(mockDeps.poolRepository.getTicketByNumber).toHaveBeenCalledWith('P-260201-0001');
      expect(result).toBeDefined();
      expect(result?.ticket_number).toBe('P-260201-0001');
    });

    it('should return null when ticket not found', async () => {
      (mockDeps.poolRepository.getTicketByNumber as Mock).mockResolvedValue(null);

      const result = await service.getTicketByNumber('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getTicketsByDate', () => {
    it('should return tickets for date', async () => {
      const date = '2026-02-07';
      const result = await service.getTicketsByDate(date);

      expect(mockDeps.poolRepository.getTicketsByDate).toHaveBeenCalledWith(date);
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no tickets for date', async () => {
      (mockDeps.poolRepository.getTicketsByDate as Mock).mockResolvedValue([]);

      const result = await service.getTicketsByDate('2026-12-31');

      expect(result).toEqual([]);
    });
  });

  describe('getTicketsByUser', () => {
    it('should return tickets for user', async () => {
      const result = await service.getTicketsByUser('user-1');

      expect(mockDeps.poolRepository.getTicketsByUser).toHaveBeenCalledWith('user-1');
      expect(result).toHaveLength(1);
    });

    it('should return empty array when user has no tickets', async () => {
      (mockDeps.poolRepository.getTicketsByUser as Mock).mockResolvedValue([]);

      const result = await service.getTicketsByUser('user-no-tickets');

      expect(result).toEqual([]);
    });
  });

  // ============================================
  // Ticket Purchase Flow
  // ============================================

  describe('purchaseTicket', () => {
    const validInput: PurchaseTicketInput = {
      sessionId: 'session-1',
      date: '2026-02-07',
      guestName: 'Jane Smith',
      guestEmail: 'jane@example.com',
      guestPhone: '+1987654321',
      adults: 2,
      children: 1,
      infants: 0,
      paymentMethod: 'card',
      userId: 'user-1',
    };

    it('should successfully purchase a ticket', async () => {
      const result = await service.purchaseTicket(validInput);

      expect(result.ticket).toBeDefined();
      expect(result.qrCode).toBe('generated-qr-code-data');
      expect(mockDeps.poolRepository.createTicket).toHaveBeenCalled();
      expect(mockDeps.qrCodeService.generate).toHaveBeenCalled();
      expect(mockDeps.activityLogger.log).toHaveBeenCalledWith(
        'pool_ticket_purchased',
        expect.any(Object),
        'user-1'
      );
      expect(mockDeps.socketEmitter.emitToUnit).toHaveBeenCalledWith(
        'pool',
        'ticket_purchased',
        expect.any(Object)
      );
    });

    it('should calculate price correctly using session prices', async () => {
      await service.purchaseTicket(validInput);

      const createTicketCall = (mockDeps.poolRepository.createTicket as Mock).mock.calls[0][0];
      // 2 adults * 25 + 1 child * 12.50 = 62.50
      expect(createTicketCall.total_price).toBe(62.50);
    });

    it('should throw error when session not found', async () => {
      (mockDeps.poolRepository.getSessionById as Mock).mockResolvedValue(null);

      await expect(service.purchaseTicket(validInput)).rejects.toThrow(PoolServiceError);
      await expect(service.purchaseTicket(validInput)).rejects.toThrow('Session not found');
    });

    it('should throw error when session not available', async () => {
      (mockDeps.poolRepository.getAvailability as Mock).mockResolvedValue([]);

      await expect(service.purchaseTicket(validInput)).rejects.toThrow(PoolServiceError);
      await expect(service.purchaseTicket(validInput)).rejects.toThrow('Session not available');
    });

    it('should throw error when insufficient capacity', async () => {
      (mockDeps.poolRepository.getAvailability as Mock).mockResolvedValue([
        createMockAvailability({ available: 1 }),
      ]);

      await expect(service.purchaseTicket(validInput)).rejects.toThrow(PoolServiceError);
      await expect(service.purchaseTicket(validInput)).rejects.toThrow('Only 1 spots available');
    });

    it('should set pending status for stripe payment', async () => {
      const stripeInput = { ...validInput, paymentMethod: 'stripe' as const };

      await service.purchaseTicket(stripeInput);

      const createTicketCall = (mockDeps.poolRepository.createTicket as Mock).mock.calls[0][0];
      expect(createTicketCall.payment_status).toBe('pending');
      expect(createTicketCall.status).toBe('pending');
    });

    it('should set paid status for card payment', async () => {
      await service.purchaseTicket(validInput);

      const createTicketCall = (mockDeps.poolRepository.createTicket as Mock).mock.calls[0][0];
      expect(createTicketCall.payment_status).toBe('paid');
      expect(createTicketCall.status).toBe('valid');
    });

    it('should set paid status for cash payment', async () => {
      const cashInput = { ...validInput, paymentMethod: 'cash' as const };

      await service.purchaseTicket(cashInput);

      const createTicketCall = (mockDeps.poolRepository.createTicket as Mock).mock.calls[0][0];
      expect(createTicketCall.payment_status).toBe('paid');
      expect(createTicketCall.status).toBe('valid');
    });

    it('should send confirmation email when guest email provided', async () => {
      await service.purchaseTicket(validInput);

      expect(mockDeps.emailService.sendPoolTicketConfirmation).toHaveBeenCalled();
    });

    it('should not send email when guest email not provided', async () => {
      const inputWithoutEmail = { ...validInput, guestEmail: undefined };

      await service.purchaseTicket(inputWithoutEmail);

      expect(mockDeps.emailService.sendPoolTicketConfirmation).not.toHaveBeenCalled();
    });

    it('should log error when email fails but not throw', async () => {
      (mockDeps.emailService.sendPoolTicketConfirmation as Mock).mockRejectedValue(new Error('Email failed'));

      const result = await service.purchaseTicket(validInput);

      expect(result.ticket).toBeDefined();
      // Give time for async email to fail
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockDeps.logger.error).toHaveBeenCalled();
    });

    it('should generate ticket with correct date format', async () => {
      await service.purchaseTicket(validInput);

      const createTicketCall = (mockDeps.poolRepository.createTicket as Mock).mock.calls[0][0];
      expect(createTicketCall.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should use fallback pricing when child_price not set', async () => {
      const sessionWithoutChildPrice = createMockSession({ adult_price: 30, child_price: null, price: 30 });
      (mockDeps.poolRepository.getSessionById as Mock).mockResolvedValue(sessionWithoutChildPrice);

      await service.purchaseTicket(validInput);

      const createTicketCall = (mockDeps.poolRepository.createTicket as Mock).mock.calls[0][0];
      // 2 adults * 30 + 1 child * 15 (50% of 30) = 75
      expect(createTicketCall.total_price).toBe(75);
    });
  });

  // ============================================
  // Ticket Validation
  // ============================================

  describe('validateTicket', () => {
    it('should return valid for valid ticket', async () => {
      const todayTicket = createMockTicket({ date: dayjs().format('YYYY-MM-DD') });
      (mockDeps.poolRepository.getTicketByNumber as Mock).mockResolvedValue(todayTicket);

      const result = await service.validateTicket('P-260201-0001');

      expect(result.valid).toBe(true);
      expect(result.ticket).toBeDefined();
    });

    it('should return invalid when ticket not found', async () => {
      (mockDeps.poolRepository.getTicketByNumber as Mock).mockResolvedValue(null);

      const result = await service.validateTicket('non-existent');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Ticket not found');
    });

    it('should return invalid when ticket is for different date', async () => {
      const oldTicket = createMockTicket({ date: '2025-01-01' });
      (mockDeps.poolRepository.getTicketByNumber as Mock).mockResolvedValue(oldTicket);

      const result = await service.validateTicket('P-260201-0001');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('not today');
    });

    it('should return invalid when ticket already used', async () => {
      const usedTicket = createMockTicket({ status: 'used', date: dayjs().format('YYYY-MM-DD') });
      (mockDeps.poolRepository.getTicketByNumber as Mock).mockResolvedValue(usedTicket);

      const result = await service.validateTicket('P-260201-0001');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Ticket already used');
    });

    it('should return invalid when ticket cancelled', async () => {
      const cancelledTicket = createMockTicket({ status: 'cancelled', date: dayjs().format('YYYY-MM-DD') });
      (mockDeps.poolRepository.getTicketByNumber as Mock).mockResolvedValue(cancelledTicket);

      const result = await service.validateTicket('P-260201-0001');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Ticket was cancelled');
    });

    it('should return invalid when ticket expired', async () => {
      const expiredTicket = createMockTicket({ status: 'expired', date: dayjs().format('YYYY-MM-DD') });
      (mockDeps.poolRepository.getTicketByNumber as Mock).mockResolvedValue(expiredTicket);

      const result = await service.validateTicket('P-260201-0001');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Ticket has expired');
    });

    it('should return invalid when payment not completed', async () => {
      const unpaidTicket = createMockTicket({ payment_status: 'pending', date: dayjs().format('YYYY-MM-DD') });
      (mockDeps.poolRepository.getTicketByNumber as Mock).mockResolvedValue(unpaidTicket);

      const result = await service.validateTicket('P-260201-0001');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Payment not completed');
    });
  });

  // ============================================
  // Entry/Exit Recording
  // ============================================

  describe('recordEntry', () => {
    it('should successfully record entry', async () => {
      const ticket = createMockTicket({ entry_time: null });
      (mockDeps.poolRepository.getTicketById as Mock).mockResolvedValue(ticket);

      const result = await service.recordEntry('ticket-1', 'staff-1');

      expect(mockDeps.poolRepository.updateTicket).toHaveBeenCalledWith('ticket-1', {
        entry_time: expect.any(String),
        status: 'used',
      });
      expect(mockDeps.activityLogger.log).toHaveBeenCalledWith(
        'pool_entry_recorded',
        expect.objectContaining({ ticketId: 'ticket-1' }),
        'staff-1'
      );
      expect(mockDeps.socketEmitter.emitToUnit).toHaveBeenCalledWith(
        'pool',
        'guest_entered',
        expect.any(Object)
      );
    });

    it('should throw error when ticket not found', async () => {
      (mockDeps.poolRepository.getTicketById as Mock).mockResolvedValue(null);

      await expect(service.recordEntry('non-existent')).rejects.toThrow(PoolServiceError);
      await expect(service.recordEntry('non-existent')).rejects.toThrow('Ticket not found');
    });

    it('should throw error when entry already recorded', async () => {
      const enteredTicket = createMockTicket({ entry_time: '2026-02-07T09:30:00Z' });
      (mockDeps.poolRepository.getTicketById as Mock).mockResolvedValue(enteredTicket);

      await expect(service.recordEntry('ticket-1')).rejects.toThrow(PoolServiceError);
      await expect(service.recordEntry('ticket-1')).rejects.toThrow('Entry already recorded');
    });

    it('should emit socket event with correct guest count', async () => {
      const ticket = createMockTicket({ entry_time: null, adults: 3, children: 2 });
      (mockDeps.poolRepository.getTicketById as Mock).mockResolvedValue(ticket);

      await service.recordEntry('ticket-1');

      expect(mockDeps.socketEmitter.emitToUnit).toHaveBeenCalledWith(
        'pool',
        'guest_entered',
        expect.objectContaining({ guestCount: 5 })
      );
    });
  });

  describe('recordExit', () => {
    it('should successfully record exit', async () => {
      const ticket = createMockTicket({ entry_time: '2026-02-07T09:30:00Z', exit_time: null });
      (mockDeps.poolRepository.getTicketById as Mock).mockResolvedValue(ticket);

      const result = await service.recordExit('ticket-1', 'staff-1');

      expect(mockDeps.poolRepository.updateTicket).toHaveBeenCalledWith('ticket-1', {
        exit_time: expect.any(String),
      });
      expect(mockDeps.activityLogger.log).toHaveBeenCalledWith(
        'pool_exit_recorded',
        expect.objectContaining({ ticketId: 'ticket-1' }),
        'staff-1'
      );
      expect(mockDeps.socketEmitter.emitToUnit).toHaveBeenCalledWith(
        'pool',
        'guest_exited',
        expect.any(Object)
      );
    });

    it('should throw error when ticket not found', async () => {
      (mockDeps.poolRepository.getTicketById as Mock).mockResolvedValue(null);

      await expect(service.recordExit('non-existent')).rejects.toThrow(PoolServiceError);
      await expect(service.recordExit('non-existent')).rejects.toThrow('Ticket not found');
    });

    it('should throw error when no entry recorded', async () => {
      const noEntryTicket = createMockTicket({ entry_time: null });
      (mockDeps.poolRepository.getTicketById as Mock).mockResolvedValue(noEntryTicket);

      await expect(service.recordExit('ticket-1')).rejects.toThrow(PoolServiceError);
      await expect(service.recordExit('ticket-1')).rejects.toThrow('No entry recorded');
    });

    it('should throw error when exit already recorded', async () => {
      const exitedTicket = createMockTicket({
        entry_time: '2026-02-07T09:30:00Z',
        exit_time: '2026-02-07T11:30:00Z',
      });
      (mockDeps.poolRepository.getTicketById as Mock).mockResolvedValue(exitedTicket);

      await expect(service.recordExit('ticket-1')).rejects.toThrow(PoolServiceError);
      await expect(service.recordExit('ticket-1')).rejects.toThrow('Exit already recorded');
    });

    it('should emit socket event with correct guest count', async () => {
      const ticket = createMockTicket({
        entry_time: '2026-02-07T09:30:00Z',
        exit_time: null,
        adults: 2,
        children: 3,
      });
      (mockDeps.poolRepository.getTicketById as Mock).mockResolvedValue(ticket);

      await service.recordExit('ticket-1');

      expect(mockDeps.socketEmitter.emitToUnit).toHaveBeenCalledWith(
        'pool',
        'guest_exited',
        expect.objectContaining({ guestCount: 5 })
      );
    });
  });

  // ============================================
  // Admin Operations
  // ============================================

  describe('createSession', () => {
    const newSessionData = {
      module_id: 'module-1',
      name: 'Evening Session',
      start_time: '18:00',
      end_time: '21:00',
      capacity: 30,
      price: 20.00,
      adult_price: 20.00,
      child_price: 10.00,
      is_active: true,
    };

    it('should successfully create a session', async () => {
      const result = await service.createSession(newSessionData as any, 'admin-1');

      expect(mockDeps.poolRepository.createSession).toHaveBeenCalledWith(newSessionData);
      expect(result.name).toBe('Evening Session');
      expect(mockDeps.activityLogger.log).toHaveBeenCalledWith(
        'pool_session_created',
        expect.objectContaining({ name: 'Evening Session' }),
        'admin-1'
      );
    });

    it('should create session without admin user id', async () => {
      const result = await service.createSession(newSessionData as any);

      expect(mockDeps.poolRepository.createSession).toHaveBeenCalled();
      expect(mockDeps.activityLogger.log).toHaveBeenCalledWith(
        'pool_session_created',
        expect.any(Object),
        undefined
      );
    });
  });

  describe('updateSession', () => {
    it('should successfully update a session', async () => {
      const updateData = { name: 'Updated Session', capacity: 60 };

      const result = await service.updateSession('session-1', updateData, 'admin-1');

      expect(mockDeps.poolRepository.updateSession).toHaveBeenCalledWith('session-1', updateData);
      expect(mockDeps.activityLogger.log).toHaveBeenCalledWith(
        'pool_session_updated',
        {
          sessionId: 'session-1',
          changes: ['name', 'capacity'],
        },
        'admin-1'
      );
    });

    it('should update session without admin user id', async () => {
      const updateData = { price: 30.00 };

      await service.updateSession('session-1', updateData);

      expect(mockDeps.activityLogger.log).toHaveBeenCalledWith(
        'pool_session_updated',
        expect.any(Object),
        undefined
      );
    });
  });

  describe('deleteSession', () => {
    it('should successfully delete a session', async () => {
      await service.deleteSession('session-1', 'admin-1');

      expect(mockDeps.poolRepository.deleteSession).toHaveBeenCalledWith('session-1');
      expect(mockDeps.activityLogger.log).toHaveBeenCalledWith(
        'pool_session_deleted',
        { sessionId: 'session-1' },
        'admin-1'
      );
    });

    it('should delete session without admin user id', async () => {
      await service.deleteSession('session-1');

      expect(mockDeps.poolRepository.deleteSession).toHaveBeenCalledWith('session-1');
      expect(mockDeps.activityLogger.log).toHaveBeenCalledWith(
        'pool_session_deleted',
        expect.any(Object),
        undefined
      );
    });
  });

  // ============================================
  // PoolServiceError
  // ============================================

  describe('PoolServiceError', () => {
    it('should create error with correct properties', () => {
      const error = new PoolServiceError('Test error', 'TEST_CODE', 400);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('PoolServiceError');
    });

    it('should be instance of Error', () => {
      const error = new PoolServiceError('Test', 'CODE', 500);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PoolServiceError);
    });
  });

  // ============================================
  // Factory Function
  // ============================================

  describe('createPoolService', () => {
    it('should create PoolService instance', () => {
      const service = createPoolService(mockDeps);

      expect(service).toBeInstanceOf(PoolService);
    });

    it('should create functional service that can call methods', async () => {
      const service = createPoolService(mockDeps);

      const sessions = await service.getSessions();

      expect(sessions).toBeDefined();
      expect(mockDeps.poolRepository.getSessions).toHaveBeenCalled();
    });
  });
});
