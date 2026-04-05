import { describe, it, expect, vi, beforeEach } from 'vitest';

// Storage for mock data
let mockExportRequests: Array<Record<string, unknown>> = [];
let mockDeletionRequests: Array<Record<string, unknown>> = [];
let mockConsents: Array<Record<string, unknown>> = [];
let mockRetentionPolicies: Array<Record<string, unknown>> = [];
let mockProcessingLogs: Array<Record<string, unknown>> = [];
let mockDataSharingLogs: Array<Record<string, unknown>> = [];
let mockUsers: Array<Record<string, unknown>> = [];

// Create a chainable query mock
function createQueryMock(mockDataFn: () => unknown[]) {
  const mockObj: Record<string, unknown> = {};
  
  const chainMethods = ['select', 'eq', 'is', 'or', 'order', 'gte', 'lte', 'gt', 'lt', 'limit', 'neq', 'not', 'in'];
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
    return Promise.resolve({ 
      data: firstItem, 
      error: firstItem ? null : { code: 'PGRST116' }
    });
  });
  
  mockObj.maybeSingle = vi.fn().mockImplementation(() => {
    const data = mockDataFn();
    const firstItem = Array.isArray(data) && data.length > 0 ? data[0] : null;
    return Promise.resolve({ data: firstItem, error: null });
  });
  
  mockObj.insert = vi.fn().mockImplementation((insertData) => {
    const insertResult = {
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ 
          data: Array.isArray(insertData) 
            ? insertData.map((d: unknown, i: number) => ({ id: `new-item-${i}`, ...(d as object) }))
            : { id: 'new-request-1', ...insertData }, 
          error: null 
        })
      }),
      then: (resolve: (value: { data: unknown; error: unknown }) => void) => {
        resolve({ data: insertData, error: null });
        return Promise.resolve({ data: insertData, error: null });
      }
    };
    return insertResult;
  });

  mockObj.upsert = vi.fn().mockImplementation((data) => {
    return {
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'upsert-1', ...data }, error: null })
      }),
      then: (resolve: (value: { data: unknown; error: unknown }) => void) => {
        resolve({ data, error: null });
        return Promise.resolve({ data, error: null });
      }
    };
  });
  
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
      case 'gdpr_export_requests':
        return createQueryMock(() => mockExportRequests);
      case 'gdpr_deletion_requests':
        return createQueryMock(() => mockDeletionRequests);
      case 'gdpr_consents':
        return createQueryMock(() => mockConsents);
      case 'gdpr_retention_policies':
        return createQueryMock(() => mockRetentionPolicies);
      case 'gdpr_processing_activities':
        return createQueryMock(() => mockProcessingLogs);
      case 'gdpr_data_sharing_log':
        return createQueryMock(() => mockDataSharingLogs);
      case 'users':
        return createQueryMock(() => mockUsers);
      default:
        return createQueryMock(() => []);
    }
  }),
  storage: {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: { path: 'exports/file.zip' }, error: null }),
      download: vi.fn().mockResolvedValue({ data: Buffer.from('test'), error: null }),
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  },
};

// Mock database connection
vi.mock('../../../../src/database/connection', () => ({
  getSupabase: vi.fn(() => mockSupabase),
}));

