import type { Mock } from 'vitest';

// ============================================
// Hoisted mocks (executed before imports)
// ============================================
const { mockStripe, mockSocket, mockSupabaseFrom, mockSupabaseClient } = vi.hoisted(() => {
  const mockStripe = {
    terminal: {
      connectionTokens: {
        create: vi.fn(),
      },
      readers: {
        list: vi.fn(),
        create: vi.fn(),
      },
      locations: {
        list: vi.fn(),
        create: vi.fn(),
      },
    },
    paymentIntents: {
      create: vi.fn(),
      capture: vi.fn(),
      cancel: vi.fn(),
    },
  };

  const mockSocket = {
    setTimeout: vi.fn(),
    connect: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
    destroy: vi.fn(),
    on: vi.fn(),
  };

  const mockSupabaseFrom = vi.fn();
  const mockSupabaseClient = {
    from: mockSupabaseFrom,
  };

  return { mockStripe, mockSocket, mockSupabaseFrom, mockSupabaseClient };
});

vi.mock('stripe', () => ({
  default: function Stripe() {
    return mockStripe;
  },
}));

vi.mock('net', () => {
  const SocketClass = function Socket() {
    return mockSocket;
  };
  return {
    Socket: SocketClass,
    default: {
      Socket: SocketClass,
    },
  };
});

vi.mock('../../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(() => mockSupabaseClient),
}));

// ============================================
// MOCK PATTERN: Chainable Supabase queries
// ============================================
function createQueryMock(mockDataFn: () => unknown[]) {
  const mockObj: Record<string, unknown> = {};
  const chainMethods = ['select', 'eq', 'is', 'or', 'order', 'gte', 'lte', 'gt', 'lt', 'limit', 'neq', 'not', 'in', 'contains', 'ilike'];
  chainMethods.forEach(method => {
    mockObj[method] = vi.fn().mockReturnValue(mockObj);
  });
  mockObj.then = function(resolve: (value: { data: unknown; error: unknown }) => void) {
    const data = mockDataFn();
    resolve({ data, error: null });
    return Promise.resolve({ data, error: null });
  };
  mockObj.single = vi.fn().mockImplementation(() => {
    const data = mockDataFn();
    const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return Promise.resolve({ data: firstItem, error: firstItem ? null : { code: 'PGRST116' } });
  });
  mockObj.maybeSingle = vi.fn().mockImplementation(() => {
    const data = mockDataFn();
    const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return Promise.resolve({ data: firstItem, error: null });
  });
  mockObj.insert = vi.fn().mockImplementation((insertData) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'new-1', ...insertData }, error: null })
    }),
    then: (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: insertData, error: null })
  }));
  mockObj.upsert = vi.fn().mockImplementation((data) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'upsert-1', ...data }, error: null })
    }),
    then: (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null })
  }));
  const updateChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is', 'not', 'or', 'in'].forEach(method => {
    updateChain[method] = vi.fn().mockReturnValue(updateChain);
  });
  updateChain.select = vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({ data: { id: 'item-1' }, error: null })
  });
  updateChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null });
  mockObj.update = vi.fn().mockReturnValue(updateChain);
  
  const deleteChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'lte', 'gte', 'not', 'is', 'or', 'in'].forEach(method => {
    deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
  });
  deleteChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null });
  mockObj.delete = vi.fn().mockReturnValue(deleteChain);
  return mockObj;
}

// ============================================
// MOCK: Express request/response helpers
// ============================================
function createMockReqRes(options: {
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
} = {}) {
  const req = {
    body: options.body || {},
    query: options.query || {},
    params: options.params || {},
  } as unknown as import('express').Request;

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as import('express').Response;

  const next = vi.fn() as unknown as import('express').NextFunction;

  return { req, res, next };
}

// Track current query mock for Supabase
let currentQueryMock: ReturnType<typeof createQueryMock>;

