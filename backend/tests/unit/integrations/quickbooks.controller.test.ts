
// Create a properly chainable Supabase mock
const createChainableMock = () => {
  let responseQueue: Array<{ data: any; error: any; count?: number }> = [];
  let responseIndex = 0;

  const getNextResponse = () => {
    if (responseIndex < responseQueue.length) {
      return responseQueue[responseIndex++];
    }
    return { data: null, error: null };
  };

  const builder: any = {};
  
  const chainMethods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'like', 'ilike', 'is', 'in', 'or', 'not',
    'filter', 'match', 'order', 'limit', 'range',
  ];
  
  chainMethods.forEach(method => {
    builder[method] = vi.fn().mockImplementation(() => builder);
  });

  builder.single = vi.fn().mockImplementation(() => Promise.resolve(getNextResponse()));
  builder.maybeSingle = vi.fn().mockImplementation(() => Promise.resolve(getNextResponse()));
  builder.then = (resolve: any, reject: any) => Promise.resolve(getNextResponse()).then(resolve, reject);

  return {
    queueResponse: (data: any, error: any = null, count?: number) => {
      responseQueue.push({ data, error, count });
    },
    reset: () => {
      responseQueue = [];
      responseIndex = 0;
    },
    build: () => ({ from: vi.fn().mockReturnValue(builder) }),
  };
};

// Mock dependencies
vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

vi.mock('../../../src/modules/integrations/quickbooks/quickbooks.service.js', () => ({
  testConnection: vi.fn(),
  getAuthorizationUrl: vi.fn(),
  exchangeCodeForTokens: vi.fn(),
  getAccounts: vi.fn(),
  getSyncHistory: vi.fn(),
  syncDailySales: vi.fn(),
  createSalesReceipt: vi.fn(),
  REVENUE_CATEGORIES: {
    room_revenue: { name: 'Room Revenue', defaultAccount: '4000' },
    food_revenue: { name: 'Food Revenue', defaultAccount: '4100' },
  },
}));

import { getSupabase } from '../../../src/database/connection';
import * as quickbooksController from '../../../src/modules/integrations/quickbooks/quickbooks.controller';
import * as quickbooksService from '../../../src/modules/integrations/quickbooks/quickbooks.service.js';

function createMockReqRes(overrides: any = {}) {
  const req = {
    params: {},
    query: {},
    body: {},
    headers: {},
    user: { id: 'user-1', role: 'admin' },
    ...overrides,
  };
  const res = {
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    redirect: vi.fn().mockReturnThis(),
  };
  const next = vi.fn();
  return { req, res, next };
}