vi.mock('../../../../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../../src/utils/activityLogger', () => ({
  activityLogger: {
    log: vi.fn().mockResolvedValue(undefined),
    logActivity: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../../../src/services/email.service', () => ({
  emailService: {
    sendEmail: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('../../../../src/config/index', () => ({
  config: {
    frontendUrl: 'https://example.com',
    gdpr: {
      exportExpiryDays: 7
    }
  }
}));

import * as gdprService from '../../../../src/modules/gdpr/gdpr.service';

describe('GDPRService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExportRequests = [];
    mockDeletionRequests = [];
    mockConsents = [];
    mockRetentionPolicies = [];
    mockProcessingLogs = [];
    mockDataSharingLogs = [];
    mockUsers = [];
  });

  // ============================================
  // DATA EXPORT
  // ============================================

  describe('requestDataExport', () => {
    it('should create a data export request', async () => {
      mockUsers = [{ id: 'user-1', email: 'test@example.com', full_name: 'Test User' }];

      const result = await gdprService.requestDataExport('user-1', 'user-1');

      expect(result).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('gdpr_export_requests');
    });

    it('should create export request for admin requesting on behalf of user', async () => {
      mockUsers = [{ id: 'user-2', email: 'user@example.com', full_name: 'User' }];

      const result = await gdprService.requestDataExport('user-2', 'admin-1');

      expect(result).toBeDefined();
    });
  });

  describe('getExportRequests', () => {
    it('should return export requests for user', async () => {
      mockExportRequests = [
        { id: 'req-1', user_id: 'user-1', status: 'pending', created_at: new Date().toISOString() }
      ];

      const requests = await gdprService.getExportRequests('user-1');

      expect(requests).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('gdpr_export_requests');
    });
  });

  // ============================================
  // DATA DELETION
  // ============================================

  describe('requestDataDeletion', () => {
    it('should create a deletion request', async () => {
      mockUsers = [{ id: 'user-1', email: 'test@example.com' }];

      const result = await gdprService.requestDataDeletion('user-1', 'personal', 'I want my data deleted');

      expect(result).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('gdpr_deletion_requests');
    });
  });

  describe('getDeletionRequests', () => {
    it('should return all deletion requests when no user specified', async () => {
      mockDeletionRequests = [
        { id: 'del-1', user_id: 'user-1', status: 'pending' },
        { id: 'del-2', user_id: 'user-2', status: 'approved' }
      ];

      const requests = await gdprService.getDeletionRequests();

      expect(requests).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('gdpr_deletion_requests');
    });

    it('should return deletion requests for specific user', async () => {
      mockDeletionRequests = [
        { id: 'del-1', user_id: 'user-1', status: 'pending' }
      ];

      const requests = await gdprService.getDeletionRequests('user-1');

      expect(requests).toBeDefined();
    });
  });

  describe('approveDeletionRequest', () => {
    it('should approve a deletion request', async () => {
      mockDeletionRequests = [
        { id: 'del-1', user_id: 'user-1', status: 'pending' }
      ];

      await gdprService.approveDeletionRequest('del-1', 'admin-1', 'Approved as requested');

      expect(mockSupabase.from).toHaveBeenCalledWith('gdpr_deletion_requests');
    });
  });

  describe('rejectDeletionRequest', () => {
    it('should reject a deletion request', async () => {
      mockDeletionRequests = [
        { id: 'del-1', user_id: 'user-1', status: 'pending' }
      ];

      await gdprService.rejectDeletionRequest('del-1', 'admin-1', 'Cannot delete due to legal requirements');

      expect(mockSupabase.from).toHaveBeenCalledWith('gdpr_deletion_requests');
    });
  });

  // ============================================
  // CONSENT MANAGEMENT
  // ============================================

  describe('getConsents', () => {
    it('should return consents for user', async () => {
      mockConsents = [
        { id: 'consent-1', user_id: 'user-1', consent_type: 'marketing', granted: true },
        { id: 'consent-2', user_id: 'user-1', consent_type: 'analytics', granted: false }
      ];

      const consents = await gdprService.getConsents('user-1');

      expect(consents).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('gdpr_consents');
    });
  });

  describe('updateConsent', () => {
    it('should update consent for a specific type', async () => {
      await gdprService.updateConsent('user-1', 'marketing', true);

      expect(mockSupabase.from).toHaveBeenCalledWith('gdpr_consents');
    });

    it('should revoke consent when granted is false', async () => {
      mockConsents = [{ id: 'consent-1', user_id: 'user-1', consent_type: 'marketing', granted: true }];

      await gdprService.updateConsent('user-1', 'marketing', false);

      expect(mockSupabase.from).toHaveBeenCalledWith('gdpr_consents');
    });
  });

  describe('updateMultipleConsents', () => {
    it('should update multiple consent types at once', async () => {
      const consents = [
        { type: 'marketing', granted: true },
        { type: 'analytics', granted: false },
        { type: 'third_party', granted: true }
      ];

      await gdprService.updateMultipleConsents('user-1', consents);

      expect(mockSupabase.from).toHaveBeenCalledWith('gdpr_consents');
    });
  });

  describe('hasConsent', () => {
    it('should return true when user has granted consent', async () => {
      mockConsents = [
        { id: 'consent-1', user_id: 'user-1', consent_type: 'marketing', granted: true }
      ];

      const result = await gdprService.hasConsent('user-1', 'marketing');

      expect(mockSupabase.from).toHaveBeenCalledWith('gdpr_consents');
    });

    it('should return false when consent not found', async () => {
      mockConsents = [];

      const result = await gdprService.hasConsent('user-1', 'marketing');

      expect(mockSupabase.from).toHaveBeenCalledWith('gdpr_consents');
    });
  });

  // ============================================
  // RETENTION POLICIES
  // ============================================

  describe('getRetentionPolicies', () => {
    it('should return all retention policies', async () => {
      mockRetentionPolicies = [
        { category: 'bookings', retention_days: 365 },
        { category: 'logs', retention_days: 90 }
      ];

      const policies = await gdprService.getRetentionPolicies();

      expect(policies).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('gdpr_retention_policies');
    });
  });

  describe('updateRetentionPolicy', () => {
    it('should update a retention policy', async () => {
      await gdprService.updateRetentionPolicy('bookings', 730);

      expect(mockSupabase.from).toHaveBeenCalledWith('gdpr_retention_policies');
    });
  });

  // ============================================
  // PROCESSING LOGS
  // ============================================

  describe('logProcessingActivity', () => {
    it('should log a processing activity', async () => {
      await gdprService.logProcessingActivity('user-1', 'data_access', 'User profile viewed', 'admin-1');

      expect(mockSupabase.from).toHaveBeenCalledWith('gdpr_processing_activities');
    });
  });

  describe('getProcessingLog', () => {
    it('should return processing logs for user', async () => {
      mockProcessingLogs = [
        { id: 'log-1', user_id: 'user-1', activity_type: 'data_access', timestamp: new Date().toISOString() }
      ];

      const startDate = new Date('2026-01-01');
      const endDate = new Date('2026-12-31');

      const logs = await gdprService.getProcessingLog('user-1', startDate, endDate);

      expect(logs).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('gdpr_processing_activities');
    });
  });

  // ============================================
  // DATA SHARING
  // ============================================

  describe('logDataSharing', () => {
    it('should log data sharing activity', async () => {
      await gdprService.logDataSharing('user-1', 'Partner Company', 'booking_data', 'Contract fulfillment');

      expect(mockSupabase.from).toHaveBeenCalledWith('gdpr_data_sharing_log');
    });
  });

  describe('getDataSharingLog', () => {
    it('should return data sharing logs for user', async () => {
      mockDataSharingLogs = [
        { id: 'share-1', user_id: 'user-1', recipient: 'Partner', data_types: 'contact_info' }
      ];

      const logs = await gdprService.getDataSharingLog('user-1');

      expect(logs).toBeDefined();
      expect(mockSupabase.from).toHaveBeenCalledWith('gdpr_data_sharing_log');
    });
  });

  // ============================================
  // CLEANUP
  // ============================================

  describe('cleanupExpiredExports', () => {
    it('should remove expired export files', async () => {
      mockExportRequests = [
        { id: 'req-1', status: 'completed', file_path: 'exports/old-file.zip', expires_at: '2024-01-01T00:00:00Z' }
      ];

      const count = await gdprService.cleanupExpiredExports();

      expect(typeof count).toBe('number');
      expect(mockSupabase.from).toHaveBeenCalledWith('gdpr_export_requests');
    });
  });
});
