import { createMockReqRes } from '../utils';

// Mock the gdpr service
vi.mock('../../../src/modules/gdpr/gdpr.service.js', () => ({
  requestDataExport: vi.fn(),
  processExportRequest: vi.fn(),
  getExportRequests: vi.fn(),
  getExportFile: vi.fn(),
  requestDataDeletion: vi.fn(),
  getDeletionRequests: vi.fn(),
  approveDeletionRequest: vi.fn(),
  rejectDeletionRequest: vi.fn(),
  getConsents: vi.fn(),
  updateConsent: vi.fn(),
  updateMultipleConsents: vi.fn(),
  getRetentionPolicies: vi.fn(),
  updateRetentionPolicy: vi.fn(),
  getProcessingLog: vi.fn(),
  getDataSharingLog: vi.fn(),
  triggerRetentionCleanup: vi.fn(),
  cleanupExpiredExports: vi.fn(),
}));

import * as gdprController from '../../../src/modules/gdpr/gdpr.controller';
import * as gdprService from '../../../src/modules/gdpr/gdpr.service.js';

describe('GDPR Controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requestExport', () => {
    it('should create an export request', async () => {
      const mockRequest = {
        id: 'export-1',
        user_id: 'user-1',
        status: 'pending'
      };
      vi.mocked(gdprService.requestDataExport).mockResolvedValue(mockRequest);
      vi.mocked(gdprService.processExportRequest).mockResolvedValue(undefined);

      const { req, res } = createMockReqRes({
        user: { id: 'user-1', role: 'user', userId: 'user-1' }
      });
      (req as any).user.email = 'user@example.com';
      (req as any).ip = '192.168.1.1';
      req.headers = { 'user-agent': 'TestBrowser/1.0' };

      await gdprController.requestExport(req, res);

      expect(gdprService.requestDataExport).toHaveBeenCalledWith(
        'user-1',
        'user@example.com',
        '192.168.1.1',
        'TestBrowser/1.0'
      );
      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Export request submitted. You will receive a notification when ready.',
        request_id: 'export-1',
        status: 'pending'
      });
    });

    it('should return 401 if not authenticated', async () => {
      const { req, res } = createMockReqRes();
      req.user = undefined;

      await gdprController.requestExport(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });
  });

  describe('getExportStatus', () => {
    it('should return export requests for user', async () => {
      const mockRequests = [
        { id: 'export-1', status: 'completed' },
        { id: 'export-2', status: 'pending' }
      ];
      vi.mocked(gdprService.getExportRequests).mockResolvedValue(mockRequests);

      const { req, res } = createMockReqRes({
        user: { id: 'user-1', role: 'user', userId: 'user-1' }
      });

      await gdprController.getExportStatus(req, res);

      expect(gdprService.getExportRequests).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        requests: mockRequests
      });
    });

    it('should return 401 if not authenticated', async () => {
      const { req, res } = createMockReqRes();
      req.user = undefined;

      await gdprController.getExportStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('downloadExport', () => {
    it('should download export file', async () => {
      const mockFileContent = Buffer.from('test export data');
      vi.mocked(gdprService.getExportFile).mockResolvedValue(mockFileContent);

      const { req, res } = createMockReqRes({
        params: { requestId: 'export-1' },
        user: { id: 'user-1', role: 'user', userId: 'user-1' }
      });

      await gdprController.downloadExport(req, res);

      expect(gdprService.getExportFile).toHaveBeenCalledWith('export-1', 'user-1');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/zip');
      expect(res.send).toHaveBeenCalledWith(mockFileContent);
    });

    it('should return 404 for non-existent export', async () => {
      vi.mocked(gdprService.getExportFile).mockResolvedValue(null);

      const { req, res } = createMockReqRes({
        params: { requestId: 'invalid' },
        user: { id: 'user-1', role: 'user', userId: 'user-1' }
      });

      await gdprController.downloadExport(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Export not found or expired' });
    });
  });

  describe('requestDeletion', () => {
    it('should create a deletion request', async () => {
      const mockRequest = {
        id: 'delete-1',
        user_id: 'user-1',
        status: 'pending'
      };
      vi.mocked(gdprService.requestDataDeletion).mockResolvedValue(mockRequest);

      const { req, res } = createMockReqRes({
        user: { id: 'user-1', role: 'user', userId: 'user-1' },
        body: { reason: 'Moving to competitor', categories: ['profile', 'bookings'] }
      });
      (req as any).user.email = 'user@example.com';
      (req as any).ip = '192.168.1.1';
      req.headers = { 'user-agent': 'TestBrowser/1.0' };

      await gdprController.requestDeletion(req, res);

      expect(gdprService.requestDataDeletion).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(202);
    });

    it('should return 400 if reason is missing', async () => {
      const { req, res } = createMockReqRes({
        user: { id: 'user-1', role: 'user', userId: 'user-1' },
        body: {}
      });
      (req as any).user.email = 'user@example.com';

      await gdprController.requestDeletion(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Reason is required for deletion request' });
    });
  });

  describe('getConsents', () => {
    it('should return user consent settings', async () => {
      const mockConsents = [
        { consent_type: 'marketing', granted: true },
        { consent_type: 'analytics', granted: false }
      ];
      vi.mocked(gdprService.getConsents).mockResolvedValue(mockConsents);

      const { req, res } = createMockReqRes({
        user: { id: 'user-1', role: 'user', userId: 'user-1' }
      });

      await gdprController.getConsents(req, res);

      expect(gdprService.getConsents).toHaveBeenCalledWith('user-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        consents: { marketing: true, analytics: false },
        details: mockConsents
      });
    });
  });

  describe('updateConsent', () => {
    it('should update user consent', async () => {
      const mockConsent = {
        consent_type: 'marketing',
        granted: false
      };
      vi.mocked(gdprService.updateConsent).mockResolvedValue(mockConsent);

      const { req, res } = createMockReqRes({
        user: { id: 'user-1', role: 'user', userId: 'user-1' },
        body: { consent_type: 'marketing', granted: false }
      });
      (req as any).ip = '192.168.1.1';
      req.headers = { 'user-agent': 'TestBrowser/1.0' };

      await gdprController.updateConsent(req, res);

      expect(gdprService.updateConsent).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Consent withdrawn successfully',
        consent: mockConsent
      });
    });
  });
});
