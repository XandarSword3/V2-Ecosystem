import { createMockReqRes } from '../utils';

// Mock the groups service
vi.mock('../../../src/modules/groups/groups.service', () => ({
  groupBookingService: {
    createGroupReservation: vi.fn(),
    getGroupReservations: vi.fn(),
    getGroupById: vi.fn(),
    updateGroupReservation: vi.fn(),
    cancelGroupReservation: vi.fn(),
    addRoomBlock: vi.fn(),
    addRoomBlocksForDateRange: vi.fn(),
    releaseRoomBlock: vi.fn(),
    addGroupBooking: vi.fn(),
    importRoomingList: vi.fn(),
    cancelGroupBooking: vi.fn(),
    addGroupEvent: vi.fn(),
    updateGroupEvent: vi.fn(),
    generateContract: vi.fn(),
    signContract: vi.fn(),
    createInvoice: vi.fn(),
    recordPayment: vi.fn(),
    getActivityLog: vi.fn(),
    processAutomaticCutoffs: vi.fn(),
    getUpcomingCutoffs: vi.fn(),
  }
}));

vi.mock('../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

import * as groupsController from '../../../src/modules/groups/groups.controller';
import { groupBookingService } from '../../../src/modules/groups/groups.service';

describe('Groups Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createGroupReservation', () => {
    it('should create a group reservation', async () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Smith Wedding',
        property_id: 'prop-1',
        status: 'tentative',
        rooms_blocked: 25
      };
      vi.mocked(groupBookingService.createGroupReservation).mockResolvedValue(mockGroup);

      const { req, res, next } = createMockReqRes({
        params: { propertyId: 'prop-1' },
        body: {
          name: 'Smith Wedding',
          contactName: 'John Smith',
          contactEmail: 'john@example.com',
          startDate: '2024-06-15',
          endDate: '2024-06-17',
          roomsNeeded: 25
        },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await groupsController.createGroupReservation(req, res, next);

      expect(groupBookingService.createGroupReservation).toHaveBeenCalledWith(
        'prop-1',
        req.body,
        'user-1'
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockGroup,
        message: 'Group reservation created successfully'
      });
    });

    it('should call next on error', async () => {
      const error = new Error('Insufficient rooms');
      vi.mocked(groupBookingService.createGroupReservation).mockRejectedValue(error);

      const { req, res, next } = createMockReqRes({
        params: { propertyId: 'prop-1' },
        body: { name: 'Test Group' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await groupsController.createGroupReservation(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getGroupReservations', () => {
    it('should return group reservations with filters', async () => {
      const mockGroups = [
        { id: 'group-1', name: 'Smith Wedding', status: 'confirmed' },
        { id: 'group-2', name: 'Tech Conference', status: 'tentative' }
      ];
      vi.mocked(groupBookingService.getGroupReservations).mockResolvedValue(mockGroups);

      const { req, res, next } = createMockReqRes({
        params: { propertyId: 'prop-1' },
        query: {
          status: 'confirmed,tentative',
          startDate: '2024-06-01',
          endDate: '2024-06-30'
        }
      });

      await groupsController.getGroupReservations(req, res, next);

      expect(groupBookingService.getGroupReservations).toHaveBeenCalledWith('prop-1', {
        status: ['confirmed', 'tentative'],
        startDate: expect.any(Date),
        endDate: expect.any(Date),
        assignedTo: undefined,
        search: undefined
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockGroups,
        count: 2
      });
    });
  });

  describe('getGroupById', () => {
    it('should return a specific group', async () => {
      const mockGroup = {
        id: 'group-1',
        name: 'Smith Wedding',
        contact: { name: 'John Smith', email: 'john@example.com' },
        rooms: []
      };
      vi.mocked(groupBookingService.getGroupById).mockResolvedValue(mockGroup);

      const { req, res, next } = createMockReqRes({
        params: { groupId: 'group-1' }
      });

      await groupsController.getGroupById(req, res, next);

      expect(groupBookingService.getGroupById).toHaveBeenCalledWith('group-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockGroup
      });
    });

    it('should return 404 for non-existent group', async () => {
      vi.mocked(groupBookingService.getGroupById).mockResolvedValue(null);

      const { req, res, next } = createMockReqRes({
        params: { groupId: 'invalid' }
      });

      await groupsController.getGroupById(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Group not found'
      });
    });
  });

  describe('updateGroupReservation', () => {
    it('should update a group reservation', async () => {
      vi.mocked(groupBookingService.updateGroupReservation).mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        params: { groupId: 'group-1' },
        body: { name: 'Updated Name', status: 'confirmed' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await groupsController.updateGroupReservation(req, res, next);

      expect(groupBookingService.updateGroupReservation).toHaveBeenCalledWith(
        'group-1',
        req.body,
        'user-1'
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Group reservation updated successfully'
      });
    });
  });

  describe('cancelGroupReservation', () => {
    it('should cancel a group reservation', async () => {
      vi.mocked(groupBookingService.cancelGroupReservation).mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        params: { groupId: 'group-1' },
        body: { reason: 'Event cancelled', cancellationFee: 500 },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await groupsController.cancelGroupReservation(req, res, next);

      expect(groupBookingService.cancelGroupReservation).toHaveBeenCalledWith(
        'group-1',
        'Event cancelled',
        500,
        'user-1'
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Group reservation cancelled'
      });
    });
  });

  describe('addRoomBlock', () => {
    it('should add room blocks to a group', async () => {
      vi.mocked(groupBookingService.addRoomBlock).mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        params: { groupId: 'group-1' },
        body: { 
          blocks: [{ roomTypeId: 'rt-1', quantity: 5, date: '2024-06-15' }]
        },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await groupsController.addRoomBlock(req, res, next);

      expect(groupBookingService.addRoomBlock).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Room blocks added successfully'
      });
    });
  });

  describe('recordPayment', () => {
    it('should record a group payment', async () => {
      const mockPayment = {
        id: 'payment-1',
        amount: 5000,
        method: 'credit_card'
      };
      vi.mocked(groupBookingService.recordPayment).mockResolvedValue(mockPayment);

      const { req, res, next } = createMockReqRes({
        params: { groupId: 'group-1' },
        body: { amount: 5000, method: 'credit_card', reference: 'TXN123' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await groupsController.recordPayment(req, res, next);

      expect(groupBookingService.recordPayment).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });
});
