import { createMockReqRes } from '../utils';

// Mock the parity service
vi.mock('../../../src/modules/parity/parity.service.js', () => ({
  getParityConfig: vi.fn(),
  createOrUpdateParityConfig: vi.fn(),
  runParityCheck: vi.fn(),
  runFullParityCheck: vi.fn(),
  getCheckHistory: vi.fn(),
  getAlerts: vi.fn(),
  acknowledgeAlert: vi.fn(),
  resolveAlert: vi.fn(),
  ignoreAlert: vi.fn(),
  getDashboard: vi.fn(),
}));

import * as parityController from '../../../src/modules/parity/parity.controller';
import * as parityService from '../../../src/modules/parity/parity.service.js';

describe('Parity Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getConfig', () => {
    it('should return parity configuration', async () => {
      const mockConfig = {
        is_enabled: true,
        check_frequency: 'hourly',
        tolerance_percent: 2
      };
      vi.mocked(parityService.getParityConfig).mockResolvedValue(mockConfig);

      const { req, res } = createMockReqRes({
        params: { propertyId: 'prop-1' }
      });

      await parityController.getConfig(req, res);

      expect(parityService.getParityConfig).toHaveBeenCalledWith('prop-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        config: mockConfig
      });
    });

    it('should return default config if not configured', async () => {
      vi.mocked(parityService.getParityConfig).mockResolvedValue(null);

      const { req, res } = createMockReqRes({
        params: { propertyId: 'prop-1' }
      });

      await parityController.getConfig(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        config: {
          is_enabled: false,
          message: 'Rate parity monitoring not configured for this property'
        }
      });
    });

    it('should handle errors', async () => {
      vi.mocked(parityService.getParityConfig).mockRejectedValue(new Error('DB error'));

      const { req, res } = createMockReqRes({
        params: { propertyId: 'prop-1' }
      });

      await parityController.getConfig(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'DB error' });
    });
  });

  describe('updateConfig', () => {
    it('should update parity configuration', async () => {
      const mockUpdatedConfig = {
        is_enabled: true,
        check_frequency: 'daily',
        tolerance_percent: 5
      };
      vi.mocked(parityService.createOrUpdateParityConfig).mockResolvedValue(mockUpdatedConfig);

      const { req, res } = createMockReqRes({
        params: { propertyId: 'prop-1' },
        body: { is_enabled: true, check_frequency: 'daily', tolerance_percent: 5 }
      });

      await parityController.updateConfig(req, res);

      expect(parityService.createOrUpdateParityConfig).toHaveBeenCalledWith('prop-1', req.body);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Configuration updated',
        config: mockUpdatedConfig
      });
    });
  });

  describe('runCheck', () => {
    it('should run a parity check', async () => {
      const mockCheck = {
        id: 'check-1',
        property_id: 'prop-1',
        room_type_id: 'rt-1',
        date: '2024-06-15',
        our_rate: 199,
        competitor_rates: [
          { source: 'booking.com', rate: 195 },
          { source: 'expedia', rate: 199 }
        ],
        violation: true
      };
      vi.mocked(parityService.runParityCheck).mockResolvedValue(mockCheck);

      const { req, res } = createMockReqRes({
        params: { propertyId: 'prop-1' },
        body: { room_type_id: 'rt-1', date: '2024-06-15', rate: 199 }
      });

      await parityController.runCheck(req, res);

      expect(parityService.runParityCheck).toHaveBeenCalledWith('prop-1', 'rt-1', '2024-06-15', 199);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        check: mockCheck
      });
    });

    it('should return 400 if required fields missing', async () => {
      const { req, res } = createMockReqRes({
        params: { propertyId: 'prop-1' },
        body: { room_type_id: 'rt-1' }  // missing date and rate
      });

      await parityController.runCheck(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'room_type_id, date, and rate are required' });
    });
  });

  describe('runFullCheck', () => {
    it('should run a full parity check', async () => {
      const mockResult = {
        checks: 50,
        violations: 3,
        details: []
      };
      vi.mocked(parityService.runFullParityCheck).mockResolvedValue(mockResult);

      const { req, res } = createMockReqRes({
        params: { propertyId: 'prop-1' }
      });

      await parityController.runFullCheck(req, res);

      expect(parityService.runFullParityCheck).toHaveBeenCalledWith('prop-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Completed 50 checks with 3 violations',
        result: mockResult
      });
    });
  });

  describe('getCheckHistory', () => {
    it('should return check history with date range', async () => {
      const mockHistory = [
        { id: 'check-1', date: '2024-06-14', violations: 1 },
        { id: 'check-2', date: '2024-06-15', violations: 0 }
      ];
      vi.mocked(parityService.getCheckHistory).mockResolvedValue(mockHistory);

      const { req, res } = createMockReqRes({
        params: { propertyId: 'prop-1' },
        query: { start_date: '2024-06-01', end_date: '2024-06-30' }
      });

      await parityController.getCheckHistory(req, res);

      expect(parityService.getCheckHistory).toHaveBeenCalledWith('prop-1', '2024-06-01', '2024-06-30');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        history: mockHistory
      });
    });

    it('should use default date range if not provided', async () => {
      vi.mocked(parityService.getCheckHistory).mockResolvedValue([]);

      const { req, res } = createMockReqRes({
        params: { propertyId: 'prop-1' },
        query: {}
      });

      await parityController.getCheckHistory(req, res);

      expect(parityService.getCheckHistory).toHaveBeenCalled();
      // Should use 30 days ago as default start date
    });
  });

  describe('getAlerts', () => {
    it('should return alerts list', async () => {
      const mockAlerts = [
        { id: 'a-1', room_type: 'Deluxe', source: 'booking.com', difference: -10 },
        { id: 'a-2', room_type: 'Suite', source: 'expedia', difference: -15 }
      ];
      vi.mocked(parityService.getAlerts).mockResolvedValue(mockAlerts);

      const { req, res } = createMockReqRes({
        params: { propertyId: 'prop-1' },
        query: { status: 'unresolved' }
      });

      await parityController.getAlerts(req, res);

      expect(parityService.getAlerts).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        alerts: mockAlerts
      });
    });
  });

  describe('acknowledgeAlert', () => {
    it('should acknowledge an alert', async () => {
      vi.mocked(parityService.acknowledgeAlert).mockResolvedValue(undefined);

      const { req, res } = createMockReqRes({
        params: { alertId: 'a-1' },
        user: { id: 'user-1', role: 'admin', userId: 'user-1' }
      });

      await parityController.acknowledgeAlert(req, res);

      expect(parityService.acknowledgeAlert).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Alert acknowledged'
      });
    });
  });
});