describe('POS Hardware Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentQueryMock = createQueryMock(() => []);
    
    // Setup Supabase from mock to return currentQueryMock
    mockSupabaseFrom.mockImplementation(() => currentQueryMock);
    
    // Reset socket mock
    mockSocket.setTimeout.mockClear();
    mockSocket.connect.mockClear();
    mockSocket.write.mockClear();
    mockSocket.end.mockClear();
    mockSocket.destroy.mockClear();
    mockSocket.on.mockClear();
  });

  // ============================================
  // createConnectionToken
  // ============================================
  describe('createConnectionToken', () => {
    it('should create and return connection token secret', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      mockStripe.terminal.connectionTokens.create.mockResolvedValue({
        secret: 'pst_test_secret_123',
      });

      const { req, res, next } = createMockReqRes();
      await posController.createConnectionToken(req, res, next);

      expect(mockStripe.terminal.connectionTokens.create).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        secret: 'pst_test_secret_123',
      });
    });

    it('should call next on Stripe error', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      const stripeError = new Error('Stripe connection failed');
      mockStripe.terminal.connectionTokens.create.mockRejectedValue(stripeError);

      const { req, res, next } = createMockReqRes();
      await posController.createConnectionToken(req, res, next);

      expect(next).toHaveBeenCalledWith(stripeError);
    });
  });

  // ============================================
  // createTerminalPaymentIntent
  // ============================================
  describe('createTerminalPaymentIntent', () => {
    it('should return 400 for zero amount', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      const { req, res, next } = createMockReqRes({
        body: { amount: 0, currency: 'usd' }
      });

      await posController.createTerminalPaymentIntent(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid amount' });
    });

    it('should return 400 for negative amount', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      const { req, res, next } = createMockReqRes({
        body: { amount: -100, currency: 'usd' }
      });

      await posController.createTerminalPaymentIntent(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid amount' });
    });

    it('should return 400 for missing amount', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      const { req, res, next } = createMockReqRes({
        body: { currency: 'usd' }
      });

      await posController.createTerminalPaymentIntent(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid amount' });
    });

    it('should create payment intent with valid amount', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_test_123',
        client_secret: 'pi_test_123_secret',
      });

      const { req, res, next } = createMockReqRes({
        body: { amount: 1000, currency: 'eur', orderId: 'order-123' }
      });

      await posController.createTerminalPaymentIntent(req, res, next);

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 1000,
        currency: 'eur',
        payment_method_types: ['card_present'],
        capture_method: 'manual',
        metadata: {
          orderId: 'order-123',
          source: 'terminal',
        },
      });
      expect(res.json).toHaveBeenCalledWith({
        clientSecret: 'pi_test_123_secret',
        paymentIntentId: 'pi_test_123',
      });
    });

    it('should use default currency usd when not provided', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_test_456',
        client_secret: 'pi_test_456_secret',
      });

      const { req, res, next } = createMockReqRes({
        body: { amount: 500 }
      });

      await posController.createTerminalPaymentIntent(req, res, next);

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'usd' })
      );
    });

    it('should round decimal amounts to integers', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_test_789',
        client_secret: 'pi_test_789_secret',
      });

      const { req, res, next } = createMockReqRes({
        body: { amount: 10.5 }
      });

      await posController.createTerminalPaymentIntent(req, res, next);

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 11 })
      );
    });

    it('should pass custom metadata', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      mockStripe.paymentIntents.create.mockResolvedValue({
        id: 'pi_meta_123',
        client_secret: 'pi_meta_123_secret',
      });

      const { req, res, next } = createMockReqRes({
        body: { 
          amount: 2000, 
          metadata: { tableNumber: '5', serverName: 'John' }
        }
      });

      await posController.createTerminalPaymentIntent(req, res, next);

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            tableNumber: '5',
            serverName: 'John',
          }),
        })
      );
    });

    it('should call next on Stripe error', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      const stripeError = new Error('Payment intent creation failed');
      mockStripe.paymentIntents.create.mockRejectedValue(stripeError);

      const { req, res, next } = createMockReqRes({
        body: { amount: 1000 }
      });

      await posController.createTerminalPaymentIntent(req, res, next);

      expect(next).toHaveBeenCalledWith(stripeError);
    });
  });

  // ============================================
  // captureTerminalPayment
  // ============================================
  describe('captureTerminalPayment', () => {
    it('should return 400 for missing payment intent ID', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      const { req, res, next } = createMockReqRes({
        body: {}
      });

      await posController.captureTerminalPayment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Payment intent ID required' });
    });

    it('should capture payment successfully', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      mockStripe.paymentIntents.capture.mockResolvedValue({
        id: 'pi_captured_123',
        amount: 2500,
        status: 'succeeded',
      });

      const { req, res, next } = createMockReqRes({
        body: { paymentIntentId: 'pi_captured_123' }
      });

      await posController.captureTerminalPayment(req, res, next);

      expect(mockStripe.paymentIntents.capture).toHaveBeenCalledWith('pi_captured_123');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        paymentIntent: {
          id: 'pi_captured_123',
          amount: 2500,
          status: 'succeeded',
        },
      });
    });

    it('should call next on capture error', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      const captureError = new Error('Capture failed - already captured');
      mockStripe.paymentIntents.capture.mockRejectedValue(captureError);

      const { req, res, next } = createMockReqRes({
        body: { paymentIntentId: 'pi_already_captured' }
      });

      await posController.captureTerminalPayment(req, res, next);

      expect(next).toHaveBeenCalledWith(captureError);
    });
  });

  // ============================================
  // cancelTerminalPayment
  // ============================================
  describe('cancelTerminalPayment', () => {
    it('should return 400 for missing payment intent ID', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      const { req, res, next } = createMockReqRes({
        body: {}
      });

      await posController.cancelTerminalPayment(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Payment intent ID required' });
    });

    it('should cancel payment successfully', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      mockStripe.paymentIntents.cancel.mockResolvedValue({
        id: 'pi_cancel_123',
        status: 'canceled',
      });

      const { req, res, next } = createMockReqRes({
        body: { paymentIntentId: 'pi_cancel_123' }
      });

      await posController.cancelTerminalPayment(req, res, next);

      expect(mockStripe.paymentIntents.cancel).toHaveBeenCalledWith('pi_cancel_123');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        status: 'canceled',
      });
    });

    it('should call next on cancel error', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      const cancelError = new Error('Cannot cancel - already captured');
      mockStripe.paymentIntents.cancel.mockRejectedValue(cancelError);

      const { req, res, next } = createMockReqRes({
        body: { paymentIntentId: 'pi_captured' }
      });

      await posController.cancelTerminalPayment(req, res, next);

      expect(next).toHaveBeenCalledWith(cancelError);
    });
  });

  // ============================================
  // listReaders
  // ============================================
  describe('listReaders', () => {
    it('should list all readers without location filter', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      mockStripe.terminal.readers.list.mockResolvedValue({
        data: [
          {
            id: 'tmr_reader_1',
            device_type: 'bbpos_wisepos_e',
            label: 'Front Desk',
            location: 'tml_loc_1',
            serial_number: 'SN123456',
            status: 'online',
            ip_address: '192.168.1.100',
          },
          {
            id: 'tmr_reader_2',
            device_type: 'stripe_m2',
            label: 'Bar',
            location: 'tml_loc_2',
            serial_number: 'SN789012',
            status: 'offline',
            ip_address: null,
          },
        ],
      });

      const { req, res, next } = createMockReqRes({
        query: {}
      });

      await posController.listReaders(req, res, next);

      expect(mockStripe.terminal.readers.list).toHaveBeenCalledWith({ limit: 100 });
      expect(res.json).toHaveBeenCalledWith({
        readers: [
          {
            id: 'tmr_reader_1',
            deviceType: 'bbpos_wisepos_e',
            label: 'Front Desk',
            location: 'tml_loc_1',
            serialNumber: 'SN123456',
            status: 'online',
            ipAddress: '192.168.1.100',
          },
          {
            id: 'tmr_reader_2',
            deviceType: 'stripe_m2',
            label: 'Bar',
            location: 'tml_loc_2',
            serialNumber: 'SN789012',
            status: 'offline',
            ipAddress: null,
          },
        ],
      });
    });

    it('should filter readers by location', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      mockStripe.terminal.readers.list.mockResolvedValue({
        data: [],
      });

      const { req, res, next } = createMockReqRes({
        query: { locationId: 'tml_loc_specific' }
      });

      await posController.listReaders(req, res, next);

      expect(mockStripe.terminal.readers.list).toHaveBeenCalledWith({
        limit: 100,
        location: 'tml_loc_specific',
      });
    });

    it('should call next on list error', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      const listError = new Error('Failed to fetch readers');
      mockStripe.terminal.readers.list.mockRejectedValue(listError);

      const { req, res, next } = createMockReqRes();

      await posController.listReaders(req, res, next);

      expect(next).toHaveBeenCalledWith(listError);
    });
  });

  // ============================================
  // registerReader
  // ============================================
  describe('registerReader', () => {
    it('should return 400 for missing registration code', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      const { req, res, next } = createMockReqRes({
        body: { locationId: 'tml_loc_1' }
      });

      await posController.registerReader(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Registration code and location ID required' });
    });

    it('should return 400 for missing location ID', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      const { req, res, next } = createMockReqRes({
        body: { registrationCode: 'seagull-panda-tuna' }
      });

      await posController.registerReader(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Registration code and location ID required' });
    });

    it('should register reader successfully', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      mockStripe.terminal.readers.create.mockResolvedValue({
        id: 'tmr_new_reader',
        device_type: 'bbpos_wisepos_e',
        label: 'Custom Label',
        serial_number: 'SNEW123',
      });

      const { req, res, next } = createMockReqRes({
        body: {
          registrationCode: 'seagull-panda-tuna',
          locationId: 'tml_loc_1',
          label: 'Custom Label',
        }
      });

      await posController.registerReader(req, res, next);

      expect(mockStripe.terminal.readers.create).toHaveBeenCalledWith({
        registration_code: 'seagull-panda-tuna',
        label: 'Custom Label',
        location: 'tml_loc_1',
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        reader: {
          id: 'tmr_new_reader',
          deviceType: 'bbpos_wisepos_e',
          label: 'Custom Label',
          serialNumber: 'SNEW123',
        },
      });
    });

    it('should use default label when not provided', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      mockStripe.terminal.readers.create.mockResolvedValue({
        id: 'tmr_default_label',
        device_type: 'stripe_m2',
        label: 'POS Terminal',
        serial_number: 'SNDEF456',
      });

      const { req, res, next } = createMockReqRes({
        body: {
          registrationCode: 'eagle-fox-wolf',
          locationId: 'tml_loc_2',
        }
      });

      await posController.registerReader(req, res, next);

      expect(mockStripe.terminal.readers.create).toHaveBeenCalledWith({
        registration_code: 'eagle-fox-wolf',
        label: 'POS Terminal',
        location: 'tml_loc_2',
      });
    });

    it('should call next on registration error', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      const regError = new Error('Invalid registration code');
      mockStripe.terminal.readers.create.mockRejectedValue(regError);

      const { req, res, next } = createMockReqRes({
        body: {
          registrationCode: 'invalid-code',
          locationId: 'tml_loc_1',
        }
      });

      await posController.registerReader(req, res, next);

      expect(next).toHaveBeenCalledWith(regError);
    });
  });

  // ============================================
  // getOrCreateLocation
  // ============================================
  describe('getOrCreateLocation', () => {
    it('should return existing location if found', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      mockStripe.terminal.locations.list.mockResolvedValue({
        data: [
          {
            id: 'tml_existing',
            display_name: 'Main Resort',
            address: {
              line1: '123 Beach Road',
              city: 'Miami',
              state: 'FL',
              postal_code: '33139',
              country: 'US',
            },
          },
        ],
      });

      const { req, res, next } = createMockReqRes({
        body: { displayName: 'Main Resort' }
      });

      await posController.getOrCreateLocation(req, res, next);

      expect(mockStripe.terminal.locations.list).toHaveBeenCalledWith({ limit: 10 });
      expect(mockStripe.terminal.locations.create).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        location: {
          id: 'tml_existing',
          displayName: 'Main Resort',
          address: {
            line1: '123 Beach Road',
            city: 'Miami',
            state: 'FL',
            postal_code: '33139',
            country: 'US',
          },
        },
      });
    });

    it('should return 400 when creating new location without required fields', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      mockStripe.terminal.locations.list.mockResolvedValue({
        data: [],
      });

      const { req, res, next } = createMockReqRes({
        body: { displayName: 'New Location' }
      });

      await posController.getOrCreateLocation(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Display name and address required for new location' });
    });

    it('should create new location when not found', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      mockStripe.terminal.locations.list.mockResolvedValue({
        data: [],
      });
      mockStripe.terminal.locations.create.mockResolvedValue({
        id: 'tml_new',
        display_name: 'New Property',
        address: {
          line1: '456 Ocean Drive',
          city: 'Los Angeles',
          state: 'CA',
          postal_code: '90210',
          country: 'US',
        },
      });

      const { req, res, next } = createMockReqRes({
        body: {
          displayName: 'New Property',
          address: {
            line1: '456 Ocean Drive',
            city: 'Los Angeles',
            state: 'CA',
            postalCode: '90210',
            country: 'US',
          },
        }
      });

      await posController.getOrCreateLocation(req, res, next);

      expect(mockStripe.terminal.locations.create).toHaveBeenCalledWith({
        display_name: 'New Property',
        address: {
          line1: '456 Ocean Drive',
          city: 'Los Angeles',
          state: 'CA',
          postal_code: '90210',
          country: 'US',
        },
      });
      expect(res.json).toHaveBeenCalledWith({
        location: {
          id: 'tml_new',
          displayName: 'New Property',
          address: {
            line1: '456 Ocean Drive',
            city: 'Los Angeles',
            state: 'CA',
            postal_code: '90210',
            country: 'US',
          },
        },
      });
    });

    it('should default country to US when not provided', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      mockStripe.terminal.locations.list.mockResolvedValue({ data: [] });
      mockStripe.terminal.locations.create.mockResolvedValue({
        id: 'tml_default_country',
        display_name: 'Test Location',
        address: {
          line1: '789 Main St',
          city: 'Boston',
          state: 'MA',
          postal_code: '02101',
          country: 'US',
        },
      });

      const { req, res, next } = createMockReqRes({
        body: {
          displayName: 'Test Location',
          address: {
            line1: '789 Main St',
            city: 'Boston',
            state: 'MA',
            postalCode: '02101',
          },
        }
      });

      await posController.getOrCreateLocation(req, res, next);

      expect(mockStripe.terminal.locations.create).toHaveBeenCalledWith(
        expect.objectContaining({
          address: expect.objectContaining({ country: 'US' }),
        })
      );
    });

    it('should call next on location error', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      const locError = new Error('Location API unavailable');
      mockStripe.terminal.locations.list.mockRejectedValue(locError);

      const { req, res, next } = createMockReqRes({
        body: { displayName: 'Any Location' }
      });

      await posController.getOrCreateLocation(req, res, next);

      expect(next).toHaveBeenCalledWith(locError);
    });
  });

  // ============================================
  // printToNetworkPrinter
  // ============================================
  describe('printToNetworkPrinter', () => {
    it('should return 400 for missing printer address', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      const { req, res, next } = createMockReqRes({
        body: { data: 'test data' }
      });

      await posController.printToNetworkPrinter(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Printer address and data required' });
    });

    it('should return 400 for missing data', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      const { req, res, next } = createMockReqRes({
        body: { printerAddress: '192.168.1.50' }
      });

      await posController.printToNetworkPrinter(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Printer address and data required' });
    });

    it('should print successfully to network printer', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      mockSocket.connect.mockImplementation((port, address, callback) => {
        if (callback) callback();
        return mockSocket;
      });
      mockSocket.write.mockImplementation((data, callback) => {
        if (callback) callback(null);
        return true;
      });

      const { req, res, next } = createMockReqRes({
        body: { printerAddress: '192.168.1.50', printerPort: 9100, data: 'test data' }
      });

      await posController.printToNetworkPrinter(req, res, next);

      expect(mockSocket.connect).toHaveBeenCalledWith(9100, '192.168.1.50', expect.any(Function));
      expect(mockSocket.write).toHaveBeenCalledWith(expect.any(Buffer), expect.any(Function));
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should use default port 9100 when not specified', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      mockSocket.connect.mockImplementation((port, address, callback) => {
        if (callback) callback();
        return mockSocket;
      });
      mockSocket.write.mockImplementation((data, callback) => {
        if (callback) callback(null);
        return true;
      });

      const { req, res, next } = createMockReqRes({
        body: { printerAddress: '192.168.1.50', data: 'test data' }
      });

      await posController.printToNetworkPrinter(req, res, next);

      expect(mockSocket.connect).toHaveBeenCalledWith(9100, '192.168.1.50', expect.any(Function));
    });

    it('should return 500 on print error', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      const eventListeners = new Map<string, Function>();
      mockSocket.on.mockImplementation((event, callback) => {
        eventListeners.set(event, callback);
        return mockSocket;
      });
      mockSocket.connect.mockImplementation((port, address, callback) => {
        setTimeout(() => {
          const errorCb = eventListeners.get('error');
          if (errorCb) errorCb(new Error('Connection failed'));
        }, 0);
        return mockSocket;
      });

      const { req, res, next } = createMockReqRes({
        body: { printerAddress: '192.168.1.50', data: 'test data' }
      });

      await posController.printToNetworkPrinter(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Print failed' }));
    });
  });

  // ============================================
  // openCashDrawer
  // ============================================
  describe('openCashDrawer', () => {
    it('should return 400 for missing printer address', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      const { req, res, next } = createMockReqRes({
        body: {}
      });

      await posController.openCashDrawer(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Printer address required' });
    });

    it('should send cash drawer kick command', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      mockSocket.connect.mockImplementation((port, address, callback) => {
        if (callback) callback();
        return mockSocket;
      });
      mockSocket.write.mockImplementation((data, callback) => {
        if (callback) callback(null);
        return true;
      });

      const { req, res, next } = createMockReqRes({
        body: { printerAddress: '192.168.1.50' }
      });

      await posController.openCashDrawer(req, res, next);

      expect(mockSocket.connect).toHaveBeenCalledWith(9100, '192.168.1.50', expect.any(Function));
      expect(mockSocket.write).toHaveBeenCalledWith(
        Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA]),
        expect.any(Function)
      );
      expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Cash drawer triggered' });
    });

    it('should return 500 on drawer open error', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      const eventListeners = new Map<string, Function>();
      mockSocket.on.mockImplementation((event, callback) => {
        eventListeners.set(event, callback);
        return mockSocket;
      });
      mockSocket.connect.mockImplementation((port, address, callback) => {
        setTimeout(() => {
          const errorCb = eventListeners.get('error');
          if (errorCb) errorCb(new Error('Drawer open error'));
        }, 0);
        return mockSocket;
      });

      const { req, res, next } = createMockReqRes({
        body: { printerAddress: '192.168.1.50' }
      });

      await posController.openCashDrawer(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Failed to open cash drawer' }));
    });
  });

  // ============================================
  // getPrinterStatus
  // ============================================
  describe('getPrinterStatus', () => {
    it('should return 400 for missing printer address', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      const { req, res, next } = createMockReqRes({
        query: {}
      });

      await posController.getPrinterStatus(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Printer address required' });
    });

    it('should return online status when printer responds', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      mockSocket.connect.mockImplementation((port, address, callback) => {
        if (callback) callback();
        return mockSocket;
      });

      const { req, res, next } = createMockReqRes({
        query: { printerAddress: '192.168.1.50' }
      });

      await posController.getPrinterStatus(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'online',
        address: '192.168.1.50',
      }));
    });

    it('should return offline status when printer does not respond', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      const eventListeners = new Map<string, Function>();
      mockSocket.on.mockImplementation((event, callback) => {
        eventListeners.set(event, callback);
        return mockSocket;
      });
      mockSocket.connect.mockImplementation((port, address, callback) => {
        setTimeout(() => {
          const errorCb = eventListeners.get('error');
          if (errorCb) errorCb(new Error('Connection refused'));
        }, 0);
        return mockSocket;
      });

      const { req, res, next } = createMockReqRes({
        query: { printerAddress: '192.168.1.50' }
      });

      await posController.getPrinterStatus(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'offline',
        address: '192.168.1.50',
      }));
    });

    it('should handle timeout gracefully', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      const eventListeners = new Map<string, Function>();
      mockSocket.on.mockImplementation((event, callback) => {
        eventListeners.set(event, callback);
        return mockSocket;
      });
      mockSocket.connect.mockImplementation((port, address, callback) => {
        setTimeout(() => {
          const timeoutCb = eventListeners.get('timeout');
          if (timeoutCb) timeoutCb();
        }, 0);
        return mockSocket;
      });

      const { req, res, next } = createMockReqRes({
        query: { printerAddress: '192.168.1.50' }
      });

      await posController.getPrinterStatus(req, res, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'offline',
        address: '192.168.1.50',
      }));
    });
  });

  // ============================================
  // savePrinterConfig (uses Supabase)
  // ============================================
  describe('savePrinterConfig', () => {
    it('should save printer configuration to site_settings', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      const printers = [
        { id: 'printer-1', name: 'Kitchen', address: '192.168.1.50', port: 9100 },
        { id: 'printer-2', name: 'Bar', address: '192.168.1.51', port: 9100 },
      ];

      currentQueryMock = createQueryMock(() => []);

      const { req, res, next } = createMockReqRes({
        body: { printers }
      });

      await posController.savePrinterConfig(req, res, next);

      expect(mockSupabaseFrom).toHaveBeenCalledWith('site_settings');
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should call next on database error', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      // Create mock that simulates error
      currentQueryMock = {
        ...createQueryMock(() => []),
        upsert: vi.fn().mockReturnValue({
          then: (resolve: (value: { data: unknown; error: unknown }) => void) => {
            resolve({ data: null, error: { message: 'Database error' } });
          },
        }),
      };

      const { req, res, next } = createMockReqRes({
        body: { printers: [] }
      });

      await posController.savePrinterConfig(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  // ============================================
  // getPrinterConfig (uses Supabase)
  // ============================================
  describe('getPrinterConfig', () => {
    it('should return printer configuration from site_settings', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      const printers = [
        { id: 'printer-1', name: 'Kitchen', address: '192.168.1.50', port: 9100 },
      ];

      currentQueryMock = createQueryMock(() => [
        { value: { printers } }
      ]);

      const { req, res, next } = createMockReqRes();

      await posController.getPrinterConfig(req, res, next);

      expect(mockSupabaseFrom).toHaveBeenCalledWith('site_settings');
      expect(currentQueryMock.eq).toHaveBeenCalledWith('key', 'printer_config');
      expect(res.json).toHaveBeenCalledWith({ printers });
    });

    it('should return empty array when no config exists', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      currentQueryMock = createQueryMock(() => []);

      const { req, res, next } = createMockReqRes();

      await posController.getPrinterConfig(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ printers: [] });
    });

    it('should handle PGRST116 (not found) error gracefully', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      currentQueryMock = {
        ...createQueryMock(() => []),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' },
        }),
      };

      const { req, res, next } = createMockReqRes();

      await posController.getPrinterConfig(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ printers: [] });
    });

    it('should call next on non-PGRST116 database error', async () => {
      const posController = await import('../../../../src/modules/pos/pos-hardware.controller');
      
      currentQueryMock = {
        ...createQueryMock(() => []),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'OTHER_ERROR', message: 'Connection failed' },
        }),
      };
      mockSupabaseFrom.mockReturnValue(currentQueryMock);

      const { req, res, next } = createMockReqRes();

      await posController.getPrinterConfig(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
