
let mockGroupReservations: Array<Record<string, unknown>> = [];
let mockGroupActivities: Array<Record<string, unknown>> = [];
let mockGroupRoomBlocks: Array<Record<string, unknown>> = [];
let mockGroupBookings: Array<Record<string, unknown>> = [];
let mockGroupEvents: Array<Record<string, unknown>> = [];
let mockGroupContracts: Array<Record<string, unknown>> = [];
let mockGroupInvoices: Array<Record<string, unknown>> = [];
let mockGroupPayments: Array<Record<string, unknown>> = [];

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
    then: (resolve: (value: { data: unknown; error: unknown }) => void) => {
      resolve({ data: insertData, error: null });
      return Promise.resolve({ data: insertData, error: null });
    }
  }));
  mockObj.upsert = vi.fn().mockImplementation((data) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { id: 'upsert-1', ...data }, error: null })
    }),
    then: (resolve: (value: { data: unknown; error: unknown }) => void) => {
      resolve({ data, error: null });
      return Promise.resolve({ data, error: null });
    }
  }));
  const updateChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is', 'not', 'or', 'in'].forEach(method => {
    updateChain[method] = vi.fn().mockReturnValue(updateChain);
  });
  updateChain.select = vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({ data: { id: 'item-1' }, error: null })
  });
  updateChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => {
    resolve({ data: null, error: null });
    return Promise.resolve({ data: null, error: null });
  };
  mockObj.update = vi.fn().mockReturnValue(updateChain);
  
  const deleteChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'lte', 'gte', 'not', 'is', 'or', 'in'].forEach(method => {
    deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
  });
  deleteChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => {
    resolve({ data: null, error: null });
    return Promise.resolve({ data: null, error: null });
  };
  mockObj.delete = vi.fn().mockReturnValue(deleteChain);
  return mockObj;
}

const mockSupabase = {
  from: vi.fn((table: string) => {
    switch (table) {
      case 'group_reservations':
        return createQueryMock(() => mockGroupReservations);
      case 'group_activities':
        return createQueryMock(() => mockGroupActivities);
      case 'group_room_blocks':
        return createQueryMock(() => mockGroupRoomBlocks);
      case 'group_bookings':
        return createQueryMock(() => mockGroupBookings);
      case 'group_events':
        return createQueryMock(() => mockGroupEvents);
      case 'group_contracts':
        return createQueryMock(() => mockGroupContracts);
      case 'group_invoices':
        return createQueryMock(() => mockGroupInvoices);
      case 'group_payments':
        return createQueryMock(() => mockGroupPayments);
      default:
        return createQueryMock(() => []);
    }
  })
};

vi.mock('../../../../src/database/connection', () => ({
  getSupabase: vi.fn(() => mockSupabase),
}));

