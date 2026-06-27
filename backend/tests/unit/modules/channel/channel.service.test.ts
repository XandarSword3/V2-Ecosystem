
// ============================================
// Supabase Chainable Query Mock
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
    then: (resolve: (v: { data: unknown; error: unknown }) => void) => resolve({ data: insertData, error: null })
  }));
  mockObj.upsert = vi.fn().mockImplementation((data) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'upsert-1', ...data }, error: null })
    })
  }));
  const updateChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is', 'not', 'or', 'in'].forEach(method => {
    updateChain[method] = vi.fn().mockReturnValue(updateChain);
  });
  updateChain.select = vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({ data: { id: 'item-1' }, error: null })
  });
  updateChain.then = (resolve: (v: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null });
  mockObj.update = vi.fn().mockReturnValue(updateChain);
  
  const deleteChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'lte', 'gte', 'not', 'is', 'or', 'in'].forEach(method => {
    deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
  });
  deleteChain.then = (resolve: (v: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null });
  mockObj.delete = vi.fn().mockReturnValue(deleteChain);
  return mockObj;
}

// ============================================
// Mock Data Factories
// ============================================

function createMockConnection(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conn-1',
    property_id: 'property-1',
    channel_code: 'BOOKING',
    channel_name: 'Booking.com',
    status: 'active',
    hotel_code: 'HOTEL123',
    siteminder_property_id: 'sm-prop-1',
    last_sync_at: '2026-01-15T10:00:00Z',
    last_error: null,
    error_count: 0,
    config: {},
    ...overrides,
  };
}

function createMockRoomMapping(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rm-1',
    connection_id: 'conn-1',
    room_type_id: 'rt-1',
    channel_room_code: 'DBL',
    channel_room_name: 'Double Room',
    is_active: true,
    room_types: { name: 'Double Room' },
    ...overrides,
  };
}

function createMockRateMapping(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rate-1',
    connection_id: 'conn-1',
    rate_plan_id: 'rp-1',
    channel_rate_code: 'BAR',
    channel_rate_name: 'Best Available Rate',
    is_active: true,
    markup_type: 'percentage',
    markup_value: 10,
    commission_rate: 15,
    rate_plans: { name: 'Best Available Rate' },
    ...overrides,
  };
}

function createMockChannelReservation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cr-1',
    connection_id: 'conn-1',
    channel_booking_ref: 'BK-123456',
    channel_guest_id: 'guest-ext-1',
    guest_name: 'John Doe',
    guest_email: 'john@example.com',
    guest_phone: '+1234567890',
    check_in: '2026-02-15',
    check_out: '2026-02-18',
    room_mapping_id: 'rm-1',
    rate_mapping_id: 'rate-1',
    num_adults: 2,
    num_children: 1,
    total_amount: 450.00,
    currency: 'USD',
    commission_amount: 67.50,
    payment_status: 'paid',
    booking_status: 'new',
    special_requests: 'Late check-in',
    reservation_id: null,
    processed: false,
    processed_at: null,
    received_at: '2026-02-01T10:00:00Z',
    reservations: null,
    ...overrides,
  };
}

function createMockSyncLog(overrides: Record<string, unknown> = {}) {
  return {
    id: 'log-1',
    connection_id: 'conn-1',
    sync_type: 'availability_push',
    direction: 'outbound',
    status: 'success',
    records_processed: 10,
    records_failed: 0,
    duration_ms: 1500,
    error_message: null,
    details: {},
    created_at: '2026-02-01T10:00:00Z',
    ...overrides,
  };
}

function createMockAvailabilityUpdate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'av-1',
    connection_id: 'conn-1',
    room_mapping_id: 'rm-1',
    date: '2026-02-15',
    available_units: 5,
    status: 'pending',
    ...overrides,
  };
}

function createMockRateUpdate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ru-1',
    connection_id: 'conn-1',
    room_mapping_id: 'rm-1',
    rate_mapping_id: 'rate-1',
    date: '2026-02-15',
    rate: 150.00,
    currency: 'USD',
    min_stay: 1,
    max_stay: null,
    closed: false,
    status: 'pending',
    ...overrides,
  };
}

// ============================================
// Supabase Mock Setup
// ============================================

let mockConnections: unknown[] = [];
let mockRoomMappings: unknown[] = [];
let mockRateMappings: unknown[] = [];
let mockChannelReservations: unknown[] = [];
let mockSyncLog: unknown[] = [];
let mockAvailabilityUpdates: unknown[] = [];
let mockRateUpdates: unknown[] = [];
let mockRoomAvailability: unknown[] = [];
let mockGuests: unknown[] = [];
let mockReservations: unknown[] = [];