describe('QuickBooksController', () => {
  let mockBuilder: ReturnType<typeof createChainableMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockBuilder = createChainableMock();
    vi.mocked(getSupabase).mockReturnValue(mockBuilder.build());
  });

  describe('getConnectionStatus', () => {
    it('should return not connected when no connection exists', async () => {
      mockBuilder.queueResponse(null, { code: 'PGRST116' });

      const { req, res, next } = createMockReqRes({
        query: { propertyId: 'prop-1' },
      });

      await quickbooksController.getConnectionStatus(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith({
        connected: false,
        message: 'QuickBooks is not connected',
      });
    });

    it('should return connection status when connected', async () => {
      const mockConnection = {
        id: 'conn-1',
        realm_id: 'realm-123',
        is_active: true,
        sync_enabled: true,
        last_sync_at: '2024-01-15T10:00:00Z',
        last_sync_status: 'success',
        last_sync_error: null,
        settings: {},
        created_at: '2024-01-01T00:00:00Z',
      };
      mockBuilder.queueResponse(mockConnection);
      vi.mocked(quickbooksService.testConnection).mockResolvedValue({ success: true, companyName: 'Test Company' });

      const { req, res, next } = createMockReqRes({
        query: { propertyId: 'prop-1' },
      });

      await quickbooksController.getConnectionStatus(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        connected: true,
        connectionId: 'conn-1',
        companyId: 'realm-123',
        companyName: 'Test Company',
      }));
    });
  });

  describe('initiateConnection', () => {
    it('should return authorization URL', async () => {
      vi.mocked(quickbooksService.getAuthorizationUrl).mockReturnValue('https://oauth.qb.com/authorize?...');

      const { req, res, next } = createMockReqRes({
        body: { propertyId: 'prop-1' },
        user: { id: 'user-1' },
      });

      await quickbooksController.initiateConnection(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith({
        authorizationUrl: 'https://oauth.qb.com/authorize?...',
        message: 'Redirect user to this URL to connect QuickBooks',
      });
    });

    it('should return 400 if propertyId is missing', async () => {
      const { req, res, next } = createMockReqRes({
        body: {},
      });

      await quickbooksController.initiateConnection(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Property ID is required' });
    });
  });

  describe('handleCallback', () => {
    it('should return 400 if OAuth parameters are missing', async () => {
      const { req, res, next } = createMockReqRes({
        query: {},
      });

      await quickbooksController.handleCallback(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Missing required OAuth parameters' });
    });

    it('should return 400 for invalid state parameter', async () => {
      const { req, res, next } = createMockReqRes({
        query: {
          code: 'auth-code',
          realmId: 'realm-123',
          state: 'invalid-base64',
        },
      });

      await quickbooksController.handleCallback(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid state parameter' });
    });

    it('should process valid callback and create connection', async () => {
      const state = Buffer.from(JSON.stringify({
        propertyId: 'prop-1',
        userId: 'user-1',
        timestamp: Date.now(),
      })).toString('base64');

      vi.mocked(quickbooksService.exchangeCodeForTokens).mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(),
      });

      mockBuilder.queueResponse(null, { code: 'PGRST116' }); // No existing connection
      mockBuilder.queueResponse({ id: 'conn-new' }); // Insert new connection

      const { req, res, next } = createMockReqRes({
        query: {
          code: 'auth-code',
          realmId: 'realm-123',
          state,
        },
      });

      await quickbooksController.handleCallback(req as any, res as any, next);

      expect(res.redirect).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should disconnect QuickBooks integration', async () => {
      mockBuilder.queueResponse({ id: 'conn-1' });

      const { req, res, next } = createMockReqRes({
        params: { connectionId: 'conn-1' },
      });

      await quickbooksController.disconnect(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'QuickBooks disconnected successfully',
      });
    });
  });

  describe('getAccounts', () => {
    it('should return QuickBooks accounts', async () => {
      const mockAccounts = [
        { id: 'acc-1', name: 'Sales', classification: 'Revenue' },
        { id: 'acc-2', name: 'Expenses', classification: 'Expense' },
      ];
      vi.mocked(quickbooksService.getAccounts).mockResolvedValue(mockAccounts);

      const { req, res, next } = createMockReqRes({
        params: { connectionId: 'conn-1' },
      });

      await quickbooksController.getAccounts(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        accounts: mockAccounts,
      }));
    });
  });

  describe('getAccountMappings', () => {
    it('should return account mappings', async () => {
      const mockMappings = [
        { id: 'map-1', v2_category: 'room_revenue', qb_account_id: 'acc-1' },
      ];
      mockBuilder.queueResponse(mockMappings);

      const { req, res, next } = createMockReqRes({
        params: { connectionId: 'conn-1' },
      });

      await quickbooksController.getAccountMappings(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        mappings: mockMappings,
      }));
    });
  });

  describe('saveAccountMapping', () => {
    it('should save account mapping', async () => {
      const mockMapping = { id: 'map-1', v2_category: 'room_revenue' };
      mockBuilder.queueResponse(mockMapping);

      const { req, res, next } = createMockReqRes({
        params: { connectionId: 'conn-1' },
        body: {
          v2Category: 'room_revenue',
          qbAccountId: 'acc-1',
          qbAccountName: 'Sales',
          qbAccountType: 'Revenue',
        },
      });

      await quickbooksController.saveAccountMapping(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        mapping: mockMapping,
      });
    });

    it('should return 400 if required fields missing', async () => {
      const { req, res, next } = createMockReqRes({
        params: { connectionId: 'conn-1' },
        body: {},
      });

      await quickbooksController.saveAccountMapping(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('deleteAccountMapping', () => {
    it('should delete account mapping', async () => {
      mockBuilder.queueResponse({ id: 'map-1' });

      const { req, res, next } = createMockReqRes({
        params: { connectionId: 'conn-1', mappingId: 'map-1' },
      });

      await quickbooksController.deleteAccountMapping(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Mapping removed',
      });
    });
  });

  describe('triggerSync', () => {
    it('should trigger sales sync', async () => {
      vi.mocked(quickbooksService.syncDailySales).mockResolvedValue({
        success: true,
        synced: 10,
        failed: 0,
        errors: [],
      });

      const { req, res, next } = createMockReqRes({
        params: { connectionId: 'conn-1' },
        body: { syncType: 'sales', date: '2024-01-15' },
      });

      await quickbooksController.triggerSync(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        syncType: 'sales',
        recordsSynced: 10,
      }));
    });

    it('should return 400 for invalid sync type', async () => {
      const { req, res, next } = createMockReqRes({
        params: { connectionId: 'conn-1' },
        body: { syncType: 'invalid' },
      });

      await quickbooksController.triggerSync(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getSyncHistory', () => {
    it('should return sync history', async () => {
      const mockHistory = [
        { id: 'sync-1', status: 'success', synced_at: '2024-01-15T10:00:00Z' },
      ];
      vi.mocked(quickbooksService.getSyncHistory).mockResolvedValue(mockHistory);

      const { req, res, next } = createMockReqRes({
        params: { connectionId: 'conn-1' },
        query: { limit: '10' },
      });

      await quickbooksController.getSyncHistory(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith({
        history: mockHistory,
        total: 1,
      });
    });
  });

  describe('getPendingTransactions', () => {
    it('should return pending transactions', async () => {
      const mockTransactions = [
        { id: 'txn-1', sync_status: 'pending' },
        { id: 'txn-2', sync_status: 'failed' },
      ];
      mockBuilder.queueResponse(mockTransactions);

      const { req, res, next } = createMockReqRes({
        params: { connectionId: 'conn-1' },
      });

      await quickbooksController.getPendingTransactions(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith({
        transactions: mockTransactions,
        total: 2,
      });
    });
  });

  describe('retryTransaction', () => {
    it('should retry failed transaction', async () => {
      const mockTransaction = {
        id: 'txn-1',
        v2_transaction_id: 'pay-1',
        retry_count: 0,
      };
      const mockPayment = {
        id: 'pay-1',
        amount: '100.00',
        source_type: 'room_revenue',
        created_at: '2024-01-15T10:00:00Z',
        description: 'Room charge',
      };
      mockBuilder.queueResponse(mockTransaction);
      mockBuilder.queueResponse(mockPayment);
      vi.mocked(quickbooksService.createSalesReceipt).mockResolvedValue({ success: true });
      mockBuilder.queueResponse({ id: 'txn-1' }); // Update status

      const { req, res, next } = createMockReqRes({
        params: { connectionId: 'conn-1', transactionId: 'txn-1' },
      });

      await quickbooksController.retryTransaction(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Transaction synced successfully',
      });
    });

    it('should return 404 for non-existent transaction', async () => {
      mockBuilder.queueResponse(null, { code: 'PGRST116' });

      const { req, res, next } = createMockReqRes({
        params: { connectionId: 'conn-1', transactionId: 'invalid' },
      });

      await quickbooksController.retryTransaction(req as any, res as any, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('updateSettings', () => {
    it('should update sync settings', async () => {
      const mockConnection = { sync_enabled: true, settings: { syncTime: '06:00' } };
      mockBuilder.queueResponse(mockConnection);

      const { req, res, next } = createMockReqRes({
        params: { connectionId: 'conn-1' },
        body: { syncEnabled: true, settings: { syncTime: '06:00' } },
      });

      await quickbooksController.updateSettings(req as any, res as any, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        connection: {
          syncEnabled: true,
          settings: { syncTime: '06:00' },
        },
      });
    });
  });
});
