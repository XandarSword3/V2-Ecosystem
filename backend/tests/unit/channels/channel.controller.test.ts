import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockReqRes } from '../utils';

// Mock the channel service
vi.mock('../../../src/modules/channels/channel.service.js', () => ({
  CHANNELS: {
    BOOKING: { code: 'booking', name: 'Booking.com' },
    EXPEDIA: { code: 'expedia', name: 'Expedia' },
    AIRBNB: { code: 'airbnb', name: 'Airbnb' }
  },
  getConnections: vi.fn(),
  getConnection: vi.fn(),
  createConnection: vi.fn(),
  activateConnection: vi.fn(),
  deactivateConnection: vi.fn(),
  deleteConnection: vi.fn(),
  getRoomMappings: vi.fn(),
  getRateMappings: vi.fn(),
  createRoomMapping: vi.fn(),
  createRateMapping: vi.fn(),
  deleteRoomMapping: vi.fn(),
  deleteRateMapping: vi.fn(),
  getSyncLog: vi.fn(),
  syncInventory: vi.fn(),
  syncRates: vi.fn(),
  processIncomingReservation: vi.fn(),
  sendOutgoingReservation: vi.fn(),
}));

import * as channelController from '../../../src/modules/channels/channel.controller';
import * as channelService from '../../../src/modules/channels/channel.service.js';

describe('Channel Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getConnections', () => {
    it('should return all connections for a property', async () => {
      const mockConnections = [
        { id: 'conn-1', channel_code: 'booking', status: 'active' },
        { id: 'conn-2', channel_code: 'expedia', status: 'active' }
      ];
      vi.mocked(channelService.getConnections).mockResolvedValue(mockConnections);

      const { req, res } = createMockReqRes({
        params: { propertyId: 'prop-1' }
      });

      await channelController.getConnections(req, res);

      expect(channelService.getConnections).toHaveBeenCalledWith('prop-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        connections: mockConnections,
        available_channels: Object.values(channelService.CHANNELS)
      });
    });

    it('should return 400 if property ID is missing', async () => {
      const { req, res } = createMockReqRes({
        params: {}
      });

      await channelController.getConnections(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Property ID is required' });
    });

    it('should handle errors', async () => {
      vi.mocked(channelService.getConnections).mockRejectedValue(new Error('DB error'));

      const { req, res } = createMockReqRes({
        params: { propertyId: 'prop-1' }
      });

      await channelController.getConnections(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'DB error' });
    });
  });

  describe('getConnection', () => {
    it('should return connection with mappings and activity', async () => {
      const mockConnection = { id: 'conn-1', channel_code: 'booking' };
      const mockRoomMappings = [{ id: 'rm-1', local_room: 'Standard' }];
      const mockRateMappings = [{ id: 'rate-1', local_rate: 'BAR' }];
      const mockSyncLog = [{ id: 'log-1', action: 'sync_rates' }];

      vi.mocked(channelService.getConnection).mockResolvedValue(mockConnection);
      vi.mocked(channelService.getRoomMappings).mockResolvedValue(mockRoomMappings);
      vi.mocked(channelService.getRateMappings).mockResolvedValue(mockRateMappings);
      vi.mocked(channelService.getSyncLog).mockResolvedValue(mockSyncLog);

      const { req, res } = createMockReqRes({
        params: { connectionId: 'conn-1' }
      });

      await channelController.getConnection(req, res);

      expect(channelService.getConnection).toHaveBeenCalledWith('conn-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        connection: mockConnection,
        room_mappings: mockRoomMappings,
        rate_mappings: mockRateMappings,
        recent_activity: mockSyncLog
      });
    });

    it('should return 404 for non-existent connection', async () => {
      vi.mocked(channelService.getConnection).mockResolvedValue(null);

      const { req, res } = createMockReqRes({
        params: { connectionId: 'invalid' }
      });

      await channelController.getConnection(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Connection not found' });
    });
  });

  describe('createConnection', () => {
    it('should create a new channel connection', async () => {
      const mockConnection = {
        id: 'conn-new',
        channel_code: 'booking',
        property_id: 'prop-1',
        status: 'pending'
      };
      vi.mocked(channelService.createConnection).mockResolvedValue(mockConnection);

      const { req, res } = createMockReqRes({
        params: { propertyId: 'prop-1' },
        body: {
          channel_code: 'booking',
          hotel_code: 'HOTEL123',
          siteminder_property_id: 'SM456'
        }
      });

      await channelController.createConnection(req, res);

      expect(channelService.createConnection).toHaveBeenCalledWith(
        'prop-1',
        'booking',
        'HOTEL123',
        'SM456'
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Channel connection created',
        connection: mockConnection
      });
    });

    it('should return 400 if channel code is missing', async () => {
      const { req, res } = createMockReqRes({
        params: { propertyId: 'prop-1' },
        body: {}
      });

      await channelController.createConnection(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Channel code is required' });
    });
  });

  describe('activateConnection', () => {
    it('should activate a connection', async () => {
      vi.mocked(channelService.activateConnection).mockResolvedValue(undefined);

      const { req, res } = createMockReqRes({
        params: { connectionId: 'conn-1' }
      });

      await channelController.activateConnection(req, res);

      expect(channelService.activateConnection).toHaveBeenCalledWith('conn-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Connection activated successfully'
      });
    });
  });
});
