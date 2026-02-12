/**
 * Loyalty Service Unit Tests
 * 
 * Tests for the loyalty module controller using Supabase chainable mock pattern.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase connection
vi.mock('../../../../src/database/connection.js', () => ({
  getSupabase: vi.fn(),
}));

import { getSupabase } from '../../../../src/database/connection.js';
import { LoyaltyController } from '../../../../src/modules/loyalty/loyalty.controller.js';

function createQueryMock(mockDataFn: () => unknown[]) {
  const mockObj: Record<string, unknown> = {};
  const chainMethods = ['select', 'eq', 'is', 'or', 'order', 'gte', 'lte', 'gt', 'lt', 'limit', 'neq', 'not', 'in', 'contains', 'ilike', 'range'];
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
  ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'is', 'not', 'or', 'in', 'select'].forEach(method => {
    updateChain[method] = vi.fn().mockReturnValue(updateChain);
  });
  updateChain.select = vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({ data: { id: 'item-1' }, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'item-1' }, error: null })
  });
  updateChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null });
  mockObj.update = vi.fn().mockReturnValue(updateChain);
  
  const deleteChain: Record<string, unknown> = {};
  ['eq', 'neq', 'gt', 'lt', 'lte', 'gte', 'not', 'is', 'or', 'in'].forEach(method => {
    deleteChain[method] = vi.fn().mockReturnValue(deleteChain);
  });
  deleteChain.select = vi.fn().mockReturnValue({
    then: (resolve: (value: { data: unknown; error: unknown }) => void) => {
      const data = mockDataFn();
      resolve({ data, error: null });
      return Promise.resolve({ data, error: null });
    }
  });
  deleteChain.then = (resolve: (value: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null });
  mockObj.delete = vi.fn().mockReturnValue(deleteChain);
  return mockObj;
}

function createMockRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    params: {},
    query: {},
    body: {},
    user: { id: 'admin-user-1', userId: 'admin-user-1' },
    ...overrides,
  };
}

function createMockResponse(): { json: ReturnType<typeof vi.fn>; status: ReturnType<typeof vi.fn>; statusCode: number } {
  const res: { json: ReturnType<typeof vi.fn>; status: ReturnType<typeof vi.fn>; statusCode: number } = {
    json: vi.fn(),
    status: vi.fn(),
    statusCode: 200,
  };
  res.status = vi.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res;
  });
  return res;
}

describe('LoyaltyController', () => {
  let controller: LoyaltyController;
  const mockUserId = '11111111-1111-1111-1111-111111111111';
  const mockAccountId = '22222222-2222-2222-2222-222222222222';
  const mockTierId = '33333333-3333-3333-3333-333333333333';

  const mockAccount = {
    id: mockAccountId,
    user_id: mockUserId,
    tier_id: mockTierId,
    available_points: 500,
    total_points: 500,
    lifetime_points: 1000,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    tier: {
      id: mockTierId,
      name: 'Silver',
      min_points: 100,
      points_multiplier: 1.25,
      benefits: ['5% discount'],
      color: '#C0C0C0',
    },
  };

  const mockTier = {
    id: mockTierId,
    name: 'Silver',
    min_points: 100,
    points_multiplier: 1.25,
    benefits: ['5% discount'],
    color: '#C0C0C0',
  };

  const mockSettings = {
    id: 'settings-1',
    points_per_dollar: 10,
    redemption_rate: 0.01,
    min_redemption: 100,
    signup_bonus: 50,
    birthday_bonus: 100,
    is_enabled: true,
  };

  const mockTransaction = {
    id: 'txn-1',
    account_id: mockAccountId,
    type: 'earn',
    points: 100,
    balance_after: 600,
    description: 'Points earned',
    reference_type: 'order',
    reference_id: 'order-123',
    created_at: '2024-01-15T10:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new LoyaltyController();
  });

  // ============================================
  // GET ACCOUNT TESTS
  // ============================================
  describe('getAccount', () => {
    it('should return existing loyalty account', async () => {
      const tableMocks: Record<string, ReturnType<typeof createQueryMock>> = {
        loyalty_accounts: createQueryMock(() => [mockAccount]),
      };
      vi.mocked(getSupabase).mockReturnValue({
        from: (table: string) => tableMocks[table] || createQueryMock(() => []),
      } as never);

      const req = createMockRequest({ params: { userId: mockUserId } });
      const res = createMockResponse();

      await controller.getAccount(req as never, res as never);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockAccount,
      });
    });

    it('should create account with signup bonus if not exists', async () => {
      const newAccount = { ...mockAccount, available_points: 50, total_points: 50, lifetime_points: 50 };
      let accountExists = false;

      const insertMock = vi.fn().mockImplementation((data) => ({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: newAccount, error: null })
        }),
      }));

      const tableMocks: Record<string, ReturnType<typeof createQueryMock>> = {
        loyalty_accounts: (() => {
          const mock = createQueryMock(() => accountExists ? [newAccount] : []);
          mock.insert = insertMock;
          return mock;
        })(),
        loyalty_settings: createQueryMock(() => [mockSettings]),
        loyalty_tiers: createQueryMock(() => [{ id: mockTierId }]),
        loyalty_transactions: createQueryMock(() => []),
      };
      tableMocks.loyalty_transactions.insert = vi.fn().mockImplementation(() => ({
        then: (resolve: (arg: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null })
      }));

      vi.mocked(getSupabase).mockReturnValue({
        from: (table: string) => tableMocks[table] || createQueryMock(() => []),
      } as never);

      const req = createMockRequest({ params: { userId: mockUserId } });
      const res = createMockResponse();

      await controller.getAccount(req as never, res as never);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: newAccount,
      });
    });

    it('should handle database error', async () => {
      const mockQuery = createQueryMock(() => []);
      mockQuery.single = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'DB_ERROR', message: 'Database connection failed' },
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: () => mockQuery,
      } as never);

      const req = createMockRequest({ params: { userId: mockUserId } });
      const res = createMockResponse();

      await controller.getAccount(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Failed to fetch loyalty account',
      }));
    });
  });

  // ============================================
  // GET MY ACCOUNT TESTS
  // ============================================
  describe('getMyAccount', () => {
    it('should return account for authenticated user', async () => {
      const tableMocks: Record<string, ReturnType<typeof createQueryMock>> = {
        loyalty_accounts: createQueryMock(() => [mockAccount]),
      };
      vi.mocked(getSupabase).mockReturnValue({
        from: (table: string) => tableMocks[table] || createQueryMock(() => []),
      } as never);

      const req = createMockRequest({ user: { userId: mockUserId } });
      const res = createMockResponse();

      await controller.getMyAccount(req as never, res as never);

      expect(req.params).toHaveProperty('userId', mockUserId);
    });

    it('should return 401 if not authenticated', async () => {
      const req = createMockRequest({ user: null });
      const res = createMockResponse();

      await controller.getMyAccount(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Not authenticated',
      });
    });
  });

  // ============================================
  // EARN POINTS TESTS
  // ============================================
  describe('earnPoints', () => {
    it('should earn points successfully', async () => {
      const tableMocks: Record<string, ReturnType<typeof createQueryMock>> = {
        loyalty_accounts: createQueryMock(() => [mockAccount]),
        loyalty_settings: createQueryMock(() => [mockSettings]),
        loyalty_tiers: createQueryMock(() => [mockTier]),
        loyalty_transactions: createQueryMock(() => []),
      };
      tableMocks.loyalty_transactions.insert = vi.fn().mockImplementation(() => ({
        then: (resolve: (arg: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null })
      }));

      vi.mocked(getSupabase).mockReturnValue({
        from: (table: string) => tableMocks[table] || createQueryMock(() => []),
      } as never);

      const req = createMockRequest({
        body: {
          userId: mockUserId,
          points: 100,
          description: 'Purchase reward',
          referenceType: 'order',
          referenceId: '44444444-4444-4444-4444-444444444444',
        },
      });
      const res = createMockResponse();

      await controller.earnPoints(req as never, res as never);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          pointsEarned: expect.any(Number),
          multiplier: expect.any(Number),
          newBalance: expect.any(Number),
        }),
      });
    });

    it('should create account if not exists and earn points', async () => {
      const newAccount = { ...mockAccount, available_points: 0, total_points: 0, lifetime_points: 0 };
      let callCount = 0;

      const accountMock = createQueryMock(() => {
        callCount++;
        return callCount > 1 ? [newAccount] : [];
      });
      accountMock.insert = vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: newAccount, error: null })
        }),
      }));

      const tableMocks: Record<string, ReturnType<typeof createQueryMock>> = {
        loyalty_accounts: accountMock,
        loyalty_settings: createQueryMock(() => [mockSettings]),
        loyalty_tiers: createQueryMock(() => [mockTier]),
        loyalty_transactions: createQueryMock(() => []),
      };
      tableMocks.loyalty_transactions.insert = vi.fn().mockImplementation(() => ({
        then: (resolve: (arg: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null })
      }));

      vi.mocked(getSupabase).mockReturnValue({
        from: (table: string) => tableMocks[table] || createQueryMock(() => []),
      } as never);

      const req = createMockRequest({
        body: {
          userId: mockUserId,
          points: 50,
        },
      });
      const res = createMockResponse();

      await controller.earnPoints(req as never, res as never);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });

    it('should apply tier multiplier to earned points', async () => {
      const goldTier = { ...mockTier, name: 'Gold', points_multiplier: 2.0 };
      const goldAccount = { ...mockAccount, tier: goldTier };

      const tableMocks: Record<string, ReturnType<typeof createQueryMock>> = {
        loyalty_accounts: createQueryMock(() => [goldAccount]),
        loyalty_settings: createQueryMock(() => [mockSettings]),
        loyalty_tiers: createQueryMock(() => [goldTier]),
        loyalty_transactions: createQueryMock(() => []),
      };
      tableMocks.loyalty_transactions.insert = vi.fn().mockImplementation(() => ({
        then: (resolve: (arg: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null })
      }));

      vi.mocked(getSupabase).mockReturnValue({
        from: (table: string) => tableMocks[table] || createQueryMock(() => []),
      } as never);

      const req = createMockRequest({
        body: { userId: mockUserId, points: 100 },
      });
      const res = createMockResponse();

      await controller.earnPoints(req as never, res as never);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          pointsEarned: 200, // 100 * 2.0 multiplier
          multiplier: 2.0,
        }),
      });
    });

    it('should reject invalid user ID', async () => {
      const req = createMockRequest({
        body: { userId: 'invalid-uuid', points: 100 },
      });
      const res = createMockResponse();

      await controller.earnPoints(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Validation failed',
      }));
    });

    it('should reject negative points', async () => {
      const req = createMockRequest({
        body: { userId: mockUserId, points: -50 },
      });
      const res = createMockResponse();

      await controller.earnPoints(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should reject zero points', async () => {
      const req = createMockRequest({
        body: { userId: mockUserId, points: 0 },
      });
      const res = createMockResponse();

      await controller.earnPoints(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ============================================
  // REDEEM POINTS TESTS
  // ============================================
  describe('redeemPoints', () => {
    it('should redeem points successfully', async () => {
      const accountWithPoints = { ...mockAccount, available_points: 1000 };

      const tableMocks: Record<string, ReturnType<typeof createQueryMock>> = {
        loyalty_accounts: createQueryMock(() => [accountWithPoints]),
        loyalty_settings: createQueryMock(() => [mockSettings]),
        loyalty_transactions: createQueryMock(() => []),
      };
      tableMocks.loyalty_transactions.insert = vi.fn().mockImplementation(() => ({
        then: (resolve: (arg: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null })
      }));

      vi.mocked(getSupabase).mockReturnValue({
        from: (table: string) => tableMocks[table] || createQueryMock(() => []),
      } as never);

      const req = createMockRequest({
        body: {
          userId: mockUserId,
          points: 500,
          description: 'Discount redemption',
        },
      });
      const res = createMockResponse();

      await controller.redeemPoints(req as never, res as never);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          pointsRedeemed: 500,
          dollarValue: 5, // 500 * 0.01
          newBalance: 500, // 1000 - 500
        }),
      });
    });

    it('should reject insufficient points', async () => {
      const accountWithFewPoints = { ...mockAccount, available_points: 100 };

      const tableMocks: Record<string, ReturnType<typeof createQueryMock>> = {
        loyalty_accounts: createQueryMock(() => [accountWithFewPoints]),
        loyalty_settings: createQueryMock(() => [mockSettings]),
      };

      vi.mocked(getSupabase).mockReturnValue({
        from: (table: string) => tableMocks[table] || createQueryMock(() => []),
      } as never);

      const req = createMockRequest({
        body: { userId: mockUserId, points: 500 },
      });
      const res = createMockResponse();

      await controller.redeemPoints(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Insufficient points',
      }));
    });

    it('should reject below minimum redemption', async () => {
      const accountWithPoints = { ...mockAccount, available_points: 1000 };

      const tableMocks: Record<string, ReturnType<typeof createQueryMock>> = {
        loyalty_accounts: createQueryMock(() => [accountWithPoints]),
        loyalty_settings: createQueryMock(() => [{ ...mockSettings, min_redemption: 200 }]),
      };

      vi.mocked(getSupabase).mockReturnValue({
        from: (table: string) => tableMocks[table] || createQueryMock(() => []),
      } as never);

      const req = createMockRequest({
        body: { userId: mockUserId, points: 50 },
      });
      const res = createMockResponse();

      await controller.redeemPoints(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: 'Minimum redemption is 200 points',
      }));
    });

    it('should return 404 if account not found', async () => {
      const tableMocks: Record<string, ReturnType<typeof createQueryMock>> = {
        loyalty_accounts: createQueryMock(() => []),
      };

      vi.mocked(getSupabase).mockReturnValue({
        from: (table: string) => tableMocks[table] || createQueryMock(() => []),
      } as never);

      const req = createMockRequest({
        body: { userId: mockUserId, points: 100 },
      });
      const res = createMockResponse();

      await controller.redeemPoints(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Loyalty account not found',
      });
    });
  });

  // ============================================
  // ADJUST POINTS TESTS
  // ============================================
  describe('adjustPoints', () => {
    it('should add points successfully', async () => {
      const tableMocks: Record<string, ReturnType<typeof createQueryMock>> = {
        loyalty_accounts: createQueryMock(() => [mockAccount]),
        loyalty_transactions: createQueryMock(() => []),
      };
      tableMocks.loyalty_transactions.insert = vi.fn().mockImplementation(() => ({
        then: (resolve: (arg: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null })
      }));

      vi.mocked(getSupabase).mockReturnValue({
        from: (table: string) => tableMocks[table] || createQueryMock(() => []),
      } as never);

      const req = createMockRequest({
        body: {
          userId: mockUserId,
          points: 100,
          reason: 'Goodwill adjustment',
        },
      });
      const res = createMockResponse();

      await controller.adjustPoints(req as never, res as never);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          adjustment: 100,
          newBalance: 600, // 500 + 100
          reason: 'Goodwill adjustment',
        }),
      });
    });

    it('should deduct points successfully', async () => {
      const tableMocks: Record<string, ReturnType<typeof createQueryMock>> = {
        loyalty_accounts: createQueryMock(() => [mockAccount]),
        loyalty_transactions: createQueryMock(() => []),
      };
      tableMocks.loyalty_transactions.insert = vi.fn().mockImplementation(() => ({
        then: (resolve: (arg: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null })
      }));

      vi.mocked(getSupabase).mockReturnValue({
        from: (table: string) => tableMocks[table] || createQueryMock(() => []),
      } as never);

      const req = createMockRequest({
        body: {
          userId: mockUserId,
          points: -200,
          reason: 'Refund correction',
        },
      });
      const res = createMockResponse();

      await controller.adjustPoints(req as never, res as never);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          adjustment: -200,
          newBalance: 300, // 500 - 200
        }),
      });
    });

    it('should not allow negative balance', async () => {
      const tableMocks: Record<string, ReturnType<typeof createQueryMock>> = {
        loyalty_accounts: createQueryMock(() => [mockAccount]),
        loyalty_transactions: createQueryMock(() => []),
      };
      tableMocks.loyalty_transactions.insert = vi.fn().mockImplementation(() => ({
        then: (resolve: (arg: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null })
      }));

      vi.mocked(getSupabase).mockReturnValue({
        from: (table: string) => tableMocks[table] || createQueryMock(() => []),
      } as never);

      const req = createMockRequest({
        body: {
          userId: mockUserId,
          points: -1000, // More than available
          reason: 'Large deduction',
        },
      });
      const res = createMockResponse();

      await controller.adjustPoints(req as never, res as never);

      // Should set to 0, not negative
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          newBalance: 0,
        }),
      });
    });

    it('should reject missing reason', async () => {
      const req = createMockRequest({
        body: { userId: mockUserId, points: 100 },
      });
      const res = createMockResponse();

      await controller.adjustPoints(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 if account not found', async () => {
      const tableMocks: Record<string, ReturnType<typeof createQueryMock>> = {
        loyalty_accounts: createQueryMock(() => []),
      };

      vi.mocked(getSupabase).mockReturnValue({
        from: (table: string) => tableMocks[table] || createQueryMock(() => []),
      } as never);

      const req = createMockRequest({
        body: { userId: mockUserId, points: 100, reason: 'Test' },
      });
      const res = createMockResponse();

      await controller.adjustPoints(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // ============================================
  // ADJUST POINTS BY ACCOUNT ID TESTS
  // ============================================
  describe('adjustPointsByAccountId', () => {
    it('should adjust points by account ID', async () => {
      const tableMocks: Record<string, ReturnType<typeof createQueryMock>> = {
        loyalty_accounts: createQueryMock(() => [mockAccount]),
        loyalty_transactions: createQueryMock(() => []),
      };
      tableMocks.loyalty_transactions.insert = vi.fn().mockImplementation(() => ({
        then: (resolve: (arg: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null })
      }));

      vi.mocked(getSupabase).mockReturnValue({
        from: (table: string) => tableMocks[table] || createQueryMock(() => []),
      } as never);

      const req = createMockRequest({
        params: { accountId: mockAccountId },
        body: { points: 50, reason: 'Bonus adjustment' },
      });
      const res = createMockResponse();

      await controller.adjustPointsByAccountId(req as never, res as never);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          adjustment: 50,
          newBalance: 550,
        }),
      });
    });

    it('should return 404 for non-existent account ID', async () => {
      const mockQuery = createQueryMock(() => []);

      vi.mocked(getSupabase).mockReturnValue({
        from: () => mockQuery,
      } as never);

      const req = createMockRequest({
        params: { accountId: 'non-existent-id' },
        body: { points: 50, reason: 'Test' },
      });
      const res = createMockResponse();

      await controller.adjustPointsByAccountId(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // ============================================
  // GET TRANSACTIONS TESTS
  // ============================================
  describe('getTransactions', () => {
    it('should return transaction history', async () => {
      const transactions = [
        { ...mockTransaction, id: 'txn-1', points: 100, type: 'earn' },
        { ...mockTransaction, id: 'txn-2', points: -50, type: 'redeem' },
        { ...mockTransaction, id: 'txn-3', points: 25, type: 'bonus' },
      ];

      const accountMock = createQueryMock(() => [{ id: mockAccountId }]);
      const transactionMock = createQueryMock(() => transactions);
      (transactionMock as Record<string, unknown>).select = vi.fn().mockReturnValue({
        ...transactionMock,
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({
              data: transactions,
              count: 3,
              error: null,
            }),
          }),
        }),
      });

      const tableMocks: Record<string, ReturnType<typeof createQueryMock>> = {
        loyalty_accounts: accountMock,
        loyalty_transactions: transactionMock,
      };

      vi.mocked(getSupabase).mockReturnValue({
        from: (table: string) => tableMocks[table] || createQueryMock(() => []),
      } as never);

      const req = createMockRequest({
        params: { userId: mockUserId },
        query: { page: '1', limit: '20' },
      });
      const res = createMockResponse();

      await controller.getTransactions(req as never, res as never);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: transactions,
        pagination: expect.objectContaining({
          page: 1,
          limit: 20,
          total: 3,
        }),
      }));
    });

    it('should return empty array for user without account', async () => {
      const tableMocks: Record<string, ReturnType<typeof createQueryMock>> = {
        loyalty_accounts: createQueryMock(() => []),
      };

      vi.mocked(getSupabase).mockReturnValue({
        from: (table: string) => tableMocks[table] || createQueryMock(() => []),
      } as never);

      const req = createMockRequest({
        params: { userId: mockUserId },
        query: {},
      });
      const res = createMockResponse();

      await controller.getTransactions(req as never, res as never);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: [],
        pagination: { total: 0 },
      });
    });

    it('should filter transactions by type', async () => {
      const earnTransactions = [
        { ...mockTransaction, id: 'txn-1', points: 100, type: 'earn' },
      ];

      const accountMock = createQueryMock(() => [{ id: mockAccountId }]);
      const transactionMock = createQueryMock(() => []);
      (transactionMock as Record<string, unknown>).select = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: earnTransactions,
                count: 1,
                error: null,
              }),
            }),
          }),
        }),
      });

      const tableMocks: Record<string, ReturnType<typeof createQueryMock>> = {
        loyalty_accounts: accountMock,
        loyalty_transactions: transactionMock,
      };

      vi.mocked(getSupabase).mockReturnValue({
        from: (table: string) => tableMocks[table] || createQueryMock(() => []),
      } as never);

      const req = createMockRequest({
        params: { userId: mockUserId },
        query: { type: 'earn' },
      });
      const res = createMockResponse();

      await controller.getTransactions(req as never, res as never);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });
  });

  // ============================================
  // GET TIERS TESTS
  // ============================================
  describe('getTiers', () => {
    it('should return all tiers', async () => {
      const tiers = [
        { id: 'tier-1', name: 'Bronze', min_points: 0, points_multiplier: 1.0 },
        { id: 'tier-2', name: 'Silver', min_points: 1000, points_multiplier: 1.25 },
        { id: 'tier-3', name: 'Gold', min_points: 5000, points_multiplier: 1.5 },
        { id: 'tier-4', name: 'Platinum', min_points: 15000, points_multiplier: 2.0 },
      ];

      const tableMocks: Record<string, ReturnType<typeof createQueryMock>> = {
        loyalty_tiers: createQueryMock(() => tiers),
      };

      vi.mocked(getSupabase).mockReturnValue({
        from: (table: string) => tableMocks[table] || createQueryMock(() => []),
      } as never);

      const req = createMockRequest();
      const res = createMockResponse();

      await controller.getTiers(req as never, res as never);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: tiers,
      });
    });

    it('should handle database error', async () => {
      const mockQuery = createQueryMock(() => []);
      mockQuery.order = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: () => mockQuery,
      } as never);

      const req = createMockRequest();
      const res = createMockResponse();

      await controller.getTiers(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ============================================
  // UPDATE TIER TESTS
  // ============================================
  describe('updateTier', () => {
    it('should update tier successfully', async () => {
      const updatedTier = { ...mockTier, name: 'Premium Silver', points_multiplier: 1.5 };

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updatedTier, error: null }),
          }),
        }),
      });

      const tableMocks: Record<string, ReturnType<typeof createQueryMock>> = {
        loyalty_tiers: (() => {
          const mock = createQueryMock(() => [mockTier]);
          mock.update = updateMock;
          return mock;
        })(),
      };

      vi.mocked(getSupabase).mockReturnValue({
        from: (table: string) => tableMocks[table] || createQueryMock(() => []),
      } as never);

      const req = createMockRequest({
        params: { tierId: mockTierId },
        body: { name: 'Premium Silver', pointsMultiplier: 1.5 },
      });
      const res = createMockResponse();

      await controller.updateTier(req as never, res as never);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: updatedTier,
      });
    });

    it('should reject empty update', async () => {
      const req = createMockRequest({
        params: { tierId: mockTierId },
        body: {},
      });
      const res = createMockResponse();

      await controller.updateTier(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'No fields to update',
      });
    });

    it('should update tier benefits', async () => {
      const updatedTier = { ...mockTier, benefits: ['10% discount', 'Free shipping'] };

      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updatedTier, error: null }),
          }),
        }),
      });

      const tierMock = createQueryMock(() => [mockTier]);
      tierMock.update = updateMock;

      vi.mocked(getSupabase).mockReturnValue({
        from: () => tierMock,
      } as never);

      const req = createMockRequest({
        params: { tierId: mockTierId },
        body: { benefits: ['10% discount', 'Free shipping'] },
      });
      const res = createMockResponse();

      await controller.updateTier(req as never, res as never);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: updatedTier,
      });
    });
  });

  // ============================================
  // GET SETTINGS TESTS
  // ============================================
  describe('getSettings', () => {
    it('should return loyalty settings', async () => {
      const tableMocks: Record<string, ReturnType<typeof createQueryMock>> = {
        loyalty_settings: createQueryMock(() => [mockSettings]),
      };

      vi.mocked(getSupabase).mockReturnValue({
        from: (table: string) => tableMocks[table] || createQueryMock(() => []),
      } as never);

      const req = createMockRequest();
      const res = createMockResponse();

      await controller.getSettings(req as never, res as never);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockSettings,
      });
    });

    it('should return empty object if no settings exist', async () => {
      const mockQuery = createQueryMock(() => []);
      mockQuery.single = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: () => mockQuery,
      } as never);

      const req = createMockRequest();
      const res = createMockResponse();

      await controller.getSettings(req as never, res as never);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {},
      });
    });
  });

  // ============================================
  // UPDATE SETTINGS TESTS
  // ============================================
  describe('updateSettings', () => {
    it('should update existing settings', async () => {
      const updatedSettings = { ...mockSettings, points_per_dollar: 15 };

      const settingsMock = createQueryMock(() => [mockSettings]);
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updatedSettings, error: null }),
          }),
        }),
      });
      settingsMock.update = updateMock;

      vi.mocked(getSupabase).mockReturnValue({
        from: () => settingsMock,
      } as never);

      const req = createMockRequest({
        body: { pointsPerDollar: 15 },
      });
      const res = createMockResponse();

      await controller.updateSettings(req as never, res as never);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: updatedSettings,
      });
    });

    it('should create settings if not exist', async () => {
      const newSettings = { ...mockSettings, id: 'new-settings-1' };
      let queryCount = 0;

      const settingsMock = createQueryMock(() => {
        queryCount++;
        return queryCount > 1 ? [newSettings] : [];
      });
      settingsMock.insert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: newSettings, error: null }),
        }),
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: () => settingsMock,
      } as never);

      const req = createMockRequest({
        body: { pointsPerDollar: 10, redemptionRate: 0.01 },
      });
      const res = createMockResponse();

      await controller.updateSettings(req as never, res as never);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: newSettings,
      });
    });

    it('should reject empty update', async () => {
      const req = createMockRequest({ body: {} });
      const res = createMockResponse();

      await controller.updateSettings(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'No fields to update',
      });
    });

    it('should reject invalid values', async () => {
      const req = createMockRequest({
        body: { pointsPerDollar: -5 },
      });
      const res = createMockResponse();

      await controller.updateSettings(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ============================================
  // GET ALL ACCOUNTS TESTS
  // ============================================
  describe('getAllAccounts', () => {
    it('should return paginated accounts', async () => {
      const accounts = [
        { ...mockAccount, id: 'acc-1', user: { id: 'user-1', full_name: 'John Doe', email: 'john@test.com' } },
        { ...mockAccount, id: 'acc-2', user: { id: 'user-2', full_name: 'Jane Doe', email: 'jane@test.com' } },
      ];

      const accountMock = createQueryMock(() => []);
      (accountMock as Record<string, unknown>).select = vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          range: vi.fn().mockResolvedValue({
            data: accounts,
            count: 2,
            error: null,
          }),
        }),
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: () => accountMock,
      } as never);

      const req = createMockRequest({
        query: { page: '1', limit: '10' },
      });
      const res = createMockResponse();

      await controller.getAllAccounts(req as never, res as never);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: accounts,
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
        },
      });
    });

    it('should filter by tier', async () => {
      const accountMock = createQueryMock(() => []);
      const rangeMock = vi.fn().mockResolvedValue({
        data: [mockAccount],
        count: 1,
        error: null,
      });
      const eqMock = vi.fn().mockReturnValue({
        range: rangeMock,
      });
      (accountMock as Record<string, unknown>).select = vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          eq: eqMock,
          range: vi.fn().mockReturnValue({
            eq: eqMock,
          }),
        }),
      });

      vi.mocked(getSupabase).mockReturnValue({
        from: () => accountMock,
      } as never);

      const req = createMockRequest({
        query: { tier: mockTierId },
      });
      const res = createMockResponse();

      await controller.getAllAccounts(req as never, res as never);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });
  });

  // ============================================
  // GET STATS TESTS
  // ============================================
  describe('getStats', () => {
    it('should return loyalty statistics', async () => {
      const accounts = [
        { available_points: 500, lifetime_points: 1000 },
        { available_points: 1000, lifetime_points: 2000 },
      ];
      const tierAccounts = [
        { tier_id: 'tier-1', tier: { name: 'Bronze', color: '#CD7F32' }, is_active: true },
        { tier_id: 'tier-2', tier: { name: 'Silver', color: '#C0C0C0' }, is_active: true },
      ];
      const transactions = [
        { type: 'earn', points: 100, created_at: new Date().toISOString() },
        { type: 'redeem', points: -50, created_at: new Date().toISOString() },
      ];

      const tableMocks: Record<string, ReturnType<typeof createQueryMock>> = {
        loyalty_accounts: (() => {
          const mock = createQueryMock(() => accounts);
          let callCount = 0;
          (mock as Record<string, unknown>).select = vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return {
                then: (resolve: (value: { data: unknown; error: unknown }) => void) => {
                  resolve({ data: accounts, error: null });
                  return Promise.resolve({ data: accounts, error: null });
                },
              };
            }
            return {
              eq: vi.fn().mockReturnValue({
                then: (resolve: (value: { data: unknown; error: unknown }) => void) => {
                  resolve({ data: tierAccounts, error: null });
                  return Promise.resolve({ data: tierAccounts, error: null });
                },
              }),
            };
          });
          return mock;
        })(),
        loyalty_transactions: (() => {
          const mock = createQueryMock(() => transactions);
          (mock as Record<string, unknown>).select = vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                then: (resolve: (value: { data: unknown; error: unknown }) => void) => {
                  resolve({ data: transactions, error: null });
                  return Promise.resolve({ data: transactions, error: null });
                },
              }),
            }),
          });
          return mock;
        })(),
      };

      vi.mocked(getSupabase).mockReturnValue({
        from: (table: string) => tableMocks[table] || createQueryMock(() => []),
      } as never);

      const req = createMockRequest();
      const res = createMockResponse();

      await controller.getStats(req as never, res as never);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          summary: expect.objectContaining({
            total_members: 2,
            total_outstanding_points: 1500,
            total_lifetime_points: 3000,
          }),
        }),
      });
    });

    it('should handle empty stats', async () => {
      const tableMocks: Record<string, ReturnType<typeof createQueryMock>> = {
        loyalty_accounts: (() => {
          const mock = createQueryMock(() => []);
          (mock as Record<string, unknown>).select = vi.fn().mockReturnValue({
            then: (resolve: (value: { data: unknown; error: unknown }) => void) => {
              resolve({ data: [], error: null });
              return Promise.resolve({ data: [], error: null });
            },
            eq: vi.fn().mockReturnValue({
              then: (resolve: (value: { data: unknown; error: unknown }) => void) => {
                resolve({ data: [], error: null });
                return Promise.resolve({ data: [], error: null });
              },
            }),
          });
          return mock;
        })(),
        loyalty_transactions: (() => {
          const mock = createQueryMock(() => []);
          (mock as Record<string, unknown>).select = vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                then: (resolve: (value: { data: unknown; error: unknown }) => void) => {
                  resolve({ data: [], error: null });
                  return Promise.resolve({ data: [], error: null });
                },
              }),
            }),
          });
          return mock;
        })(),
      };

      vi.mocked(getSupabase).mockReturnValue({
        from: (table: string) => tableMocks[table] || createQueryMock(() => []),
      } as never);

      const req = createMockRequest();
      const res = createMockResponse();

      await controller.getStats(req as never, res as never);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          summary: expect.objectContaining({
            total_members: 0,
            total_outstanding_points: 0,
            avg_points_per_member: 0,
          }),
        }),
      });
    });
  });

  // ============================================
  // CALCULATE POINTS TESTS
  // ============================================
  describe('calculatePoints', () => {
    it('should calculate points for purchase', async () => {
      const tableMocks: Record<string, ReturnType<typeof createQueryMock>> = {
        loyalty_settings: createQueryMock(() => [mockSettings]),
        loyalty_accounts: createQueryMock(() => [mockAccount]),
      };

      vi.mocked(getSupabase).mockReturnValue({
        from: (table: string) => tableMocks[table] || createQueryMock(() => []),
      } as never);

      const req = createMockRequest({
        body: { userId: mockUserId, amount: 100 },
      });
      const res = createMockResponse();

      await controller.calculatePoints(req as never, res as never);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          pointsToEarn: expect.any(Number),
          multiplier: expect.any(Number),
          dollarValue: expect.any(Number),
          enabled: true,
        }),
      });
    });

    it('should return zero points when loyalty disabled', async () => {
      const tableMocks: Record<string, ReturnType<typeof createQueryMock>> = {
        loyalty_settings: createQueryMock(() => []),
      };

      vi.mocked(getSupabase).mockReturnValue({
        from: (table: string) => tableMocks[table] || createQueryMock(() => []),
      } as never);

      const req = createMockRequest({
        body: { amount: 100 },
      });
      const res = createMockResponse();

      await controller.calculatePoints(req as never, res as never);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { pointsToEarn: 0, enabled: false },
      });
    });

    it('should apply tier multiplier', async () => {
      const goldAccount = {
        ...mockAccount,
        tier: { points_multiplier: 2.0 },
      };

      const tableMocks: Record<string, ReturnType<typeof createQueryMock>> = {
        loyalty_settings: createQueryMock(() => [mockSettings]),
        loyalty_accounts: createQueryMock(() => [goldAccount]),
      };

      vi.mocked(getSupabase).mockReturnValue({
        from: (table: string) => tableMocks[table] || createQueryMock(() => []),
      } as never);

      const req = createMockRequest({
        body: { userId: mockUserId, amount: 50 },
      });
      const res = createMockResponse();

      await controller.calculatePoints(req as never, res as never);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          multiplier: 2.0,
          enabled: true,
        }),
      });
    });

    it('should reject invalid amount', async () => {
      const req = createMockRequest({
        body: { amount: 0 },
      });
      const res = createMockResponse();

      await controller.calculatePoints(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid amount',
      });
    });

    it('should reject negative amount', async () => {
      const req = createMockRequest({
        body: { amount: -50 },
      });
      const res = createMockResponse();

      await controller.calculatePoints(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  // ============================================
  // ERROR HANDLING TESTS
  // ============================================
  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully in getAccount', async () => {
      vi.mocked(getSupabase).mockImplementation(() => {
        throw new Error('Connection failed');
      });

      const req = createMockRequest({ params: { userId: mockUserId } });
      const res = createMockResponse();

      await controller.getAccount(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
      }));
    });

    it('should handle unexpected errors gracefully in earnPoints', async () => {
      vi.mocked(getSupabase).mockImplementation(() => {
        throw new Error('Connection failed');
      });

      const req = createMockRequest({
        body: { userId: mockUserId, points: 100 },
      });
      const res = createMockResponse();

      await controller.earnPoints(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should handle unexpected errors gracefully in redeemPoints', async () => {
      vi.mocked(getSupabase).mockImplementation(() => {
        throw new Error('Connection failed');
      });

      const req = createMockRequest({
        body: { userId: mockUserId, points: 100 },
      });
      const res = createMockResponse();

      await controller.redeemPoints(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should handle unexpected errors gracefully in getStats', async () => {
      vi.mocked(getSupabase).mockImplementation(() => {
        throw new Error('Connection failed');
      });

      const req = createMockRequest();
      const res = createMockResponse();

      await controller.getStats(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ============================================
  // VALIDATION EDGE CASES
  // ============================================
  describe('Validation Edge Cases', () => {
    it('should handle very large point values', async () => {
      const tableMocks: Record<string, ReturnType<typeof createQueryMock>> = {
        loyalty_accounts: createQueryMock(() => [{ ...mockAccount, available_points: 1000000 }]),
        loyalty_settings: createQueryMock(() => [mockSettings]),
        loyalty_transactions: createQueryMock(() => []),
      };
      tableMocks.loyalty_transactions.insert = vi.fn().mockImplementation(() => ({
        then: (resolve: (arg: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null })
      }));

      vi.mocked(getSupabase).mockReturnValue({
        from: (table: string) => tableMocks[table] || createQueryMock(() => []),
      } as never);

      const req = createMockRequest({
        body: { userId: mockUserId, points: 999999 },
      });
      const res = createMockResponse();

      await controller.redeemPoints(req as never, res as never);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });

    it('should handle decimal points (should floor)', async () => {
      const tableMocks: Record<string, ReturnType<typeof createQueryMock>> = {
        loyalty_accounts: createQueryMock(() => [mockAccount]),
        loyalty_settings: createQueryMock(() => [mockSettings]),
        loyalty_tiers: createQueryMock(() => [mockTier]),
        loyalty_transactions: createQueryMock(() => []),
      };
      tableMocks.loyalty_transactions.insert = vi.fn().mockImplementation(() => ({
        then: (resolve: (arg: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null })
      }));

      vi.mocked(getSupabase).mockReturnValue({
        from: (table: string) => tableMocks[table] || createQueryMock(() => []),
      } as never);

      // Note: The schema uses z.number().int().positive(), so decimal would fail validation
      const req = createMockRequest({
        body: { userId: mockUserId, points: 10.5 },
      });
      const res = createMockResponse();

      await controller.earnPoints(req as never, res as never);

      // Should fail validation because points must be integer
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle special characters in description', async () => {
      const tableMocks: Record<string, ReturnType<typeof createQueryMock>> = {
        loyalty_accounts: createQueryMock(() => [mockAccount]),
        loyalty_settings: createQueryMock(() => [mockSettings]),
        loyalty_tiers: createQueryMock(() => [mockTier]),
        loyalty_transactions: createQueryMock(() => []),
      };
      tableMocks.loyalty_transactions.insert = vi.fn().mockImplementation(() => ({
        then: (resolve: (arg: { data: unknown; error: unknown }) => void) => resolve({ data: null, error: null })
      }));

      vi.mocked(getSupabase).mockReturnValue({
        from: (table: string) => tableMocks[table] || createQueryMock(() => []),
      } as never);

      const req = createMockRequest({
        body: {
          userId: mockUserId,
          points: 100,
          description: 'Test <script>alert("xss")</script> & special "chars"',
        },
      });
      const res = createMockResponse();

      await controller.earnPoints(req as never, res as never);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
      }));
    });
  });
});
