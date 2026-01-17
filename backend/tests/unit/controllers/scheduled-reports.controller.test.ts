import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockReqRes } from '../utils';

// Mock dependencies
vi.mock('../../../src/services/scheduled-reports.service.js', () => ({
  scheduledReportsService: {
    listReports: vi.fn(),
    createReport: vi.fn(),
    updateReport: vi.fn(),
    deleteReport: vi.fn(),
    runReport: vi.fn()
  }
}));

vi.mock('../../../src/utils/activityLogger.js', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

import { scheduledReportsService } from '../../../src/services/scheduled-reports.service.js';
import {
  getScheduledReports,
  createScheduledReport,
  updateScheduledReport,
  deleteScheduledReport
} from '../../../src/modules/admin/controllers/scheduled-reports.controller';

describe('ScheduledReportsController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getScheduledReports', () => {
    it('should return all scheduled reports', async () => {
      const mockReports = [
        { id: 'report-1', name: 'Daily Revenue', type: 'daily', reportType: 'revenue' },
        { id: 'report-2', name: 'Weekly Overview', type: 'weekly', reportType: 'overview' }
      ];

      vi.mocked(scheduledReportsService.listReports).mockResolvedValue(mockReports);

      const { req, res, next } = createMockReqRes();
      await getScheduledReports(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockReports
      });
    });

    it('should handle errors', async () => {
      vi.mocked(scheduledReportsService.listReports).mockRejectedValue(new Error('Database error'));

      const { req, res, next } = createMockReqRes();
      await getScheduledReports(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('createScheduledReport', () => {
    it('should create scheduled report successfully', async () => {
      const mockReport = { id: 'report-1', name: 'Daily Revenue', type: 'daily', reportType: 'revenue' };

      vi.mocked(scheduledReportsService.createReport).mockResolvedValue(mockReport);

      const { req, res, next } = createMockReqRes({
        body: {
          name: 'Daily Revenue',
          type: 'daily',
          reportType: 'revenue',
          recipients: ['admin@example.com']
        },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await createScheduledReport(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockReport
      });
    });

    it('should require name field', async () => {
      const { req, res, next } = createMockReqRes({
        body: {
          type: 'daily',
          reportType: 'revenue',
          recipients: ['admin@example.com']
        }
      });

      await createScheduledReport(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('Missing required fields')
      }));
    });

    it('should require type field', async () => {
      const { req, res, next } = createMockReqRes({
        body: {
          name: 'Report',
          reportType: 'revenue',
          recipients: ['admin@example.com']
        }
      });

      await createScheduledReport(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should require reportType field', async () => {
      const { req, res, next } = createMockReqRes({
        body: {
          name: 'Report',
          type: 'daily',
          recipients: ['admin@example.com']
        }
      });

      await createScheduledReport(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should require recipients field', async () => {
      const { req, res, next } = createMockReqRes({
        body: {
          name: 'Report',
          type: 'daily',
          reportType: 'revenue'
        }
      });

      await createScheduledReport(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should validate type enum', async () => {
      const { req, res, next } = createMockReqRes({
        body: {
          name: 'Report',
          type: 'invalid',
          reportType: 'revenue',
          recipients: ['admin@example.com']
        }
      });

      await createScheduledReport(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.stringContaining('Invalid type')
      }));
    });

    it('should validate reportType enum', async () => {
      const { req, res, next } = createMockReqRes({
        body: {
          name: 'Report',
          type: 'daily',
          reportType: 'invalid',
          recipients: ['admin@example.com']
        }
      });

      await createScheduledReport(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.stringContaining('Invalid reportType')
      }));
    });

    it('should handle service errors', async () => {
      vi.mocked(scheduledReportsService.createReport).mockRejectedValue(new Error('Creation failed'));

      const { req, res, next } = createMockReqRes({
        body: {
          name: 'Report',
          type: 'daily',
          reportType: 'revenue',
          recipients: ['admin@example.com']
        },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await createScheduledReport(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('updateScheduledReport', () => {
    it('should update scheduled report successfully', async () => {
      const mockReport = { id: 'report-1', name: 'Updated Report' };

      vi.mocked(scheduledReportsService.updateReport).mockResolvedValue(mockReport);

      const { req, res, next } = createMockReqRes({
        params: { id: 'report-1' },
        body: { name: 'Updated Report' },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await updateScheduledReport(req, res, next);

      expect(scheduledReportsService.updateReport).toHaveBeenCalledWith('report-1', { name: 'Updated Report' });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockReport
      });
    });

    it('should handle update errors', async () => {
      vi.mocked(scheduledReportsService.updateReport).mockRejectedValue(new Error('Not found'));

      const { req, res, next } = createMockReqRes({
        params: { id: 'non-existent' },
        body: { name: 'Test' },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await updateScheduledReport(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('deleteScheduledReport', () => {
    it('should delete scheduled report successfully', async () => {
      vi.mocked(scheduledReportsService.deleteReport).mockResolvedValue(undefined);

      const { req, res, next } = createMockReqRes({
        params: { id: 'report-1' },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await deleteScheduledReport(req, res, next);

      expect(scheduledReportsService.deleteReport).toHaveBeenCalledWith('report-1');
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Scheduled report deleted'
      });
    });

    it('should handle delete errors', async () => {
      vi.mocked(scheduledReportsService.deleteReport).mockRejectedValue(new Error('Delete failed'));

      const { req, res, next } = createMockReqRes({
        params: { id: 'report-1' },
        user: { id: 'admin-1', role: 'admin', userId: 'admin-1' }
      });

      await deleteScheduledReport(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });

});
