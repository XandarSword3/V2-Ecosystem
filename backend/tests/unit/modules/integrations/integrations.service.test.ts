import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
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
    then: (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: insertData, error: null })
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
  updateChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null });
  mockObj.update = vi.fn().mockReturnValue(updateChain);
  
  const deleteChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'lte', 'gte', 'not', 'is', 'or', 'in'].forEach(method => {
    deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
  });
  deleteChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null });
  mockObj.delete = vi.fn().mockReturnValue(deleteChain);
  return mockObj;
}

// Mock intuit-oauth
vi.mock('intuit-oauth', () => {
  const mockScopes = {
    Accounting: 'com.intuit.quickbooks.accounting',
    OpenId: 'openid',
  };

  const MockClient = function() {
    return {
      authorizeUri: () => 'https://oauth.intuit.com/authorize',
      createToken: () => Promise.resolve({
        getJson: () => ({
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          expires_in: 3600,
        }),
      }),
      refresh: () => Promise.resolve({
        getJson: () => ({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
        }),
      }),
      setToken: () => {},
    };
  };
  MockClient.scopes = mockScopes;
  
  return { default: MockClient };
});

// Mock axios
vi.mock('axios', () => ({
  default: vi.fn().mockResolvedValue({
    data: { QueryResponse: { Account: [] } },
  }),
}));

// Table-specific mock data
const mockTables: Record<string, () => unknown[]> = {
  quickbooks_connections: () => [{
    id: 'conn-1',
    realm_id: 'realm-123',
    access_token: 'valid-access-token',
    refresh_token: 'valid-refresh-token',
    token_expires_at: new Date(Date.now() + 3600000).toISOString(),
    last_sync_at: null,
  }],
  quickbooks_customer_mappings: () => [],
  quickbooks_account_mappings: () => [{
    v2_category: 'room_revenue',
    qb_account_id: 'qb-acc-1',
  }],
  quickbooks_synced_transactions: () => [],
  quickbooks_sync_log: () => [{
    id: 'log-1',
    connection_id: 'conn-1',
    sync_type: 'sales',
    status: 'completed',
    records_processed: 10,
    records_synced: 10,
    records_failed: 0,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  }],
  payments: () => [{
    id: 'payment-1',
    amount: '100.00',
    status: 'completed',
    source_type: 'room_revenue',
    description: 'Room Booking',
    created_at: new Date().toISOString(),
    users: {
      id: 'user-1',
      email: 'test@example.com',
      first_name: 'John',
      last_name: 'Doe',
    },
  }],
};

let currentTableMocks = { ...mockTables };

const mockSupabase = {
  from: vi.fn((table: string) => {
    const mockFn = currentTableMocks[table] || (() => []);
    return createQueryMock(mockFn);
  }),
};

vi.mock('../../../../src/database/connection.js', () => ({
  getSupabase: () => mockSupabase,
}));

// Import after mocking
import * as quickbooksService from '../../../../src/modules/integrations/quickbooks/quickbooks.service.js';
import axios from 'axios';

type MockedAxios = typeof axios & ReturnType<typeof vi.fn>;

