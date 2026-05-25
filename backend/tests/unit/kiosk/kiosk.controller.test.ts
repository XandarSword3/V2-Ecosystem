import { createMockReqRes, createChainableMock } from '../utils';

// Mock the kiosk service
vi.mock('../../../src/modules/kiosk/kiosk.service', () => ({
  kioskService: {
    registerDevice: vi.fn(),
    getDevice: vi.fn(),
    getPropertyDevices: vi.fn(),
    updateDeviceStatus: vi.fn(),
    updateDeviceConfig: vi.fn(),
    setMaintenanceMode: vi.fn(),
    heartbeat: vi.fn(),
    startCheckinSession: vi.fn(),
    getSessionStatus: vi.fn(),
    processCheckinPayment: vi.fn(),
    completeCheckin: vi.fn(),
    scanDocument: vi.fn(),
    captureSignature: vi.fn(),
    encodeKey: vi.fn(),
    getPropertyConfig: vi.fn(),
    updatePropertyConfig: vi.fn(),
  }
}));

import * as kioskController from '../../../src/modules/kiosk/kiosk.controller';
import { kioskService } from '../../../src/modules/kiosk/kiosk.service';

describe('Kiosk Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerDevice', () => {
    it('should register a new kiosk device', async () => {
      const mockDevice = { id: 'device-1', property_id: 'prop-1', name: 'Lobby Kiosk' };
      vi.mocked(kioskService.registerDevice).mockResolvedValue(mockDevice);

      const { req, res, next } = createMockReqRes({
        params: { propertyId: 'prop-1' },
        body: { name: 'Lobby Kiosk', location: 'Main Lobby' }
      });

      await kioskController.registerDevice(req, res, next);

      expect(kioskService.registerDevice).toHaveBeenCalledWith('prop-1', req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockDevice,
        message: 'Kiosk device registered'
      });
    });

    it('should call next on error', async () => {
      const error = new Error('Registration failed');
      vi.mocked(kioskService.registerDevice).mockRejectedValue(error);

      const { req, res, next } = createMockReqRes({
        params: { propertyId: 'prop-1' },
        body: {}
      });

      await kioskController.registerDevice(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getDevice', () => {
    it('should return device by id', async () => {
      const mockDevice = { id: 'device-1', name: 'Kiosk 1', status: 'online' };
      vi.mocked(kioskService.getDevice).mockResolvedValue(mockDevice);

      const { req, res, next } = createMockReqRes({
        params: { deviceId: 'device-1' }
      });

      await kioskController.getDevice(req, res, next);

      expect(kioskService.getDevice).toHaveBeenCalledWith('device-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockDevice
      });
    });

    it('should return 404 for non-existent device', async () => {
      vi.mocked(kioskService.getDevice).mockResolvedValue(null);

      const { req, res, next } = createMockReqRes({
        params: { deviceId: 'invalid-id' }
      });

      await kioskController.getDevice(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Device not found'
      });
    });
  });

  describe('getPropertyDevices', () => {
    it('should return all devices for a property', async () => {
      const mockDevices = [
        { id: 'device-1', name: 'Kiosk 1' },
        { id: 'device-2', name: 'Kiosk 2' }
      ];
      vi.mocked(kioskService.getPropertyDevices).mockResolvedValue(mockDevices);

      const { req, res, next } = createMockReqRes({
        params: { propertyId: 'prop-1' },
        query: { includeInactive: 'false' }
      });

      await kioskController.getPropertyDevices(req, res, next);

      expect(kioskService.getPropertyDevices).toHaveBeenCalledWith('prop-1', false);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockDevices,
        count: 2
      });
    });

    it('should include inactive devices when requested', async () => {
      vi.mocked(kioskService.getPropertyDevices).mockResolvedValue([]);

      const { req, res, next } = createMockReqRes({
        params: { propertyId: 'prop-1' },
        query: { includeInactive: 'true' }
      });

      await kioskController.getPropertyDevices(req, res, next);

      expect(kioskService.getPropertyDevices).toHaveBeenCalledWith('prop-1', true);
    });
  });

  describe('updateDeviceStatus', () => {
    it('should update device status', async () => {
      vi.mocked(kioskService.updateDeviceStatus).mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        params: { deviceId: 'device-1' },
        body: { status: 'offline', error: 'Network disconnected' }
      });

      await kioskController.updateDeviceStatus(req, res, next);

      expect(kioskService.updateDeviceStatus).toHaveBeenCalledWith('device-1', 'offline', 'Network disconnected');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Device status updated'
      });
    });
  });

  describe('updateDeviceConfig', () => {
    it('should update device configuration', async () => {
      vi.mocked(kioskService.updateDeviceConfig).mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        params: { deviceId: 'device-1' },
        body: { theme: 'dark', language: 'en' }
      });

      await kioskController.updateDeviceConfig(req, res, next);

      expect(kioskService.updateDeviceConfig).toHaveBeenCalledWith('device-1', req.body);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Device configuration updated'
      });
    });
  });
});