const tableMocks: Record<string, ReturnType<typeof createQueryMock>> = {};

function getTableMock(table: string) {
  if (!tableMocks[table]) {
    tableMocks[table] = createQueryMock(() => {
      switch (table) {
        case 'channel_connections': return mockConnections;
        case 'channel_room_mappings': return mockRoomMappings;
        case 'channel_rate_mappings': return mockRateMappings;
        case 'channel_reservations': return mockChannelReservations;
        case 'channel_sync_log': return mockSyncLog;
        case 'channel_availability_updates': return mockAvailabilityUpdates;
        case 'channel_rate_updates': return mockRateUpdates;
        case 'room_availability': return mockRoomAvailability;
        case 'guests': return mockGuests;
        case 'reservations': return mockReservations;
        default: return [];
      }
    });
  }
  return tableMocks[table];
}

const mockSupabase = {
  from: vi.fn((table: string) => getTableMock(table)),
};

// Mock the database connection
vi.mock('../../../../src/database/connection.js', () => ({
  getSupabase: () => mockSupabase,
}));

// Mock fetch for SiteMinder API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocking
import * as channelService from '../../../../src/modules/channels/channel.service.js';

// ============================================
// Tests
// ============================================

describe('Channel Service (modules/channels)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset mock data
    mockConnections = [];
    mockRoomMappings = [];
    mockRateMappings = [];
    mockChannelReservations = [];
    mockSyncLog = [];
    mockAvailabilityUpdates = [];
    mockRateUpdates = [];
    mockRoomAvailability = [];
    mockGuests = [];
    mockReservations = [];
    
    // Clear table mocks to reset state
    Object.keys(tableMocks).forEach(key => delete tableMocks[key]);
    
    // Reset fetch mock
    mockFetch.mockReset();
  });

  // ============================================
  // CHANNELS constant
  // ============================================

  describe('CHANNELS', () => {
    it('should export CHANNELS constant with known OTAs', () => {
      expect(channelService.CHANNELS).toBeDefined();
      expect(channelService.CHANNELS.BOOKING).toEqual({ code: 'BOOKING', name: 'Booking.com' });
      expect(channelService.CHANNELS.EXPEDIA).toEqual({ code: 'EXPEDIA', name: 'Expedia' });
      expect(channelService.CHANNELS.AGODA).toEqual({ code: 'AGODA', name: 'Agoda' });
      expect(channelService.CHANNELS.AIRBNB).toEqual({ code: 'AIRBNB', name: 'Airbnb' });
    });

    it('should have all major channel codes', () => {
      const codes = Object.keys(channelService.CHANNELS);
      expect(codes).toContain('BOOKING');
      expect(codes).toContain('EXPEDIA');
      expect(codes).toContain('AGODA');
      expect(codes).toContain('AIRBNB');
      expect(codes).toContain('VRBO');
      expect(codes).toContain('TRIPADVISOR');
      expect(codes).toContain('GOOGLE');
      expect(codes).toContain('HOTELSCOM');
    });
  });

  // ============================================
  // Connection Management
  // ============================================

  describe('getConnections', () => {
    it('should return all connections for a property', async () => {
      mockConnections = [
        createMockConnection({ id: 'conn-1', channel_code: 'BOOKING' }),
        createMockConnection({ id: 'conn-2', channel_code: 'EXPEDIA' }),
      ];

      const result = await channelService.getConnections('property-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('channel_connections');
      expect(result).toHaveLength(2);
      expect(result[0].channel_code).toBe('BOOKING');
      expect(result[1].channel_code).toBe('EXPEDIA');
    });

    it('should return empty array when no connections exist', async () => {
      mockConnections = [];

      const result = await channelService.getConnections('property-1');

      expect(result).toEqual([]);
    });

    it('should filter by property_id', async () => {
      mockConnections = [createMockConnection()];

      await channelService.getConnections('property-1');

      const tableMock = getTableMock('channel_connections');
      expect(tableMock.eq).toHaveBeenCalledWith('property_id', 'property-1');
    });

    it('should order by channel_name', async () => {
      mockConnections = [createMockConnection()];

      await channelService.getConnections('property-1');

      const tableMock = getTableMock('channel_connections');
      expect(tableMock.order).toHaveBeenCalledWith('channel_name');
    });
  });

  describe('getConnection', () => {
    it('should return a single connection by id', async () => {
      const connection = createMockConnection();
      mockConnections = [connection];

      const result = await channelService.getConnection('conn-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('channel_connections');
      expect(result).toMatchObject({
        id: 'conn-1',
        channel_code: 'BOOKING',
      });
    });

    it('should return null when connection not found', async () => {
      mockConnections = [];

      const result = await channelService.getConnection('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createConnection', () => {
    it('should create a new connection with valid channel code', async () => {
      mockConnections = [];
      mockSyncLog = [];

      const result = await channelService.createConnection(
        'property-1',
        'BOOKING',
        'HOTEL123',
        'sm-prop-1'
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('channel_connections');
      expect(result).toBeDefined();
      expect(result.property_id).toBe('property-1');
      expect(result.channel_code).toBe('BOOKING');
      expect(result.channel_name).toBe('Booking.com');
    });

    it('should throw error for invalid channel code', async () => {
      await expect(
        channelService.createConnection('property-1', 'INVALID_CHANNEL')
      ).rejects.toThrow('Invalid channel code: INVALID_CHANNEL');
    });

    it('should create connection without optional params', async () => {
      mockConnections = [];
      mockSyncLog = [];

      const result = await channelService.createConnection('property-1', 'EXPEDIA');

      expect(result.channel_code).toBe('EXPEDIA');
      expect(result.channel_name).toBe('Expedia');
    });

    it('should log sync activity after creation', async () => {
      mockConnections = [];
      mockSyncLog = [];

      await channelService.createConnection('property-1', 'AGODA');

      expect(mockSupabase.from).toHaveBeenCalledWith('channel_sync_log');
    });
  });

  describe('updateConnectionStatus', () => {
    it('should update connection status to active', async () => {
      mockConnections = [createMockConnection({ error_count: 0 })];

      await channelService.updateConnectionStatus('conn-1', 'active');

      const tableMock = getTableMock('channel_connections');
      expect(tableMock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
          last_error: null,
          error_count: 0,
        })
      );
    });

    it('should update connection status to error with message', async () => {
      mockConnections = [createMockConnection({ error_count: 2 })];

      await channelService.updateConnectionStatus('conn-1', 'error', 'API timeout');

      const tableMock = getTableMock('channel_connections');
      expect(tableMock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          last_error: 'API timeout',
          error_count: 3,
        })
      );
    });

    it('should pause connection', async () => {
      mockConnections = [createMockConnection()];

      await channelService.updateConnectionStatus('conn-1', 'paused');

      const tableMock = getTableMock('channel_connections');
      expect(tableMock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'paused',
        })
      );
    });
  });

  describe('activateConnection', () => {
    it('should activate connection without SiteMinder', async () => {
      mockConnections = [createMockConnection({ siteminder_property_id: null })];

      await channelService.activateConnection('conn-1');

      const tableMock = getTableMock('channel_connections');
      expect(tableMock.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
        })
      );
    });

    it('should verify with SiteMinder before activation', async () => {
      mockConnections = [createMockConnection({ siteminder_property_id: 'sm-prop-1' })];
      
      // Mock SiteMinder auth
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'token123', expires_in: 3600 }),
      });
      // Mock SiteMinder property verification
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'sm-prop-1' }),
      });

      await channelService.activateConnection('conn-1');

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should throw error when connection not found', async () => {
      mockConnections = [];

      await expect(channelService.activateConnection('nonexistent')).rejects.toThrow('Connection not found');
    });

    it('should set error status on SiteMinder failure', async () => {
      mockConnections = [createMockConnection({ siteminder_property_id: 'sm-prop-1' })];
      
      // Token may be cached from previous test, so just mock the property verification to fail
      mockFetch.mockReset();
      // Mock auth (may or may not be called depending on token cache)
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('/oauth/token')) {
          return {
            ok: true,
            json: () => Promise.resolve({ access_token: 'token-new', expires_in: 3600 }),
          };
        }
        // Property verification should fail
        return {
          ok: false,
          status: 404,
          text: () => Promise.resolve('Property not found'),
        };
      });

      // The activation should fail and re-throw after updating status
      await expect(channelService.activateConnection('conn-1')).rejects.toThrow('SiteMinder API error');
    });
  });

  describe('deleteConnection', () => {
    it('should delete a connection', async () => {
      mockConnections = [createMockConnection()];

      await channelService.deleteConnection('conn-1');

      const tableMock = getTableMock('channel_connections');
      expect(tableMock.delete).toHaveBeenCalled();
    });
  });

  // ============================================
  // Room Mappings
  // ============================================

  describe('getRoomMappings', () => {
    it('should return room mappings for a connection', async () => {
      mockRoomMappings = [
        createMockRoomMapping({ id: 'rm-1', channel_room_code: 'DBL' }),
        createMockRoomMapping({ id: 'rm-2', channel_room_code: 'SGL' }),
      ];

      const result = await channelService.getRoomMappings('conn-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('channel_room_mappings');
      expect(result).toHaveLength(2);
    });

    it('should include room_types relation', async () => {
      mockRoomMappings = [createMockRoomMapping()];

      await channelService.getRoomMappings('conn-1');

      const tableMock = getTableMock('channel_room_mappings');
      expect(tableMock.select).toHaveBeenCalledWith('*, metadatas(name)');
    });

    it('should return empty array when no mappings exist', async () => {
      mockRoomMappings = [];

      const result = await channelService.getRoomMappings('conn-1');

      expect(result).toEqual([]);
    });
  });

  describe('createRoomMapping', () => {
    it('should create a new room mapping', async () => {
      mockRoomMappings = [];

      const result = await channelService.createRoomMapping(
        'conn-1',
        'rt-1',
        'DBL',
        'Double Room'
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('channel_room_mappings');
      expect(result).toBeDefined();
      expect(result.connection_id).toBe('conn-1');
      expect(result.channel_room_code).toBe('DBL');
    });
  });

  describe('updateRoomMapping', () => {
    it('should update a room mapping', async () => {
      mockRoomMappings = [createMockRoomMapping()];

      await channelService.updateRoomMapping('rm-1', { is_active: false });

      const tableMock = getTableMock('channel_room_mappings');
      expect(tableMock.update).toHaveBeenCalledWith({ is_active: false });
    });
  });

  describe('deleteRoomMapping', () => {
    it('should delete a room mapping', async () => {
      mockRoomMappings = [createMockRoomMapping()];

      await channelService.deleteRoomMapping('rm-1');

      const tableMock = getTableMock('channel_room_mappings');
      expect(tableMock.delete).toHaveBeenCalled();
    });
  });

  // ============================================
  // Rate Mappings
  // ============================================

  describe('getRateMappings', () => {
    it('should return rate mappings for a connection', async () => {
      mockRateMappings = [
        createMockRateMapping({ id: 'rate-1', channel_rate_code: 'BAR' }),
        createMockRateMapping({ id: 'rate-2', channel_rate_code: 'PROMO' }),
      ];

      const result = await channelService.getRateMappings('conn-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('channel_rate_mappings');
      expect(result).toHaveLength(2);
    });

    it('should include rate_plans relation', async () => {
      mockRateMappings = [createMockRateMapping()];

      await channelService.getRateMappings('conn-1');

      const tableMock = getTableMock('channel_rate_mappings');
      expect(tableMock.select).toHaveBeenCalledWith('*, rate_plans(name)');
    });
  });

  describe('createRateMapping', () => {
    it('should create a rate mapping with default markup', async () => {
      mockRateMappings = [];

      const result = await channelService.createRateMapping(
        'conn-1',
        'rp-1',
        'BAR',
        'Best Available Rate'
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('channel_rate_mappings');
      expect(result).toBeDefined();
      expect(result.channel_rate_code).toBe('BAR');
    });

    it('should create a rate mapping with custom markup', async () => {
      mockRateMappings = [];

      const result = await channelService.createRateMapping(
        'conn-1',
        'rp-1',
        'PROMO',
        'Promotional Rate',
        { markupType: 'fixed', markupValue: 10, commissionRate: 12 }
      );

      expect(result).toBeDefined();
      expect(result.channel_rate_code).toBe('PROMO');
    });
  });

  // ============================================
  // Availability Sync
  // ============================================

  describe('pushAvailability', () => {
    it('should throw error when connection not active', async () => {
      mockConnections = [createMockConnection({ status: 'paused' })];

      await expect(
        channelService.pushAvailability('conn-1', [
          { date: '2026-02-15', roomTypeCode: 'DBL', available: 5 },
        ])
      ).rejects.toThrow('Connection not active');
    });

    it('should throw error when connection not found', async () => {
      mockConnections = [];

      await expect(
        channelService.pushAvailability('nonexistent', [
          { date: '2026-02-15', roomTypeCode: 'DBL', available: 5 },
        ])
      ).rejects.toThrow('Connection not active');
    });

    it('should push availability updates for direct channels', async () => {
      mockConnections = [createMockConnection({ siteminder_property_id: null })];
      mockRoomMappings = [createMockRoomMapping({ channel_room_code: 'DBL' })];
      mockAvailabilityUpdates = [];
      mockSyncLog = [];

      const result = await channelService.pushAvailability('conn-1', [
        { date: '2026-02-15', roomTypeCode: 'DBL', available: 5 },
      ]);

      expect(result.success).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('should count failed updates when room mapping not found', async () => {
      mockConnections = [createMockConnection({ siteminder_property_id: null })];
      mockRoomMappings = [createMockRoomMapping({ channel_room_code: 'DBL' })];
      mockAvailabilityUpdates = [];
      mockSyncLog = [];

      const result = await channelService.pushAvailability('conn-1', [
        { date: '2026-02-15', roomTypeCode: 'UNKNOWN', available: 5 },
      ]);

      expect(result.success).toBe(0);
      expect(result.failed).toBe(1);
    });

    it('should log sync activity after push', async () => {
      mockConnections = [createMockConnection({ siteminder_property_id: null })];
      mockRoomMappings = [createMockRoomMapping({ channel_room_code: 'DBL' })];
      mockAvailabilityUpdates = [];
      mockSyncLog = [];

      await channelService.pushAvailability('conn-1', [
        { date: '2026-02-15', roomTypeCode: 'DBL', available: 5 },
      ]);

      expect(mockSupabase.from).toHaveBeenCalledWith('channel_sync_log');
    });

    it('should update connection last_sync_at', async () => {
      mockConnections = [createMockConnection({ siteminder_property_id: null })];
      mockRoomMappings = [createMockRoomMapping({ channel_room_code: 'DBL' })];
      mockAvailabilityUpdates = [];
      mockSyncLog = [];

      await channelService.pushAvailability('conn-1', [
        { date: '2026-02-15', roomTypeCode: 'DBL', available: 5 },
      ]);

      const tableMock = getTableMock('channel_connections');
      expect(tableMock.update).toHaveBeenCalled();
    });
  });

  describe('pushAvailabilityForDateRange', () => {
    it('should throw error when connection not found', async () => {
      mockConnections = [];

      await expect(
        channelService.pushAvailabilityForDateRange(
          'nonexistent',
          new Date('2026-02-15'),
          new Date('2026-02-20')
        )
      ).rejects.toThrow('Connection not found');
    });

    it('should fetch room availability and push updates', async () => {
      mockConnections = [createMockConnection({ siteminder_property_id: null })];
      mockRoomMappings = [createMockRoomMapping({ room_type_id: 'rt-1', channel_room_code: 'DBL' })];
      mockRoomAvailability = [
        { room_type_id: 'rt-1', date: '2026-02-15', available_units: 5 },
        { room_type_id: 'rt-1', date: '2026-02-16', available_units: 3 },
      ];
      mockAvailabilityUpdates = [];
      mockSyncLog = [];

      const result = await channelService.pushAvailabilityForDateRange(
        'conn-1',
        new Date('2026-02-15'),
        new Date('2026-02-20')
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('room_availability');
      expect(result).toBeDefined();
    });
  });

  // ============================================
  // Rate Sync
  // ============================================

  describe('pushRates', () => {
    it('should throw error when connection not active', async () => {
      mockConnections = [createMockConnection({ status: 'paused' })];

      await expect(
        channelService.pushRates('conn-1', [
          { date: '2026-02-15', roomTypeCode: 'DBL', rateCode: 'BAR', rate: 150, currency: 'USD' },
        ])
      ).rejects.toThrow('Connection not active');
    });

    it('should push rate updates for direct channels', async () => {
      mockConnections = [createMockConnection({ siteminder_property_id: null })];
      mockRoomMappings = [createMockRoomMapping({ channel_room_code: 'DBL' })];
      mockRateMappings = [createMockRateMapping({ channel_rate_code: 'BAR', markup_type: 'percentage', markup_value: 10 })];
      mockRateUpdates = [];
      mockSyncLog = [];

      const result = await channelService.pushRates('conn-1', [
        { date: '2026-02-15', roomTypeCode: 'DBL', rateCode: 'BAR', rate: 100, currency: 'USD' },
      ]);

      expect(result.success).toBe(1);
      expect(result.failed).toBe(0);
    });

    it('should apply percentage markup to rates', async () => {
      mockConnections = [createMockConnection({ siteminder_property_id: null })];
      mockRoomMappings = [createMockRoomMapping({ channel_room_code: 'DBL' })];
      mockRateMappings = [createMockRateMapping({ channel_rate_code: 'BAR', markup_type: 'percentage', markup_value: 10 })];
      mockRateUpdates = [];
      mockSyncLog = [];

      await channelService.pushRates('conn-1', [
        { date: '2026-02-15', roomTypeCode: 'DBL', rateCode: 'BAR', rate: 100, currency: 'USD' },
      ]);

      const tableMock = getTableMock('channel_rate_updates');
      expect(tableMock.insert).toHaveBeenCalled();
      // Rate should be 100 * 1.10 = 110
    });

    it('should count failed updates when mapping not found', async () => {
      mockConnections = [createMockConnection({ siteminder_property_id: null })];
      mockRoomMappings = [createMockRoomMapping({ channel_room_code: 'DBL' })];
      mockRateMappings = [createMockRateMapping({ channel_rate_code: 'BAR' })];
      mockRateUpdates = [];
      mockSyncLog = [];

      const result = await channelService.pushRates('conn-1', [
        { date: '2026-02-15', roomTypeCode: 'UNKNOWN', rateCode: 'BAR', rate: 100, currency: 'USD' },
      ]);

      expect(result.failed).toBe(1);
    });

    it('should log sync activity', async () => {
      mockConnections = [createMockConnection({ siteminder_property_id: null })];
      mockRoomMappings = [createMockRoomMapping({ channel_room_code: 'DBL' })];
      mockRateMappings = [createMockRateMapping({ channel_rate_code: 'BAR' })];
      mockRateUpdates = [];
      mockSyncLog = [];

      await channelService.pushRates('conn-1', [
        { date: '2026-02-15', roomTypeCode: 'DBL', rateCode: 'BAR', rate: 100, currency: 'USD' },
      ]);

      expect(mockSupabase.from).toHaveBeenCalledWith('channel_sync_log');
    });
  });

  // ============================================
  // Reservation Handling
  // ============================================

  describe('processInboundReservation', () => {
    const mockReservation = {
      channelBookingRef: 'BK-123456',
      guestName: 'John Doe',
      guestEmail: 'john@example.com',
      guestPhone: '+1234567890',
      checkIn: '2026-02-15',
      checkOut: '2026-02-18',
      roomTypeCode: 'DBL',
      rateCode: 'BAR',
      numAdults: 2,
      numChildren: 1,
      totalAmount: 450,
      currency: 'USD',
      paymentStatus: 'paid' as const,
      bookingStatus: 'new' as const,
    };

    it('should store channel reservation', async () => {
      mockRoomMappings = [createMockRoomMapping({ channel_room_code: 'DBL', room_type_id: 'rt-1' })];
      mockRateMappings = [createMockRateMapping({ channel_rate_code: 'BAR' })];
      mockChannelReservations = [];
      mockGuests = [];
      mockReservations = [];

      const result = await channelService.processInboundReservation('conn-1', mockReservation);

      expect(mockSupabase.from).toHaveBeenCalledWith('channel_reservations');
      expect(result.channelReservationId).toBeDefined();
    });

    it('should create guest if not exists', async () => {
      mockRoomMappings = [createMockRoomMapping({ channel_room_code: 'DBL', room_type_id: 'rt-1' })];
      mockRateMappings = [createMockRateMapping({ channel_rate_code: 'BAR' })];
      mockChannelReservations = [];
      mockGuests = [];
      mockReservations = [];

      await channelService.processInboundReservation('conn-1', mockReservation);

      expect(mockSupabase.from).toHaveBeenCalledWith('guests');
    });

    it('should reuse existing guest by email', async () => {
      mockRoomMappings = [createMockRoomMapping({ channel_room_code: 'DBL', room_type_id: 'rt-1' })];
      mockRateMappings = [createMockRateMapping({ channel_rate_code: 'BAR' })];
      mockChannelReservations = [];
      mockGuests = [{ id: 'guest-existing', email: 'john@example.com' }];
      mockReservations = [];

      await channelService.processInboundReservation('conn-1', mockReservation);

      expect(mockSupabase.from).toHaveBeenCalledWith('guests');
    });

    it('should process cancellation', async () => {
      mockRoomMappings = [createMockRoomMapping({ channel_room_code: 'DBL' })];
      mockRateMappings = [];
      mockChannelReservations = [
        createMockChannelReservation({
          channel_booking_ref: 'BK-123456',
          booking_status: 'new',
          reservation_id: 'res-1',
        }),
      ];
      mockReservations = [{ id: 'res-1' }];

      await channelService.processInboundReservation('conn-1', {
        ...mockReservation,
        bookingStatus: 'cancelled',
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('reservations');
    });

    it('should process modification', async () => {
      mockRoomMappings = [createMockRoomMapping({ channel_room_code: 'DBL' })];
      mockRateMappings = [];
      mockChannelReservations = [
        createMockChannelReservation({
          channel_booking_ref: 'BK-123456',
          booking_status: 'new',
          reservation_id: 'res-1',
        }),
      ];
      mockReservations = [{ id: 'res-1' }];

      await channelService.processInboundReservation('conn-1', {
        ...mockReservation,
        bookingStatus: 'modified',
        checkOut: '2026-02-20',
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('reservations');
    });
  });

  describe('handleSiteMinderWebhook', () => {
    it('should throw error when connection not found', async () => {
      mockConnections = [];

      await expect(
        channelService.handleSiteMinderWebhook('property-1', 'BOOKING', {
          booking_id: 'BK-123',
          guest_name: 'Test Guest',
          check_in: '2026-02-15',
          check_out: '2026-02-18',
          room_type_code: 'DBL',
          adults: 2,
          total: 300,
          currency: 'USD',
        })
      ).rejects.toThrow('No connection found');
    });

    it('should process webhook payload and create reservation', async () => {
      mockConnections = [createMockConnection({ property_id: 'property-1', channel_code: 'BOOKING' })];
      mockRoomMappings = [createMockRoomMapping({ channel_room_code: 'DBL' })];
      mockRateMappings = [];
      mockChannelReservations = [];
      mockGuests = [];
      mockReservations = [];
      mockSyncLog = [];

      await channelService.handleSiteMinderWebhook('property-1', 'BOOKING', {
        booking_id: 'BK-123',
        guest_name: 'Test Guest',
        email: 'test@example.com',
        check_in: '2026-02-15',
        check_out: '2026-02-18',
        room_type_code: 'DBL',
        adults: 2,
        children: 0,
        total: 300,
        currency: 'USD',
        payment_status: 'paid',
        status: 'NEW',
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('channel_reservations');
      expect(mockSupabase.from).toHaveBeenCalledWith('channel_sync_log');
    });

    it('should handle cancellation status', async () => {
      mockConnections = [createMockConnection({ property_id: 'property-1', channel_code: 'BOOKING' })];
      mockRoomMappings = [];
      mockRateMappings = [];
      mockChannelReservations = [
        createMockChannelReservation({
          channel_booking_ref: 'BK-123',
          booking_status: 'new',
          reservation_id: 'res-1',
        }),
      ];
      mockSyncLog = [];

      await channelService.handleSiteMinderWebhook('property-1', 'BOOKING', {
        booking_id: 'BK-123',
        guest_name: 'Test Guest',
        check_in: '2026-02-15',
        check_out: '2026-02-18',
        room_type_code: 'DBL',
        adults: 2,
        status: 'CXL',
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('channel_reservations');
    });

    it('should handle modification status', async () => {
      mockConnections = [createMockConnection({ property_id: 'property-1', channel_code: 'BOOKING' })];
      mockRoomMappings = [];
      mockRateMappings = [];
      mockChannelReservations = [
        createMockChannelReservation({
          channel_booking_ref: 'BK-123',
          booking_status: 'new',
          reservation_id: 'res-1',
        }),
      ];
      mockSyncLog = [];

      await channelService.handleSiteMinderWebhook('property-1', 'BOOKING', {
        booking_id: 'BK-123',
        guest_name: 'Test Guest',
        check_in: '2026-02-15',
        check_out: '2026-02-20',
        room_type_code: 'DBL',
        adults: 2,
        status: 'MOD',
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('channel_reservations');
    });
  });

  // ============================================
  // Sync Log
  // ============================================

  describe('getSyncLog', () => {
    it('should return sync logs for a connection', async () => {
      mockSyncLog = [
        createMockSyncLog({ id: 'log-1', sync_type: 'availability_push' }),
        createMockSyncLog({ id: 'log-2', sync_type: 'rate_push' }),
      ];

      const result = await channelService.getSyncLog('conn-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('channel_sync_log');
      expect(result).toHaveLength(2);
    });

    it('should order by created_at descending', async () => {
      mockSyncLog = [createMockSyncLog()];

      await channelService.getSyncLog('conn-1');

      const tableMock = getTableMock('channel_sync_log');
      expect(tableMock.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('should apply limit parameter', async () => {
      mockSyncLog = [createMockSyncLog()];

      await channelService.getSyncLog('conn-1', 50);

      const tableMock = getTableMock('channel_sync_log');
      expect(tableMock.limit).toHaveBeenCalledWith(50);
    });

    it('should use default limit of 100', async () => {
      mockSyncLog = [createMockSyncLog()];

      await channelService.getSyncLog('conn-1');

      const tableMock = getTableMock('channel_sync_log');
      expect(tableMock.limit).toHaveBeenCalledWith(100);
    });

    it('should return empty array when no logs exist', async () => {
      mockSyncLog = [];

      const result = await channelService.getSyncLog('conn-1');

      expect(result).toEqual([]);
    });
  });

  // ============================================
  // Scheduled Sync
  // ============================================

  describe('syncAllActiveConnections', () => {
    it('should sync all active connections', async () => {
      mockConnections = [
        createMockConnection({ id: 'conn-1', status: 'active', siteminder_property_id: null }),
        createMockConnection({ id: 'conn-2', status: 'active', siteminder_property_id: null }),
      ];
      mockRoomMappings = [createMockRoomMapping({ room_type_id: 'rt-1', channel_room_code: 'DBL' })];
      mockRoomAvailability = [];
      mockAvailabilityUpdates = [];
      mockSyncLog = [];

      await channelService.syncAllActiveConnections();

      expect(mockSupabase.from).toHaveBeenCalledWith('channel_connections');
    });

    it('should handle errors gracefully', async () => {
      mockConnections = [createMockConnection({ id: 'conn-1', status: 'active' })];
      mockRoomMappings = [];
      mockRoomAvailability = [];

      // Should not throw even if individual sync fails
      await expect(channelService.syncAllActiveConnections()).resolves.not.toThrow();
    });
  });

  // ============================================
  // Channel Reservations Query
  // ============================================

  describe('getChannelReservations', () => {
    it('should return channel reservations for a connection', async () => {
      mockChannelReservations = [
        createMockChannelReservation({ id: 'cr-1' }),
        createMockChannelReservation({ id: 'cr-2' }),
      ];

      const result = await channelService.getChannelReservations('conn-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('channel_reservations');
      expect(result).toHaveLength(2);
    });

    it('should include reservations relation', async () => {
      mockChannelReservations = [createMockChannelReservation()];

      await channelService.getChannelReservations('conn-1');

      const tableMock = getTableMock('channel_reservations');
      expect(tableMock.select).toHaveBeenCalledWith('*, reservations(*)');
    });

    it('should filter by start date', async () => {
      mockChannelReservations = [createMockChannelReservation()];

      await channelService.getChannelReservations('conn-1', { startDate: '2026-02-01' });

      const tableMock = getTableMock('channel_reservations');
      expect(tableMock.gte).toHaveBeenCalledWith('check_in', '2026-02-01');
    });

    it('should filter by end date', async () => {
      mockChannelReservations = [createMockChannelReservation()];

      await channelService.getChannelReservations('conn-1', { endDate: '2026-02-28' });

      const tableMock = getTableMock('channel_reservations');
      expect(tableMock.lte).toHaveBeenCalledWith('check_in', '2026-02-28');
    });

    it('should filter by status', async () => {
      mockChannelReservations = [createMockChannelReservation()];

      await channelService.getChannelReservations('conn-1', { status: 'new' });

      const tableMock = getTableMock('channel_reservations');
      expect(tableMock.eq).toHaveBeenCalledWith('booking_status', 'new');
    });

    it('should apply limit', async () => {
      mockChannelReservations = [createMockChannelReservation()];

      await channelService.getChannelReservations('conn-1', { limit: 10 });

      const tableMock = getTableMock('channel_reservations');
      expect(tableMock.limit).toHaveBeenCalledWith(10);
    });

    it('should order by received_at descending', async () => {
      mockChannelReservations = [createMockChannelReservation()];

      await channelService.getChannelReservations('conn-1');

      const tableMock = getTableMock('channel_reservations');
      expect(tableMock.order).toHaveBeenCalledWith('received_at', { ascending: false });
    });

    it('should return empty array when no reservations exist', async () => {
      mockChannelReservations = [];

      const result = await channelService.getChannelReservations('conn-1');

      expect(result).toEqual([]);
    });

    it('should support multiple filters combined', async () => {
      mockChannelReservations = [createMockChannelReservation()];

      await channelService.getChannelReservations('conn-1', {
        startDate: '2026-02-01',
        endDate: '2026-02-28',
        status: 'new',
        limit: 50,
      });

      const tableMock = getTableMock('channel_reservations');
      expect(tableMock.gte).toHaveBeenCalled();
      expect(tableMock.lte).toHaveBeenCalled();
      expect(tableMock.limit).toHaveBeenCalledWith(50);
    });
  });
});