describe('QuickBooks Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentTableMocks = { ...mockTables };
  });

  describe('REVENUE_CATEGORIES', () => {
    it('should export revenue categories constant', () => {
      expect(quickbooksService.REVENUE_CATEGORIES).toBeDefined();
      expect(quickbooksService.REVENUE_CATEGORIES.room_revenue).toEqual({
        name: 'Room Revenue',
        defaultType: 'Income',
      });
    });

    it('should have all expected categories', () => {
      const categories = Object.keys(quickbooksService.REVENUE_CATEGORIES);
      expect(categories).toContain('room_revenue');
      expect(categories).toContain('food_revenue');
      expect(categories).toContain('spa_revenue');
      expect(categories).toContain('pool_revenue');
      expect(categories).toContain('merchandise_revenue');
      expect(categories).toContain('service_revenue');
      expect(categories).toContain('loyalty_redemption');
      expect(categories).toContain('refunds');
      expect(categories).toContain('tips');
      expect(categories).toContain('taxes_collected');
    });
  });

  describe('createOAuthClient', () => {
    it('should create an OAuth client instance', () => {
      const client = quickbooksService.createOAuthClient();
      expect(client).toBeDefined();
      expect(client).toHaveProperty('authorizeUri');
      expect(client).toHaveProperty('createToken');
      expect(client).toHaveProperty('refresh');
    });

    it('should return client with required methods', () => {
      const client = quickbooksService.createOAuthClient();
      expect(typeof client.authorizeUri).toBe('function');
      expect(typeof client.createToken).toBe('function');
      expect(typeof client.refresh).toBe('function');
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should return authorization URL', () => {
      const url = quickbooksService.getAuthorizationUrl();
      expect(url).toBe('https://oauth.intuit.com/authorize');
    });

    it('should accept custom state parameter', () => {
      // Just verify it doesn't throw and returns URL
      const url = quickbooksService.getAuthorizationUrl('custom-state');
      expect(url).toBe('https://oauth.intuit.com/authorize');
    });

    it('should use default state if not provided', () => {
      const url = quickbooksService.getAuthorizationUrl();
      expect(typeof url).toBe('string');
      expect(url).toContain('oauth');
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('should exchange authorization code for tokens', async () => {
      const result = await quickbooksService.exchangeCodeForTokens('auth-code', 'realm-123');
      
      expect(result).toHaveProperty('accessToken', 'mock-access-token');
      expect(result).toHaveProperty('refreshToken', 'mock-refresh-token');
      expect(result).toHaveProperty('expiresAt');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should return future expiration date', async () => {
      const beforeCall = Date.now();
      const result = await quickbooksService.exchangeCodeForTokens('test-code', 'test-realm');
      expect(result.expiresAt.getTime()).toBeGreaterThan(beforeCall);
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh access token using refresh token', async () => {
      const result = await quickbooksService.refreshAccessToken('old-refresh-token');
      
      expect(result).toHaveProperty('accessToken', 'new-access-token');
      expect(result).toHaveProperty('refreshToken', 'new-refresh-token');
      expect(result).toHaveProperty('expiresAt');
    });

    it('should return new expiration date', async () => {
      const beforeCall = Date.now();
      const result = await quickbooksService.refreshAccessToken('my-refresh-token');
      expect(result.expiresAt.getTime()).toBeGreaterThan(beforeCall);
    });
  });

  describe('getValidAccessToken', () => {
    it('should return existing token if not expired', async () => {
      currentTableMocks.quickbooks_connections = () => [{
        id: 'conn-1',
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
        token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      }];

      const token = await quickbooksService.getValidAccessToken('conn-1');
      expect(token).toBe('valid-token');
    });

    it('should refresh token if expired', async () => {
      currentTableMocks.quickbooks_connections = () => [{
        id: 'conn-1',
        access_token: 'expired-token',
        refresh_token: 'refresh-token',
        token_expires_at: new Date(Date.now() - 1000).toISOString(),
      }];

      const token = await quickbooksService.getValidAccessToken('conn-1');
      expect(token).toBe('new-access-token');
    });

    it('should refresh token if expiring within 5 minutes', async () => {
      currentTableMocks.quickbooks_connections = () => [{
        id: 'conn-1',
        access_token: 'soon-expired-token',
        refresh_token: 'refresh-token',
        token_expires_at: new Date(Date.now() + 60000).toISOString(), // 1 minute from now
      }];

      const token = await quickbooksService.getValidAccessToken('conn-1');
      expect(token).toBe('new-access-token');
    });

    it('should throw error if connection not found', async () => {
      currentTableMocks.quickbooks_connections = () => [];

      await expect(quickbooksService.getValidAccessToken('nonexistent')).rejects.toThrow(
        'QuickBooks connection not found'
      );
    });
  });

  describe('makeQBRequest', () => {
    it('should make authenticated GET request to QuickBooks', async () => {
      currentTableMocks.quickbooks_connections = () => [{
        id: 'conn-1',
        realm_id: 'realm-123',
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
        token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      }];

      (axios as MockedAxios).mockResolvedValueOnce({
        data: { result: 'success' },
      });

      const result = await quickbooksService.makeQBRequest('conn-1', 'GET', '/test');
      expect(result).toEqual({ result: 'success' });
    });

    it('should include authorization header', async () => {
      currentTableMocks.quickbooks_connections = () => [{
        id: 'conn-1',
        realm_id: 'realm-123',
        access_token: 'my-token',
        refresh_token: 'refresh-token',
        token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      }];

      await quickbooksService.makeQBRequest('conn-1', 'GET', '/test');
      
      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        })
      );
    });

    it('should make POST request with data', async () => {
      currentTableMocks.quickbooks_connections = () => [{
        id: 'conn-1',
        realm_id: 'realm-123',
        access_token: 'my-token',
        refresh_token: 'refresh-token',
        token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      }];

      const postData = { name: 'Test' };
      await quickbooksService.makeQBRequest('conn-1', 'POST', '/customer', postData);
      
      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          data: postData,
        })
      );
    });

    it('should throw error if connection not found', async () => {
      currentTableMocks.quickbooks_connections = () => [];

      await expect(quickbooksService.makeQBRequest('conn-1', 'GET', '/test')).rejects.toThrow(
        'QuickBooks connection not found'
      );
    });
  });

  describe('getAccounts', () => {
    it('should return list of accounts from QuickBooks', async () => {
      currentTableMocks.quickbooks_connections = () => [{
        id: 'conn-1',
        realm_id: 'realm-123',
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
        token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      }];

      (axios as MockedAxios).mockResolvedValueOnce({
        data: {
          QueryResponse: {
            Account: [
              { Id: '1', Name: 'Sales', AccountType: 'Income', Classification: 'Revenue' },
              { Id: '2', Name: 'Expenses', AccountType: 'Expense', Classification: 'Expense' },
            ],
          },
        },
      });

      const accounts = await quickbooksService.getAccounts('conn-1');
      
      expect(accounts).toHaveLength(2);
      expect(accounts[0]).toEqual({
        id: '1',
        name: 'Sales',
        accountType: 'Income',
        classification: 'Revenue',
      });
    });

    it('should return empty array if no accounts', async () => {
      currentTableMocks.quickbooks_connections = () => [{
        id: 'conn-1',
        realm_id: 'realm-123',
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
        token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      }];

      (axios as MockedAxios).mockResolvedValueOnce({
        data: {
          QueryResponse: {},
        },
      });

      const accounts = await quickbooksService.getAccounts('conn-1');
      expect(accounts).toHaveLength(0);
    });
  });

  describe('syncCustomer', () => {
    it('should return existing QB customer ID if already mapped', async () => {
      currentTableMocks.quickbooks_customer_mappings = () => [{
        qb_customer_id: 'existing-qb-customer',
      }];

      const result = await quickbooksService.syncCustomer('conn-1', {
        id: 'user-1',
        email: 'test@example.com',
      });

      expect(result).toBe('existing-qb-customer');
    });

    it('should create new customer in QuickBooks if not mapped', async () => {
      currentTableMocks.quickbooks_connections = () => [{
        id: 'conn-1',
        realm_id: 'realm-123',
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
        token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      }];
      currentTableMocks.quickbooks_customer_mappings = () => [];

      (axios as MockedAxios).mockResolvedValueOnce({
        data: {
          Customer: { Id: 'new-qb-customer', DisplayName: 'John Doe' },
        },
      });

      const result = await quickbooksService.syncCustomer('conn-1', {
        id: 'user-1',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(result).toBe('new-qb-customer');
    });

    it('should use email as display name if no name provided', async () => {
      currentTableMocks.quickbooks_connections = () => [{
        id: 'conn-1',
        realm_id: 'realm-123',
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
        token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      }];
      currentTableMocks.quickbooks_customer_mappings = () => [];

      (axios as MockedAxios).mockResolvedValueOnce({
        data: {
          Customer: { Id: 'qb-id', DisplayName: 'test@example.com' },
        },
      });

      await quickbooksService.syncCustomer('conn-1', {
        id: 'user-1',
        email: 'test@example.com',
      });

      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            DisplayName: 'test@example.com',
          }),
        })
      );
    });
  });

  describe('createSalesReceipt', () => {
    it('should create sales receipt in QuickBooks', async () => {
      currentTableMocks.quickbooks_connections = () => [{
        id: 'conn-1',
        realm_id: 'realm-123',
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
        token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      }];

      (axios as MockedAxios).mockResolvedValueOnce({
        data: {
          SalesReceipt: { Id: 'sr-123' },
        },
      });

      const result = await quickbooksService.createSalesReceipt('conn-1', {
        transactionId: 'txn-1',
        transactionType: 'payment',
        date: new Date('2024-01-15'),
        lineItems: [{
          description: 'Room Booking',
          amount: 100,
          category: 'room_revenue',
        }],
      });

      expect(result).toBe('sr-123');
    });

    it('should record synced transaction', async () => {
      currentTableMocks.quickbooks_connections = () => [{
        id: 'conn-1',
        realm_id: 'realm-123',
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
        token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      }];

      (axios as MockedAxios).mockResolvedValueOnce({
        data: {
          SalesReceipt: { Id: 'sr-123' },
        },
      });

      await quickbooksService.createSalesReceipt('conn-1', {
        transactionId: 'txn-1',
        transactionType: 'payment',
        date: new Date(),
        lineItems: [{ description: 'Test', amount: 50, category: 'service_revenue' }],
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('quickbooks_synced_transactions');
    });

    it('should use correct account mapping for line items', async () => {
      currentTableMocks.quickbooks_connections = () => [{
        id: 'conn-1',
        realm_id: 'realm-123',
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
        token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      }];
      currentTableMocks.quickbooks_account_mappings = () => [{
        v2_category: 'room_revenue',
        qb_account_id: 'mapped-account-1',
      }];

      (axios as MockedAxios).mockResolvedValueOnce({
        data: {
          SalesReceipt: { Id: 'sr-123' },
        },
      });

      await quickbooksService.createSalesReceipt('conn-1', {
        transactionId: 'txn-1',
        transactionType: 'payment',
        date: new Date(),
        lineItems: [{ description: 'Room', amount: 100, category: 'room_revenue' }],
      });

      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            Line: expect.arrayContaining([
              expect.objectContaining({
                SalesItemLineDetail: expect.objectContaining({
                  ItemRef: expect.objectContaining({
                    value: 'mapped-account-1',
                  }),
                }),
              }),
            ]),
          }),
        })
      );
    });
  });

  describe('createJournalEntry', () => {
    it('should create journal entry in QuickBooks', async () => {
      currentTableMocks.quickbooks_connections = () => [{
        id: 'conn-1',
        realm_id: 'realm-123',
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
        token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      }];

      (axios as MockedAxios).mockResolvedValueOnce({
        data: {
          JournalEntry: { Id: 'je-123' },
        },
      });

      const result = await quickbooksService.createJournalEntry('conn-1', {
        date: new Date('2024-01-15'),
        memo: 'Daily sales entry',
        lines: [
          { accountId: 'acc-1', amount: 100, type: 'Debit' },
          { accountId: 'acc-2', amount: 100, type: 'Credit' },
        ],
      });

      expect(result).toBe('je-123');
    });

    it('should format journal entry lines correctly', async () => {
      currentTableMocks.quickbooks_connections = () => [{
        id: 'conn-1',
        realm_id: 'realm-123',
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
        token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      }];

      (axios as MockedAxios).mockResolvedValueOnce({
        data: {
          JournalEntry: { Id: 'je-123' },
        },
      });

      await quickbooksService.createJournalEntry('conn-1', {
        date: new Date(),
        memo: 'Test memo',
        lines: [
          { accountId: 'acc-1', amount: 50, type: 'Debit', description: 'Debit line' },
          { accountId: 'acc-2', amount: -50, type: 'Credit', description: 'Credit line' },
        ],
      });

      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            Line: expect.arrayContaining([
              expect.objectContaining({
                Amount: 50,
                DetailType: 'JournalEntryLineDetail',
                JournalEntryLineDetail: expect.objectContaining({
                  PostingType: 'Debit',
                  AccountRef: { value: 'acc-1' },
                }),
              }),
            ]),
          }),
        })
      );
    });
  });

  describe('syncDailySales', () => {
    it('should sync daily sales to QuickBooks', async () => {
      currentTableMocks.quickbooks_connections = () => [{
        id: 'conn-1',
        realm_id: 'realm-123',
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
        token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      }];
      currentTableMocks.payments = () => [{
        id: 'payment-1',
        amount: '100.00',
        status: 'completed',
        source_type: 'room_revenue',
        description: 'Room Booking',
        created_at: new Date().toISOString(),
      }];
      currentTableMocks.quickbooks_synced_transactions = () => [];

      (axios as MockedAxios).mockResolvedValue({
        data: {
          SalesReceipt: { Id: 'sr-123' },
        },
      });

      const result = await quickbooksService.syncDailySales('conn-1', new Date());

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('synced');
      expect(result).toHaveProperty('failed');
      expect(result).toHaveProperty('errors');
    });

    it('should return successfully with zero records when no payments', async () => {
      currentTableMocks.payments = () => [];

      const result = await quickbooksService.syncDailySales('conn-1', new Date());

      expect(result).toEqual({
        success: true,
        synced: 0,
        failed: 0,
        errors: [],
      });
    });

    it('should skip already synced payments', async () => {
      currentTableMocks.quickbooks_connections = () => [{
        id: 'conn-1',
        realm_id: 'realm-123',
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
        token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      }];
      currentTableMocks.payments = () => [{
        id: 'payment-1',
        amount: '100.00',
        status: 'completed',
        source_type: 'room_revenue',
        description: 'Room Booking',
        created_at: new Date().toISOString(),
      }];
      currentTableMocks.quickbooks_synced_transactions = () => [{
        v2_transaction_id: 'payment-1',
        sync_status: 'synced',
      }];

      const result = await quickbooksService.syncDailySales('conn-1', new Date());

      expect(result.synced).toBe(0);
    });

    it('should create sync log entry', async () => {
      currentTableMocks.payments = () => [];

      await quickbooksService.syncDailySales('conn-1', new Date());

      expect(mockSupabase.from).toHaveBeenCalledWith('quickbooks_sync_log');
    });
  });

  describe('getSyncHistory', () => {
    it('should return sync history for connection', async () => {
      currentTableMocks.quickbooks_sync_log = () => [
        {
          id: 'log-1',
          sync_type: 'sales',
          status: 'completed',
          records_processed: 10,
          records_synced: 10,
          records_failed: 0,
          started_at: '2024-01-15T10:00:00Z',
          completed_at: '2024-01-15T10:05:00Z',
        },
        {
          id: 'log-2',
          sync_type: 'sales',
          status: 'completed_with_errors',
          records_processed: 5,
          records_synced: 3,
          records_failed: 2,
          started_at: '2024-01-14T10:00:00Z',
          completed_at: '2024-01-14T10:03:00Z',
        },
      ];

      const history = await quickbooksService.getSyncHistory('conn-1');

      expect(history).toHaveLength(2);
      expect(history[0]).toEqual({
        id: 'log-1',
        syncType: 'sales',
        status: 'completed',
        recordsProcessed: 10,
        recordsSynced: 10,
        recordsFailed: 0,
        startedAt: '2024-01-15T10:00:00Z',
        completedAt: '2024-01-15T10:05:00Z',
      });
    });

    it('should respect limit parameter', async () => {
      await quickbooksService.getSyncHistory('conn-1', 10);

      expect(mockSupabase.from).toHaveBeenCalledWith('quickbooks_sync_log');
    });

    it('should return empty array if no history', async () => {
      currentTableMocks.quickbooks_sync_log = () => [];

      const history = await quickbooksService.getSyncHistory('conn-1');
      expect(history).toHaveLength(0);
    });
  });

  describe('testConnection', () => {
    it('should return success with company name on valid connection', async () => {
      currentTableMocks.quickbooks_connections = () => [{
        id: 'conn-1',
        realm_id: 'realm-123',
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
        token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      }];

      (axios as MockedAxios).mockResolvedValueOnce({
        data: {
          CompanyInfo: { CompanyName: 'Test Company LLC' },
        },
      });

      const result = await quickbooksService.testConnection('conn-1');

      expect(result).toEqual({
        success: true,
        companyName: 'Test Company LLC',
      });
    });

    it('should return failure on invalid connection', async () => {
      currentTableMocks.quickbooks_connections = () => [];

      const result = await quickbooksService.testConnection('invalid-conn');

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('error');
    });

    it('should return failure on API error', async () => {
      currentTableMocks.quickbooks_connections = () => [{
        id: 'conn-1',
        realm_id: 'realm-123',
        access_token: 'valid-token',
        refresh_token: 'refresh-token',
        token_expires_at: new Date(Date.now() + 3600000).toISOString(),
      }];

      (axios as MockedAxios).mockRejectedValueOnce(new Error('API Error'));

      const result = await quickbooksService.testConnection('conn-1');

      expect(result).toEqual({
        success: false,
        error: 'API Error',
      });
    });
  });
});