vi.mock('../../../../src/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

import { groupBookingService, GroupBookingService } from '../../../../src/modules/groups/groups.service';

describe('GroupBookingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGroupReservations = [];
    mockGroupActivities = [];
    mockGroupRoomBlocks = [];
    mockGroupBookings = [];
    mockGroupEvents = [];
    mockGroupContracts = [];
    mockGroupInvoices = [];
    mockGroupPayments = [];
  });

  describe('service instance', () => {
    it('should export a singleton instance', () => {
      expect(groupBookingService).toBeDefined();
      expect(groupBookingService).toBeInstanceOf(GroupBookingService);
    });
  });

  // =============================================
  // GROUP RESERVATIONS
  // =============================================

  describe('createGroupReservation', () => {
    it('should create a group reservation with all required fields', async () => {
      const propertyId = 'property-1';
      const reservationData = {
        groupName: 'Corporate Retreat 2026',
        groupType: 'corporate',
        organizerName: 'John Smith',
        organizerEmail: 'john@company.com',
        organizerPhone: '+1234567890',
        companyName: 'Tech Corp',
        arrivalDate: new Date('2026-03-15'),
        departureDate: new Date('2026-03-18'),
        totalRooms: 25,
        negotiatedRate: 150,
        specialRequests: 'Late checkout preferred'
      };

      const result = await groupBookingService.createGroupReservation(propertyId, reservationData, 'user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('group_reservations');
      expect(result).toBeDefined();
      expect(result.id).toBe('new-1');
    });

    it('should generate a unique group code', async () => {
      const result = await groupBookingService.createGroupReservation('property-1', {
        groupName: 'Wedding Party',
        groupType: 'wedding',
        arrivalDate: new Date('2026-06-01'),
        departureDate: new Date('2026-06-03'),
        totalRooms: 15
      });

      expect(result.groupCode).toBeDefined();
      expect(result.groupCode).toMatch(/^GRP\d{8}[A-F0-9]{4}$/);
    });

    it('should set initial status to inquiry', async () => {
      const result = await groupBookingService.createGroupReservation('property-1', {
        groupName: 'Tour Group',
        groupType: 'tour',
        arrivalDate: new Date('2026-04-01'),
        departureDate: new Date('2026-04-05'),
        totalRooms: 30
      });

      expect(result.status).toBe('inquiry');
    });

    it('should log activity after creation', async () => {
      await groupBookingService.createGroupReservation('property-1', {
        groupName: 'Sports Team',
        groupType: 'sports',
        arrivalDate: new Date('2026-05-01'),
        departureDate: new Date('2026-05-03'),
        totalRooms: 20
      }, 'user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('group_activities');
    });
  });

  describe('getGroupReservations', () => {
    beforeEach(() => {
      mockGroupReservations = [
        {
          id: 'group-1',
          property_id: 'property-1',
          group_name: 'Corporate Event',
          group_code: 'GRP202603011234',
          group_type: 'corporate',
          status: 'confirmed',
          arrival_date: '2026-03-15',
          departure_date: '2026-03-18',
          total_rooms: 25,
          confirmed_rooms: 20,
          created_at: '2026-02-01',
          updated_at: '2026-02-01'
        },
        {
          id: 'group-2',
          property_id: 'property-1',
          group_name: 'Wedding Smith',
          group_code: 'GRP202606015678',
          group_type: 'wedding',
          status: 'inquiry',
          arrival_date: '2026-06-01',
          departure_date: '2026-06-03',
          total_rooms: 15,
          confirmed_rooms: 0,
          created_at: '2026-02-05',
          updated_at: '2026-02-05'
        }
      ];
    });

    it('should return all group reservations for a property', async () => {
      const result = await groupBookingService.getGroupReservations('property-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('group_reservations');
      expect(result).toHaveLength(2);
      expect(result[0].groupName).toBe('Corporate Event');
      expect(result[1].groupName).toBe('Wedding Smith');
    });

    it('should filter by status', async () => {
      const result = await groupBookingService.getGroupReservations('property-1', {
        status: ['confirmed']
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('group_reservations');
      expect(result).toBeDefined();
    });

    it('should filter by date range', async () => {
      const result = await groupBookingService.getGroupReservations('property-1', {
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-31')
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('group_reservations');
      expect(result).toBeDefined();
    });

    it('should filter by assigned staff', async () => {
      const result = await groupBookingService.getGroupReservations('property-1', {
        assignedTo: 'staff-1'
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('group_reservations');
      expect(result).toBeDefined();
    });

    it('should search by group name, code, or company', async () => {
      const result = await groupBookingService.getGroupReservations('property-1', {
        search: 'Corporate'
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('group_reservations');
      expect(result).toBeDefined();
    });
  });

  describe('getGroupById', () => {
    it('should return a group reservation by ID', async () => {
      mockGroupReservations = [{
        id: 'group-1',
        property_id: 'property-1',
        group_name: 'Corporate Event',
        group_code: 'GRP202603011234',
        group_type: 'corporate',
        status: 'confirmed',
        arrival_date: '2026-03-15',
        departure_date: '2026-03-18',
        total_rooms: 25,
        confirmed_rooms: 20,
        created_at: '2026-02-01',
        updated_at: '2026-02-01'
      }];

      const result = await groupBookingService.getGroupById('group-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('group_reservations');
      expect(result).toBeDefined();
      expect(result?.id).toBe('group-1');
      expect(result?.groupName).toBe('Corporate Event');
    });

    it('should return null for non-existent group', async () => {
      mockGroupReservations = [];

      const result = await groupBookingService.getGroupById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('updateGroupReservation', () => {
    it('should update group reservation fields', async () => {
      await groupBookingService.updateGroupReservation('group-1', {
        groupName: 'Updated Corporate Event',
        status: 'confirmed',
        totalRooms: 30
      }, 'user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('group_reservations');
    });

    it('should update organizer details', async () => {
      await groupBookingService.updateGroupReservation('group-1', {
        organizerName: 'Jane Doe',
        organizerEmail: 'jane@company.com',
        organizerPhone: '+1987654321'
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('group_reservations');
    });

    it('should log activity after update', async () => {
      await groupBookingService.updateGroupReservation('group-1', {
        notes: 'VIP group - priority handling'
      }, 'user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('group_activities');
    });
  });

  describe('cancelGroupReservation', () => {
    it('should cancel a group reservation with reason and fee', async () => {
      await groupBookingService.cancelGroupReservation('group-1', 'Client request', 500, 'user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('group_reservations');
    });

    it('should release all room blocks on cancellation', async () => {
      await groupBookingService.cancelGroupReservation('group-1', 'Force majeure', 0, 'user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('group_room_blocks');
    });

    it('should log cancellation activity', async () => {
      await groupBookingService.cancelGroupReservation('group-1', 'Budget constraints', 250, 'user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('group_activities');
    });
  });

  // =============================================
  // ROOM BLOCKS
  // =============================================

  describe('addRoomBlock', () => {
    it('should add room blocks for a group', async () => {
      const blocks = [
        { roomTypeId: 'room-type-1', date: new Date('2026-03-15'), count: 10, rate: 150 },
        { roomTypeId: 'room-type-1', date: new Date('2026-03-16'), count: 10, rate: 150 },
        { roomTypeId: 'room-type-2', date: new Date('2026-03-15'), count: 5, rate: 200 }
      ];

      await groupBookingService.addRoomBlock('group-1', blocks, 'user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('group_room_blocks');
    });

    it('should update group room count after adding blocks', async () => {
      mockGroupRoomBlocks = [{ picked_up: 5 }, { picked_up: 3 }];

      await groupBookingService.addRoomBlock('group-1', [
        { roomTypeId: 'room-type-1', date: new Date('2026-03-15'), count: 10, rate: 150 }
      ]);

      expect(mockSupabase.from).toHaveBeenCalledWith('group_reservations');
    });

    it('should log activity after adding blocks', async () => {
      await groupBookingService.addRoomBlock('group-1', [
        { roomTypeId: 'room-type-1', date: new Date('2026-03-15'), count: 10, rate: 150 }
      ], 'user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('group_activities');
    });
  });

  describe('addRoomBlocksForDateRange', () => {
    it('should create blocks for each day in range', async () => {
      const startDate = new Date('2026-03-15');
      const endDate = new Date('2026-03-18');

      const blocksCreated = await groupBookingService.addRoomBlocksForDateRange(
        'group-1',
        'room-type-1',
        startDate,
        endDate,
        10,
        150,
        'user-1'
      );

      // 3 days: March 15, 16, 17 (end date exclusive)
      expect(blocksCreated).toBe(3);
    });

    it('should use consistent rate for all blocks', async () => {
      await groupBookingService.addRoomBlocksForDateRange(
        'group-1',
        'room-type-1',
        new Date('2026-03-15'),
        new Date('2026-03-17'),
        5,
        175
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('group_room_blocks');
    });
  });

  describe('releaseRoomBlock', () => {
    beforeEach(() => {
      mockGroupRoomBlocks = [{
        id: 'block-1',
        group_id: 'group-1',
        blocked_count: 10,
        picked_up: 3
      }];
    });

    it('should release a room block with reason', async () => {
      await groupBookingService.releaseRoomBlock('block-1', 'Past cutoff date', 'user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('group_room_blocks');
    });

    it('should calculate released count correctly', async () => {
      // blocked_count (10) - picked_up (3) = 7 rooms released
      await groupBookingService.releaseRoomBlock('block-1', 'Manual release');

      expect(mockSupabase.from).toHaveBeenCalledWith('group_room_blocks');
    });

    it('should throw error if block not found', async () => {
      mockGroupRoomBlocks = [];

      await expect(
        groupBookingService.releaseRoomBlock('non-existent', 'Test')
      ).rejects.toThrow('Room block not found');
    });

    it('should log release activity', async () => {
      await groupBookingService.releaseRoomBlock('block-1', 'No pickup', 'user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('group_activities');
    });
  });

  // =============================================
  // GROUP BOOKINGS (INDIVIDUAL GUESTS)
  // =============================================

  describe('addGroupBooking', () => {
    it('should add an individual guest booking to a group', async () => {
      const guestData = {
        guestName: 'Alice Johnson',
        guestEmail: 'alice@email.com',
        guestPhone: '+1555123456',
        roomTypeId: 'room-type-1',
        checkIn: new Date('2026-03-15'),
        checkOut: new Date('2026-03-18'),
        specialRequests: 'High floor preferred'
      };

      const result = await groupBookingService.addGroupBooking('group-1', guestData, 'user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('group_bookings');
      expect(result).toBeDefined();
      expect(result.id).toBe('new-1');
    });

    it('should set booking status to confirmed', async () => {
      const result = await groupBookingService.addGroupBooking('group-1', {
        guestName: 'Bob Wilson',
        checkIn: new Date('2026-03-15'),
        checkOut: new Date('2026-03-17')
      });

      expect(result.status).toBe('confirmed');
    });

    it('should update group room count after adding booking', async () => {
      await groupBookingService.addGroupBooking('group-1', {
        guestName: 'Carol Davis',
        checkIn: new Date('2026-03-15'),
        checkOut: new Date('2026-03-18')
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('group_reservations');
    });
  });

  describe('importRoomingList', () => {
    it('should import multiple guests at once', async () => {
      const guests = [
        { guestName: 'Guest 1', checkIn: new Date('2026-03-15'), checkOut: new Date('2026-03-18') },
        { guestName: 'Guest 2', checkIn: new Date('2026-03-15'), checkOut: new Date('2026-03-18') },
        { guestName: 'Guest 3', checkIn: new Date('2026-03-15'), checkOut: new Date('2026-03-18') }
      ];

      const result = await groupBookingService.importRoomingList('group-1', guests, 'user-1');

      expect(result.imported).toBe(3);
      expect(result.errors).toHaveLength(0);
    });

    it('should track errors for failed imports', async () => {
      const guests = [
        { guestName: 'Valid Guest', checkIn: new Date('2026-03-15'), checkOut: new Date('2026-03-18') }
      ];

      const result = await groupBookingService.importRoomingList('group-1', guests, 'user-1');

      expect(result).toBeDefined();
      expect(typeof result.imported).toBe('number');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should log import activity', async () => {
      await groupBookingService.importRoomingList('group-1', [
        { guestName: 'Test Guest', checkIn: new Date('2026-03-15'), checkOut: new Date('2026-03-18') }
      ], 'user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('group_activities');
    });
  });

  describe('cancelGroupBooking', () => {
    beforeEach(() => {
      mockGroupBookings = [{
        id: 'booking-1',
        group_id: 'group-1',
        guest_name: 'John Doe'
      }];
    });

    it('should cancel a guest booking with reason', async () => {
      await groupBookingService.cancelGroupBooking('booking-1', 'Guest cancelled', 'user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('group_bookings');
    });

    it('should throw error if booking not found', async () => {
      mockGroupBookings = [];

      await expect(
        groupBookingService.cancelGroupBooking('non-existent', 'Test')
      ).rejects.toThrow('Booking not found');
    });

    it('should update group room count after cancellation', async () => {
      await groupBookingService.cancelGroupBooking('booking-1', 'No show');

      expect(mockSupabase.from).toHaveBeenCalledWith('group_reservations');
    });
  });

  // =============================================
  // GROUP EVENTS
  // =============================================

  describe('addGroupEvent', () => {
    it('should add an event to a group', async () => {
      const eventData = {
        eventName: 'Welcome Reception',
        eventType: 'reception',
        venueId: 'venue-1',
        startTime: new Date('2026-03-15T18:00:00'),
        endTime: new Date('2026-03-15T21:00:00'),
        attendees: 50,
        cateringRequired: true,
        estimatedCost: 5000
      };

      const result = await groupBookingService.addGroupEvent('group-1', eventData, 'user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('group_events');
      expect(result).toBeDefined();
      expect(result.id).toBe('new-1');
    });

    it('should set initial status to scheduled', async () => {
      const result = await groupBookingService.addGroupEvent('group-1', {
        eventName: 'Meeting',
        eventType: 'meeting',
        startTime: new Date('2026-03-16T09:00:00'),
        endTime: new Date('2026-03-16T12:00:00')
      });

      expect(result.status).toBe('scheduled');
    });

    it('should handle equipment needs array', async () => {
      await groupBookingService.addGroupEvent('group-1', {
        eventName: 'Conference',
        eventType: 'conference',
        startTime: new Date('2026-03-16T09:00:00'),
        endTime: new Date('2026-03-16T17:00:00'),
        equipmentNeeds: ['projector', 'microphone', 'whiteboard']
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('group_events');
    });

    it('should log event creation activity', async () => {
      await groupBookingService.addGroupEvent('group-1', {
        eventName: 'Banquet',
        eventType: 'banquet',
        startTime: new Date('2026-03-17T19:00:00'),
        endTime: new Date('2026-03-17T23:00:00')
      }, 'user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('group_activities');
    });
  });

  describe('updateGroupEvent', () => {
    it('should update event details', async () => {
      await groupBookingService.updateGroupEvent('event-1', {
        eventName: 'Updated Welcome Reception',
        attendees: 75,
        estimatedCost: 7500
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('group_events');
    });

    it('should update event timing', async () => {
      await groupBookingService.updateGroupEvent('event-1', {
        startTime: new Date('2026-03-15T19:00:00'),
        endTime: new Date('2026-03-15T22:00:00')
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('group_events');
    });

    it('should update event status', async () => {
      await groupBookingService.updateGroupEvent('event-1', {
        status: 'completed'
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('group_events');
    });
  });

  // =============================================
  // CONTRACTS
  // =============================================

  describe('generateContract', () => {
    it('should generate a contract with terms', async () => {
      const terms = {
        depositRequired: 5000,
        paymentSchedule: ['50% at signing', '50% before arrival'],
        cancellationPolicy: 'Full refund if cancelled 30 days before arrival',
        specialConditions: ['Late checkout included', 'Complimentary breakfast']
      };

      const result = await groupBookingService.generateContract('group-1', terms, 'user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('group_contracts');
      expect(result).toBeDefined();
      expect(result.id).toBe('new-1');
    });

    it('should generate a unique contract number', async () => {
      const result = await groupBookingService.generateContract('group-1', { terms: 'standard' });

      expect(result.contractNumber).toBeDefined();
      expect(result.contractNumber).toMatch(/^CTR-\d{8}-[A-F0-9]{4}$/);
    });

    it('should set initial status to draft', async () => {
      const result = await groupBookingService.generateContract('group-1', {});

      expect(result.status).toBe('draft');
    });

    it('should log contract generation activity', async () => {
      await groupBookingService.generateContract('group-1', {}, 'user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('group_activities');
    });
  });

  describe('markContractSigned', () => {
    beforeEach(() => {
      mockGroupContracts = [{
        id: 'contract-1',
        group_id: 'group-1'
      }];
    });

    it('should mark contract as signed', async () => {
      await groupBookingService.markContractSigned('contract-1', 'John Smith', 'user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('group_contracts');
    });

    it('should update group status to confirmed after signing', async () => {
      await groupBookingService.markContractSigned('contract-1', 'Jane Doe');

      expect(mockSupabase.from).toHaveBeenCalledWith('group_reservations');
    });

    it('should throw error if contract not found', async () => {
      mockGroupContracts = [];

      await expect(
        groupBookingService.markContractSigned('non-existent', 'Test')
      ).rejects.toThrow('Contract not found');
    });

    it('should log signing activity', async () => {
      await groupBookingService.markContractSigned('contract-1', 'CEO', 'user-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('group_activities');
    });
  });

  // =============================================
  // INVOICES & PAYMENTS
  // =============================================

  describe('createInvoice', () => {
    it('should create an invoice with line items', async () => {
      const lineItems = [
        { description: 'Room charges (25 rooms x 3 nights)', quantity: 75, unitPrice: 150, taxRate: 10 },
        { description: 'Welcome reception', quantity: 1, unitPrice: 5000, taxRate: 10 },
        { description: 'Conference room rental', quantity: 2, unitPrice: 500, taxRate: 10 }
      ];

      const result = await groupBookingService.createInvoice(
        'group-1',
        'accommodation',
        lineItems,
        new Date('2026-03-01'),
        'Payment due before arrival',
        'user-1'
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('group_invoices');
      expect(result).toBeDefined();
      expect(result.id).toBe('new-1');
    });

    it('should calculate subtotal, tax, and total correctly', async () => {
      const lineItems = [
        { description: 'Item 1', quantity: 10, unitPrice: 100, taxRate: 10 }
      ];
      // Subtotal: 1000, Tax: 100, Total: 1100

      const result = await groupBookingService.createInvoice(
        'group-1',
        'deposit',
        lineItems,
        new Date('2026-02-15')
      );

      expect(result).toBeDefined();
    });

    it('should generate a unique invoice number', async () => {
      const result = await groupBookingService.createInvoice(
        'group-1',
        'final',
        [{ description: 'Total', quantity: 1, unitPrice: 1000 }],
        new Date('2026-03-20')
      );

      expect(result.invoiceNumber).toBeDefined();
      expect(result.invoiceNumber).toMatch(/^INV-\d{8}-[A-F0-9]{5}$/);
    });

    it('should set initial status to draft', async () => {
      const result = await groupBookingService.createInvoice(
        'group-1',
        'deposit',
        [{ description: 'Deposit', quantity: 1, unitPrice: 5000 }],
        new Date('2026-02-15')
      );

      expect(result.status).toBe('draft');
    });

    it('should log invoice creation activity', async () => {
      await groupBookingService.createInvoice(
        'group-1',
        'proforma',
        [{ description: 'Estimated total', quantity: 1, unitPrice: 20000 }],
        new Date('2026-02-01'),
        undefined,
        'user-1'
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('group_activities');
    });
  });

  describe('recordPayment', () => {
    it('should record a payment for a group', async () => {
      const result = await groupBookingService.recordPayment(
        'group-1',
        5000,
        'credit_card',
        'invoice-1',
        'REF-123456',
        'user-1'
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('group_payments');
      expect(result).toBeDefined();
      expect(result.id).toBe('new-1');
    });

    it('should update invoice paid amount when invoice specified', async () => {
      mockGroupInvoices = [{
        id: 'invoice-1',
        paid_amount: 0,
        total_amount: 10000
      }];

      await groupBookingService.recordPayment(
        'group-1',
        5000,
        'bank_transfer',
        'invoice-1'
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('group_invoices');
    });

    it('should handle payment without invoice', async () => {
      const result = await groupBookingService.recordPayment(
        'group-1',
        1000,
        'cash'
      );

      expect(result).toBeDefined();
      expect(result.amount).toBe(1000);
    });

    it('should log payment activity', async () => {
      await groupBookingService.recordPayment(
        'group-1',
        2500,
        'check',
        undefined,
        'CHECK-001',
        'user-1'
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('group_activities');
    });
  });

  // =============================================
  // ACTIVITY LOG
  // =============================================

  describe('getActivityLog', () => {
    beforeEach(() => {
      mockGroupActivities = [
        {
          id: 'activity-1',
          group_id: 'group-1',
          activity_type: 'created',
          description: 'Group reservation created',
          performed_by: 'user-1',
          created_at: '2026-02-01T10:00:00'
        },
        {
          id: 'activity-2',
          group_id: 'group-1',
          activity_type: 'updated',
          description: 'Group reservation updated',
          performed_by: 'user-1',
          created_at: '2026-02-02T14:30:00'
        },
        {
          id: 'activity-3',
          group_id: 'group-1',
          activity_type: 'payment_received',
          description: 'Payment received: $5000',
          performed_by: 'user-2',
          created_at: '2026-02-03T09:15:00'
        }
      ];
    });

    it('should return activity log for a group', async () => {
      const result = await groupBookingService.getActivityLog('group-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('group_activities');
      expect(result).toHaveLength(3);
    });

    it('should respect limit parameter', async () => {
      const result = await groupBookingService.getActivityLog('group-1', 10);

      expect(mockSupabase.from).toHaveBeenCalledWith('group_activities');
      expect(result).toBeDefined();
    });

    it('should return activities in descending order by created_at', async () => {
      const result = await groupBookingService.getActivityLog('group-1');

      expect(result[0].activityType).toBe('created');
    });

    it('should map activity fields correctly', async () => {
      const result = await groupBookingService.getActivityLog('group-1');

      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('groupId');
      expect(result[0]).toHaveProperty('activityType');
      expect(result[0]).toHaveProperty('description');
      expect(result[0]).toHaveProperty('performedBy');
      expect(result[0]).toHaveProperty('createdAt');
    });
  });

  // =============================================
  // CUTOFF MANAGEMENT
  // =============================================

  describe('processAutomaticCutoffs', () => {
    it('should process groups past cutoff date', async () => {
      mockGroupReservations = [
        { id: 'group-1' },
        { id: 'group-2' }
      ];
      mockGroupRoomBlocks = [
        { id: 'block-1', group_id: 'group-1', blocked_count: 10, picked_up: 5 },
        { id: 'block-2', group_id: 'group-2', blocked_count: 8, picked_up: 8 }
      ];

      const released = await groupBookingService.processAutomaticCutoffs();

      expect(mockSupabase.from).toHaveBeenCalledWith('group_reservations');
      expect(mockSupabase.from).toHaveBeenCalledWith('group_room_blocks');
      expect(typeof released).toBe('number');
    });

    it('should return 0 when no groups past cutoff', async () => {
      mockGroupReservations = [];

      const released = await groupBookingService.processAutomaticCutoffs();

      expect(released).toBe(0);
    });

    it('should log auto-release activity for each block', async () => {
      mockGroupReservations = [{ id: 'group-1' }];
      mockGroupRoomBlocks = [
        { id: 'block-1', group_id: 'group-1', blocked_count: 10, picked_up: 3 }
      ];

      await groupBookingService.processAutomaticCutoffs();

      expect(mockSupabase.from).toHaveBeenCalledWith('group_activities');
    });
  });

  describe('getUpcomingCutoffs', () => {
    beforeEach(() => {
      mockGroupReservations = [
        {
          id: 'group-1',
          group_name: 'Corporate Event',
          group_code: 'GRP001',
          cutoff_date: '2026-02-20',
          total_rooms: 25,
          confirmed_rooms: 20
        },
        {
          id: 'group-2',
          group_name: 'Wedding Party',
          group_code: 'GRP002',
          cutoff_date: '2026-02-15',
          total_rooms: 15,
          confirmed_rooms: 10
        }
      ];
    });

    it('should return groups with upcoming cutoffs', async () => {
      const result = await groupBookingService.getUpcomingCutoffs('property-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('group_reservations');
      expect(result).toHaveLength(2);
    });

    it('should calculate rooms at risk', async () => {
      const result = await groupBookingService.getUpcomingCutoffs('property-1');

      // group-1: 25 total - 20 confirmed = 5 at risk
      expect(result[0].roomsAtRisk).toBe(5);
      // group-2: 15 total - 10 confirmed = 5 at risk
      expect(result[1].roomsAtRisk).toBe(5);
    });

    it('should accept custom days ahead parameter', async () => {
      const result = await groupBookingService.getUpcomingCutoffs('property-1', 7);

      expect(mockSupabase.from).toHaveBeenCalledWith('group_reservations');
      expect(result).toBeDefined();
    });

    it('should map fields correctly', async () => {
      const result = await groupBookingService.getUpcomingCutoffs('property-1');

      expect(result[0]).toHaveProperty('groupId');
      expect(result[0]).toHaveProperty('groupName');
      expect(result[0]).toHaveProperty('groupCode');
      expect(result[0]).toHaveProperty('cutoffDate');
      expect(result[0]).toHaveProperty('totalRooms');
      expect(result[0]).toHaveProperty('confirmedRooms');
      expect(result[0]).toHaveProperty('roomsAtRisk');
    });
  });
});
